/**
 * JARVIS Voice Layer
 *
 * Powered by OpenAI Realtime API (same as Toury).
 * Handles voice in → transcript → agent → voice out loop.
 *
 * Based on Toury's existing voice infrastructure.
 * Drop your Toury voice session code here and wire it to the agent.
 */

import WebSocket from "ws";
import { createLogger } from "../observability/logger.js";
import { JarvisAgent } from "../agent/jarvis.js";

const logger = createLogger("voice");

export interface VoiceSessionConfig {
  openaiApiKey: string;
  systemPrompt: string;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
  onToolCall?: (toolName: string, args: unknown) => void;
}

export interface VoiceSession {
  start: () => Promise<void>;
  stop: () => void;
  sendAudio: (audioChunk: Buffer) => void;
  isConnected: () => boolean;
}

/**
 * Creates a Realtime API voice session.
 *
 * This is the OpenAI Realtime API integration from Toury.
 * Replace the WebSocket handling here with your existing Toury code.
 */
export function createVoiceSession(
  config: VoiceSessionConfig,
  agent: JarvisAgent
): VoiceSession {
  let ws: WebSocket | null = null;
  let connected = false;

  const REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

  function start(): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(REALTIME_URL, {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      ws.on("open", () => {
        logger.info("Realtime API connected");
        connected = true;

        // Configure the session
        ws!.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: config.systemPrompt,
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
              tools: [], // JARVIS tools are handled by the agent, not Realtime directly
            },
          })
        );

        resolve();
      });

      ws.on("message", async (raw) => {
        const event = JSON.parse(raw.toString());
        await handleRealtimeEvent(event, agent, config);
      });

      ws.on("error", (err) => {
        logger.error("Realtime WS error", { error: err.message });
        reject(err);
      });

      ws.on("close", () => {
        logger.info("Realtime API disconnected");
        connected = false;
      });
    });
  }

  function stop() {
    ws?.close();
    ws = null;
    connected = false;
  }

  function sendAudio(audioChunk: Buffer) {
    if (!ws || !connected) return;
    ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: audioChunk.toString("base64"),
      })
    );
  }

  return { start, stop, sendAudio, isConnected: () => connected };
}

// ─── Realtime Event Handler ───────────────────────────────────────

async function handleRealtimeEvent(
  event: { type: string; transcript?: string; delta?: { transcript?: string }; item?: { role?: string; content?: Array<{ transcript?: string }> } },
  agent: JarvisAgent,
  config: VoiceSessionConfig
) {
  switch (event.type) {

    // User finished speaking — we have their transcript
    case "conversation.item.input_audio_transcription.completed": {
      const text = event.transcript ?? "";
      logger.info(`User said: ${text}`);
      config.onTranscript?.(text, "user");

      // Send to JARVIS agent for reasoning + tool calls
      const response = await agent.think(text);
      config.onTranscript?.(response, "assistant");
      break;
    }

    // Assistant is speaking (streaming)
    case "response.audio_transcript.delta": {
      // Streaming transcript delta — useful for UI
      break;
    }

    // Assistant finished speaking
    case "response.audio_transcript.done": {
      const text = event.transcript ?? "";
      logger.info(`JARVIS said: ${text}`);
      break;
    }

    case "error": {
      logger.error("Realtime API error", event);
      break;
    }
  }
}
