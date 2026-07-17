/**
 * JARVIS Voice Layer — Twilio ⇄ OpenAI Realtime bridge
 *
 * A phone call comes in over Twilio. Twilio opens a Media Streams WebSocket
 * to our server and streams the caller's audio as base64 G.711 µ-law frames
 * (8 kHz mono). We open a second WebSocket to the OpenAI Realtime API and
 * pipe audio between the two.
 *
 * Because the Realtime API can speak G.711 µ-law natively, we set both its
 * input and output audio format to `g711_ulaw` and pass Twilio's payloads
 * straight through — no resampling or transcoding required.
 *
 * The Realtime model handles voice-activity detection AND tool calling
 * itself; when it decides to call a JARVIS tool we run it against the Google
 * APIs and hand the result back into the session.
 */

import WebSocket from "ws";
import { createLogger } from "../observability/logger.js";
import {
  executeTool,
  formatToolsForRealtime,
  type ToolContext,
} from "../agent/tools.js";
import { JARVIS_SYSTEM_PROMPT } from "../agent/jarvis.js";

const logger = createLogger("voice");

export interface RealtimeVoiceConfig {
  openaiApiKey: string;
  model: string;
  voice: string;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
}

/**
 * Bridge a single Twilio Media Streams connection to a fresh OpenAI Realtime
 * session. Call this once per inbound phone call.
 */
export function bridgeTwilioMediaStream(
  twilioWs: WebSocket,
  config: RealtimeVoiceConfig,
  toolCtx: ToolContext
): void {
  let streamSid: string | null = null;

  const openaiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.model)}`,
    {
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  // ─── OpenAI Realtime → us ───────────────────────────────────────

  openaiWs.on("open", () => {
    logger.info("Realtime API connected");
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: JARVIS_SYSTEM_PROMPT,
          voice: config.voice,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          tools: formatToolsForRealtime(),
          tool_choice: "auto",
        },
      })
    );

    // Greet the caller first so they know JARVIS is listening.
    openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            "Greet the caller briefly as JARVIS and ask how you can help.",
        },
      })
    );
  });

  openaiWs.on("message", async (raw) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (event.type) {
      // Model produced audio → forward to the caller via Twilio.
      case "response.audio.delta": {
        if (streamSid && event.delta) {
          twilioWs.send(
            JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: event.delta },
            })
          );
        }
        break;
      }

      // Caller started talking → interrupt any audio we're playing (barge-in).
      case "input_audio_buffer.speech_started": {
        if (streamSid) {
          twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
        }
        break;
      }

      // Transcripts (for logging / a future dashboard).
      case "conversation.item.input_audio_transcription.completed": {
        if (event.transcript) config.onTranscript?.(event.transcript, "user");
        break;
      }
      case "response.audio_transcript.done": {
        if (event.transcript) config.onTranscript?.(event.transcript, "assistant");
        break;
      }

      // Model wants to call a JARVIS tool.
      case "response.function_call_arguments.done": {
        await handleFunctionCall(openaiWs, event, toolCtx);
        break;
      }

      case "error": {
        logger.error("Realtime API error", { error: event.error });
        break;
      }
    }
  });

  openaiWs.on("close", () => {
    logger.info("Realtime API disconnected");
    twilioWs.close();
  });
  openaiWs.on("error", (err) => {
    logger.error("Realtime WS error", { error: (err as Error).message });
  });

  // ─── Twilio → OpenAI Realtime ───────────────────────────────────

  twilioWs.on("message", (raw) => {
    let msg: TwilioMediaMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case "start": {
        streamSid = msg.start?.streamSid ?? null;
        logger.info("Twilio media stream started", { streamSid });
        break;
      }
      case "media": {
        if (openaiWs.readyState === WebSocket.OPEN && msg.media?.payload) {
          openaiWs.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            })
          );
        }
        break;
      }
      case "stop": {
        logger.info("Twilio media stream stopped", { streamSid });
        openaiWs.close();
        break;
      }
    }
  });

  twilioWs.on("close", () => {
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
  });
}

async function handleFunctionCall(
  openaiWs: WebSocket,
  event: RealtimeEvent,
  toolCtx: ToolContext
): Promise<void> {
  const name = event.name ?? "";
  const callId = event.call_id ?? "";
  let args: Record<string, unknown> = {};
  try {
    args = event.arguments ? JSON.parse(event.arguments) : {};
  } catch {
    /* leave args empty */
  }

  logger.info(`Realtime tool call: ${name}`);
  const result = await executeTool(name, args, toolCtx);

  // Hand the result back and let the model continue speaking.
  openaiWs.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: result.result,
      },
    })
  );
  openaiWs.send(JSON.stringify({ type: "response.create" }));
}

// ─── Minimal event shapes we read ─────────────────────────────────

interface RealtimeEvent {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  error?: unknown;
}

interface TwilioMediaMessage {
  event: "connected" | "start" | "media" | "stop";
  start?: { streamSid: string };
  media?: { payload: string };
}
