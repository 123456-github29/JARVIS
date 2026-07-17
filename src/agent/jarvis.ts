/**
 * JARVIS Agent — text brain
 *
 * The core Think → Act → Observe loop for text/REPL mode, powered by the
 * OpenAI Chat Completions API with function calling. (The voice phone line
 * uses the OpenAI Realtime API instead — see src/voice/index.ts — but both
 * share the same tool definitions and executor in src/agent/tools.ts.)
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { createLogger } from "../observability/logger.js";
import { executeTool, formatToolsForOpenAI, type ToolContext } from "./tools.js";

const logger = createLogger("agent");

export const JARVIS_SYSTEM_PROMPT = `You are JARVIS, a personal AI assistant.

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

You are accessible via voice (phone call) as well as text.
Keep responses short and natural when speaking.`;

export interface JarvisAgentOptions {
  apiKey: string;
  model: string;
  toolContext: ToolContext;
}

export class JarvisAgent {
  private client: OpenAI;
  private model: string;
  private ctx: ToolContext;
  private tools: ChatCompletionTool[];
  private history: ChatCompletionMessageParam[] = [];
  private maxHistoryLength = 30;

  constructor(opts: JarvisAgentOptions) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.ctx = opts.toolContext;
    this.tools = formatToolsForOpenAI();
  }

  /**
   * Main entry point: user says something → JARVIS thinks, acts, and returns
   * the final text response to speak/show.
   */
  async think(userInput: string): Promise<string> {
    logger.info("User input", { input: userInput.slice(0, 100) });

    this.history.push({ role: "user", content: userInput });
    this.trimHistory();

    const MAX_ITERATIONS = 10;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          { role: "system", content: JARVIS_SYSTEM_PROMPT },
          ...this.history,
        ],
        tools: this.tools,
      });

      const choice = response.choices[0]?.message;
      if (!choice) break;

      // Record the assistant turn (may contain tool calls).
      this.history.push(choice);

      const toolCalls = choice.tool_calls ?? [];

      // No tool calls → final answer.
      if (toolCalls.length === 0) {
        const text = choice.content ?? "";
        return text || "Done.";
      }

      // Execute each tool call and feed results back.
      logger.info(`Executing ${toolCalls.length} tool(s)`);
      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        const result = await this.runToolCall(call.function.name, call.function.arguments);
        this.history.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
      this.trimHistory();
    }

    return "Sorry — I couldn't finish that. Could you rephrase?";
  }

  private async runToolCall(name: string, rawArgs: string): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
    } catch {
      return `Tool error: could not parse arguments for ${name}`;
    }

    const result = await executeTool(name, args, this.ctx);
    logger.info(`Tool ${name}`, {
      success: result.success,
      result: result.result.slice(0, 120),
    });
    return result.result;
  }

  /**
   * Keep the last N messages, but never orphan a tool result from the
   * assistant message that requested it (OpenAI rejects that). We trim from
   * the front and drop leading `tool` messages that lost their parent.
   */
  private trimHistory() {
    if (this.history.length <= this.maxHistoryLength) return;
    let start = this.history.length - this.maxHistoryLength;
    while (start < this.history.length && this.history[start]?.role === "tool") {
      start++;
    }
    this.history = this.history.slice(start);
  }

  clearHistory() {
    this.history = [];
  }
}
