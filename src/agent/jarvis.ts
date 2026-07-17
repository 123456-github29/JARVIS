/**
 * JARVIS Agent
 *
 * The core Think → Act → Observe loop.
 * Stripped down from Automaton's ReAct loop — no Conway, no survival tiers,
 * no blockchain. Just the AI reasoning + tool execution.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "../observability/logger.js";
import { executeTool, formatToolsForClaude, type ToolContext } from "./tools.js";

const logger = createLogger("agent");

const SYSTEM_PROMPT = `You are JARVIS, a personal AI assistant.

You help your user by:
- Managing their email (drafting, reading, replying via Gmail)
- Saving files and transcripts to Google Drive
- Scheduling and checking Google Calendar events
- Filling in document templates in Google Docs
- Remembering important facts across sessions
- Answering questions and having natural conversation

You are helpful, proactive, and concise. When the user asks you to do something,
do it using the available tools — don't just describe what you would do.

When you use a tool, tell the user what you're doing in plain language.
After using a tool, confirm what happened (e.g. "Done — I've saved that to Drive").

You are accessible via voice (phone call / app) as well as text.
Keep responses short and natural when in voice mode.`;

export class JarvisAgent {
  private client: Anthropic;
  private ctx: ToolContext;
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  private maxHistoryLength = 20;

  constructor(anthropicApiKey: string, toolContext: ToolContext) {
    this.client = new Anthropic({ apiKey: anthropicApiKey });
    this.ctx = toolContext;
  }

  /**
   * Main entry point: user says something → JARVIS thinks and acts.
   * Returns the final text response to speak/show to the user.
   */
  async think(userInput: string): Promise<string> {
    logger.info("User input", { input: userInput.slice(0, 100) });

    // Add to conversation history
    this.conversationHistory.push({ role: "user", content: userInput });
    this.trimHistory();

    const tools = formatToolsForClaude();
    let finalResponse = "";

    // ─── ReAct Loop: Think → Act → Observe ───────────────────

    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools,
        messages: this.buildMessages(),
      });

      // ── Parse response ──────────────────────────────────────

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      const textResponse = textBlocks.map((b) => ("text" in b ? b.text : "")).join("");

      // ── No tool calls → we're done ──────────────────────────

      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        finalResponse = textResponse;
        break;
      }

      // ── Execute tool calls ──────────────────────────────────

      logger.info(`Executing ${toolUseBlocks.length} tool(s)`);

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") return null;

          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            this.ctx
          );

          logger.info(`Tool ${block.name}`, {
            success: result.success,
            result: String(result.result).slice(0, 100),
          });

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: String(result.result),
          };
        })
      );

      // Add assistant's tool-calling message + tool results to history
      this.addToHistory("assistant", JSON.stringify(response.content));
      this.addToHistory(
        "user",
        JSON.stringify(toolResults.filter(Boolean))
      );
    }

    // Add final response to history
    if (finalResponse) {
      this.conversationHistory.push({ role: "assistant", content: finalResponse });
    }

    return finalResponse || "Done.";
  }

  private buildMessages(): Array<{ role: "user" | "assistant"; content: string | unknown[] }> {
    return this.conversationHistory.map((m) => {
      // Tool result messages need to be passed as arrays
      if (m.role === "user" && m.content.startsWith("[")) {
        try {
          return { role: m.role, content: JSON.parse(m.content) };
        } catch {
          return { role: m.role, content: m.content };
        }
      }
      // Assistant tool-use messages need to be parsed back to arrays
      if (m.role === "assistant" && m.content.startsWith("[")) {
        try {
          return { role: m.role, content: JSON.parse(m.content) };
        } catch {
          return { role: m.role, content: m.content };
        }
      }
      return { role: m.role, content: m.content };
    });
  }

  private addToHistory(role: "user" | "assistant", content: string) {
    this.conversationHistory.push({ role, content });
    this.trimHistory();
  }

  private trimHistory() {
    // Keep last N messages to avoid blowing up context
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(
        this.conversationHistory.length - this.maxHistoryLength
      );
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getHistory() {
    return [...this.conversationHistory];
  }
}
