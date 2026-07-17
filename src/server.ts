/**
 * JARVIS Phone Server
 *
 * The HTTP + WebSocket server that connects a Twilio phone number to JARVIS's
 * voice brain. Deploy this to Railway (or any host with a public URL).
 *
 * Flow:
 *   1. Someone calls your Twilio number.
 *   2. Twilio POSTs to  /incoming-call  → we return TwiML telling Twilio to
 *      open a bidirectional Media Stream to  wss://<PUBLIC_HOST>/media-stream.
 *   3. Twilio connects that WebSocket; we bridge it to an OpenAI Realtime
 *      session (see src/voice/index.ts).
 *
 * Point your Twilio number's "A call comes in" webhook at:
 *   https://<PUBLIC_HOST>/incoming-call   (HTTP POST)
 */

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { loadConfig } from "./config.js";
import { createToolContext } from "./agent/tool-context.js";
import { bridgeTwilioMediaStream } from "./voice/index.js";
import { createLogger } from "./observability/logger.js";

const logger = createLogger("server");

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const toolCtx = createToolContext(config);

  const app = Fastify({ logger: false });
  await app.register(websocket);

  // Health check (Railway pings this).
  app.get("/health", async () => ({ status: "ok" }));

  // Twilio hits this when a call comes in. We return TwiML that opens a
  // bidirectional media stream back to our /media-stream WebSocket.
  app.all("/incoming-call", async (request, reply) => {
    const host = config.publicHost || request.headers.host || "";
    const wsUrl = `wss://${host}/media-stream`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
    reply.type("text/xml").send(twiml);
  });

  // Twilio Media Streams connect here.
  app.get("/media-stream", { websocket: true }, (socket: WebSocket) => {
    logger.info("Incoming media-stream connection");
    bridgeTwilioMediaStream(
      socket,
      {
        openaiApiKey: config.openaiApiKey,
        model: config.realtimeModel,
        voice: config.realtimeVoice,
        onTranscript: (text, role) => logger.info("transcript", { role, text }),
      },
      toolCtx
    );
  });

  const port = config.port;
  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`JARVIS phone server listening on :${port}`);
  if (config.publicHost) {
    logger.info(`Twilio webhook → https://${config.publicHost}/incoming-call`);
  }
}
