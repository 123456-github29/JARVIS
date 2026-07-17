/**
 * JARVIS — Entry Point
 *
 * Boots the agent, connects to Google APIs, and starts listening
 * for voice or text input.
 *
 * Usage:
 *   npm run dev          — run with hot reload
 *   npm start            — run built version
 *   node dist/index.js --text "Draft an email to mom"   — one-shot text mode
 */

import "dotenv/config";
import { GmailClient } from "./integrations/gmail.js";
import { DriveClient } from "./integrations/drive.js";
import { CalendarClient } from "./integrations/calendar.js";
import { DocsClient } from "./integrations/docs.js";
import { MemoryStore } from "./memory/store.js";
import { JarvisAgent } from "./agent/jarvis.js";
import type { ToolContext } from "./agent/tools.js";
import readline from "readline";

// ─── Config from .env ─────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing required env variable: ${key}`);
    console.error(`Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return val;
}

const ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY");
const GOOGLE_ACCESS_TOKEN = requireEnv("GOOGLE_ACCESS_TOKEN");

// ─── Boot ────────────────────────────────────────────────────────

async function main() {
  console.log("⚡ JARVIS starting up...\n");

  // Wire up all integrations
  const toolContext: ToolContext = {
    userId: "default",
    gmail: new GmailClient(GOOGLE_ACCESS_TOKEN),
    drive: new DriveClient(GOOGLE_ACCESS_TOKEN),
    calendar: new CalendarClient(GOOGLE_ACCESS_TOKEN),
    docs: new DocsClient(GOOGLE_ACCESS_TOKEN),
    memory: new MemoryStore(),
  };

  const agent = new JarvisAgent(ANTHROPIC_API_KEY, toolContext);

  const args = process.argv.slice(2);

  // ── One-shot text mode: jarvis --text "do something" ────────────

  if (args.includes("--text")) {
    const idx = args.indexOf("--text");
    const input = args.slice(idx + 1).join(" ");
    if (!input) {
      console.error('Usage: node dist/index.js --text "your command here"');
      process.exit(1);
    }
    console.log(`You: ${input}\n`);
    const response = await agent.think(input);
    console.log(`JARVIS: ${response}`);
    toolContext.memory.close();
    return;
  }

  // ── Interactive text mode (REPL) ─────────────────────────────────

  if (args.includes("--repl") || args.length === 0) {
    console.log("JARVIS interactive mode. Type your commands below.");
    console.log("Type 'exit' to quit.\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = () => {
      rl.question("You: ", async (input) => {
        if (input.trim().toLowerCase() === "exit") {
          console.log("\nGoodbye.");
          toolContext.memory.close();
          rl.close();
          return;
        }

        if (!input.trim()) {
          ask();
          return;
        }

        const response = await agent.think(input.trim());
        console.log(`\nJARVIS: ${response}\n`);
        ask();
      });
    };

    ask();
    return;
  }

  // ── Voice mode: wire in Toury's voice layer ──────────────────────

  if (args.includes("--voice")) {
    const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
    const { createVoiceSession } = await import("./voice/index.js");

    const session = createVoiceSession(
      {
        openaiApiKey: OPENAI_API_KEY,
        systemPrompt:
          "You are JARVIS, a voice assistant. Listen and respond naturally. Keep responses short for voice.",
        onTranscript: (text, role) => {
          console.log(`${role === "user" ? "You" : "JARVIS"}: ${text}`);
        },
      },
      agent
    );

    console.log("Starting voice session...");
    await session.start();
    console.log("Voice ready. Speak now.\n");

    process.on("SIGINT", () => {
      session.stop();
      toolContext.memory.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
