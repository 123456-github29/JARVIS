/**
 * JARVIS — Entry Point
 *
 * Modes:
 *   npm run dev                              → interactive REPL (text)
 *   npm run dev -- --text "draft an email"   → one-shot text command
 *   npm run dev -- --serve                   → phone server (Twilio + Realtime voice)
 *   npm start                                → built version (respects the same flags)
 *
 * Everything runs on OpenAI (text brain + Realtime voice). Google APIs power
 * the tools; Twilio provides the phone line for --serve mode.
 */

import { loadConfig } from "./config.js";
import { createToolContext } from "./agent/tool-context.js";
import { JarvisAgent } from "./agent/jarvis.js";
import readline from "readline";

async function main() {
  const args = process.argv.slice(2);

  // ── Phone server mode ────────────────────────────────────────────
  if (args.includes("--serve")) {
    const { startServer } = await import("./server.js");
    await startServer();
    return;
  }

  console.log("⚡ JARVIS starting up...\n");

  const config = loadConfig();
  const toolContext = createToolContext(config);
  const agent = new JarvisAgent({
    apiKey: config.openaiApiKey,
    model: config.textModel,
    toolContext,
  });

  // ── One-shot text mode ───────────────────────────────────────────
  if (args.includes("--text")) {
    const idx = args.indexOf("--text");
    const input = args.slice(idx + 1).join(" ");
    if (!input) {
      console.error('Usage: npm run dev -- --text "your command here"');
      process.exit(1);
    }
    console.log(`You: ${input}\n`);
    const response = await agent.think(input);
    console.log(`JARVIS: ${response}`);
    toolContext.memory.close();
    return;
  }

  // ── Interactive REPL (default) ───────────────────────────────────
  console.log("JARVIS interactive mode. Type your commands below.");
  console.log("Type 'exit' to quit.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === "exit") {
        console.log("\nGoodbye.");
        toolContext.memory.close();
        rl.close();
        return;
      }
      if (!trimmed) {
        ask();
        return;
      }
      try {
        const response = await agent.think(trimmed);
        console.log(`\nJARVIS: ${response}\n`);
      } catch (err) {
        console.error(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      ask();
    });
  };

  ask();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
