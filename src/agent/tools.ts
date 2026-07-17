/**
 * JARVIS Tool System
 *
 * Tools the agent can call. Replaces Automaton's 57 tools with
 * JARVIS-specific ones: Gmail, Drive, Calendar, Docs, memory, and voice.
 */

import type { ToolCallResult } from "../types.js";
import { createLogger } from "../observability/logger.js";
import { GmailClient } from "../integrations/gmail.js";
import { DriveClient } from "../integrations/drive.js";
import { CalendarClient } from "../integrations/calendar.js";
import { DocsClient } from "../integrations/docs.js";
import { MemoryStore } from "../memory/store.js";

const logger = createLogger("tools");

// ─── Tool Definition ──────────────────────────────────────────────

export interface JarvisTool {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: "safe" | "caution" | "dangerous";
  parameters: Record<string, ToolParam>;
}

interface ToolParam {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required: boolean;
}

type ToolCategory = "email" | "drive" | "calendar" | "docs" | "memory" | "system";

// ─── Tool Context ─────────────────────────────────────────────────

export interface ToolContext {
  userId: string;
  gmail: GmailClient;
  drive: DriveClient;
  calendar: CalendarClient;
  docs: DocsClient;
  memory: MemoryStore;
}

// ─── Tool Definitions ─────────────────────────────────────────────

export const JARVIS_TOOLS: JarvisTool[] = [

  // ── Email tools ──────────────────────────────────────────────

  {
    name: "create_email_draft",
    description: "Create a draft email in Gmail. Returns the draft ID.",
    category: "email",
    riskLevel: "safe",
    parameters: {
      to: { type: "string", description: "Recipient email address", required: true },
      subject: { type: "string", description: "Email subject line", required: true },
      body: { type: "string", description: "Email body (plain text or HTML)", required: true },
      cc: { type: "string", description: "CC email addresses (comma separated)", required: false },
    },
  },

  {
    name: "read_emails",
    description: "Read recent emails from Gmail inbox. Returns subject, sender, snippet, and date.",
    category: "email",
    riskLevel: "safe",
    parameters: {
      count: { type: "number", description: "Number of emails to fetch (default 10)", required: false },
      query: { type: "string", description: "Gmail search query e.g. 'from:boss@co.com is:unread'", required: false },
    },
  },

  {
    name: "send_email",
    description: "Send an email immediately via Gmail. Use create_email_draft first if unsure.",
    category: "email",
    riskLevel: "dangerous",
    parameters: {
      to: { type: "string", description: "Recipient email address", required: true },
      subject: { type: "string", description: "Email subject line", required: true },
      body: { type: "string", description: "Email body", required: true },
    },
  },

  {
    name: "reply_to_email",
    description: "Reply to an existing email thread.",
    category: "email",
    riskLevel: "dangerous",
    parameters: {
      thread_id: { type: "string", description: "Gmail thread ID to reply to", required: true },
      body: { type: "string", description: "Reply body", required: true },
    },
  },

  // ── Drive tools ───────────────────────────────────────────────

  {
    name: "save_to_drive",
    description: "Save content as a file to Google Drive. Creates a new file.",
    category: "drive",
    riskLevel: "safe",
    parameters: {
      filename: { type: "string", description: "File name including extension e.g. 'notes.txt'", required: true },
      content: { type: "string", description: "File content to save", required: true },
      folder_id: { type: "string", description: "Drive folder ID to save into (optional, defaults to root)", required: false },
    },
  },

  {
    name: "save_transcript",
    description: "Save a voice session transcript to Google Drive.",
    category: "drive",
    riskLevel: "safe",
    parameters: {
      transcript: { type: "string", description: "Full transcript text", required: true },
      session_name: { type: "string", description: "Session name or date label e.g. 'Drive home July 17'", required: false },
    },
  },

  {
    name: "list_drive_files",
    description: "List recent files in Google Drive.",
    category: "drive",
    riskLevel: "safe",
    parameters: {
      folder_id: { type: "string", description: "Folder to list (optional, defaults to recent files)", required: false },
      count: { type: "number", description: "Number of files to return (default 10)", required: false },
    },
  },

  {
    name: "read_drive_file",
    description: "Read the content of a file from Google Drive by file ID.",
    category: "drive",
    riskLevel: "safe",
    parameters: {
      file_id: { type: "string", description: "Google Drive file ID", required: true },
    },
  },

  // ── Calendar tools ────────────────────────────────────────────

  {
    name: "create_calendar_event",
    description: "Create a new event in Google Calendar.",
    category: "calendar",
    riskLevel: "caution",
    parameters: {
      title: { type: "string", description: "Event title", required: true },
      start: { type: "string", description: "Start datetime in ISO format e.g. '2026-07-17T14:00:00'", required: true },
      end: { type: "string", description: "End datetime in ISO format", required: true },
      description: { type: "string", description: "Event description or notes", required: false },
      attendees: { type: "string", description: "Comma-separated attendee email addresses", required: false },
    },
  },

  {
    name: "get_calendar_events",
    description: "Get upcoming calendar events.",
    category: "calendar",
    riskLevel: "safe",
    parameters: {
      days_ahead: { type: "number", description: "How many days ahead to look (default 7)", required: false },
    },
  },

  // ── Docs tools ────────────────────────────────────────────────

  {
    name: "fill_document_template",
    description: "Fill in a Google Doc template by replacing placeholder fields. Returns the new doc URL.",
    category: "docs",
    riskLevel: "caution",
    parameters: {
      template_id: { type: "string", description: "Google Doc template file ID", required: true },
      fields: { type: "string", description: "JSON string of field replacements e.g. {\"{{NAME}}\": \"John\", \"{{DATE}}\": \"July 17\"}", required: true },
      output_name: { type: "string", description: "Name for the new filled document", required: true },
    },
  },

  {
    name: "create_doc",
    description: "Create a new Google Doc with the given content.",
    category: "docs",
    riskLevel: "safe",
    parameters: {
      title: { type: "string", description: "Document title", required: true },
      content: { type: "string", description: "Document content in plain text or markdown", required: true },
    },
  },

  // ── Memory tools ──────────────────────────────────────────────

  {
    name: "remember",
    description: "Store a fact, preference, or piece of information to remember across sessions.",
    category: "memory",
    riskLevel: "safe",
    parameters: {
      key: { type: "string", description: "Short label for what to remember e.g. 'home_address', 'preferred_route'", required: true },
      value: { type: "string", description: "The thing to remember", required: true },
    },
  },

  {
    name: "recall",
    description: "Recall a previously stored fact or piece of information.",
    category: "memory",
    riskLevel: "safe",
    parameters: {
      key: { type: "string", description: "Key to look up", required: false },
      query: { type: "string", description: "Natural language query to search memory", required: false },
    },
  },

  {
    name: "forget",
    description: "Delete a stored memory by key.",
    category: "memory",
    riskLevel: "safe",
    parameters: {
      key: { type: "string", description: "Memory key to delete", required: true },
    },
  },

  // ── System tools ──────────────────────────────────────────────

  {
    name: "get_current_time",
    description: "Get the current date and time.",
    category: "system",
    riskLevel: "safe",
    parameters: {},
  },

  {
    name: "summarize_session",
    description: "Summarize the current session and optionally save to Drive.",
    category: "system",
    riskLevel: "safe",
    parameters: {
      save_to_drive: { type: "boolean", description: "Whether to also save the summary to Google Drive", required: false },
    },
  },
];

// ─── Tool Executor ────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  logger.info(`Executing tool: ${toolName}`, { args });

  try {
    switch (toolName) {

      // ── Email ────────────────────────────────────────────────

      case "create_email_draft": {
        const draft = await ctx.gmail.createDraft({
          to: String(args.to),
          subject: String(args.subject),
          body: String(args.body),
          cc: args.cc ? String(args.cc) : undefined,
        });
        return { success: true, result: `Draft created. ID: ${draft.id}` };
      }

      case "read_emails": {
        const emails = await ctx.gmail.listThreads({
          count: Number(args.count ?? 10),
          query: args.query ? String(args.query) : undefined,
        });
        return { success: true, result: JSON.stringify(emails, null, 2) };
      }

      case "send_email": {
        const result = await ctx.gmail.sendEmail({
          to: String(args.to),
          subject: String(args.subject),
          body: String(args.body),
        });
        return { success: true, result: `Email sent. Message ID: ${result.id}` };
      }

      case "reply_to_email": {
        const result = await ctx.gmail.replyToThread({
          threadId: String(args.thread_id),
          body: String(args.body),
        });
        return { success: true, result: `Replied to thread. Message ID: ${result.id}` };
      }

      // ── Drive ────────────────────────────────────────────────

      case "save_to_drive": {
        const file = await ctx.drive.createFile({
          name: String(args.filename),
          content: String(args.content),
          folderId: args.folder_id ? String(args.folder_id) : undefined,
        });
        return { success: true, result: `File saved. ID: ${file.id} — ${file.webViewLink}` };
      }

      case "save_transcript": {
        const now = new Date().toISOString().slice(0, 10);
        const name = args.session_name ? String(args.session_name) : `JARVIS Transcript ${now}`;
        const file = await ctx.drive.createFile({
          name: `${name}.txt`,
          content: String(args.transcript),
          folderId: undefined,
        });
        return { success: true, result: `Transcript saved: ${file.webViewLink}` };
      }

      case "list_drive_files": {
        const files = await ctx.drive.listFiles({
          folderId: args.folder_id ? String(args.folder_id) : undefined,
          count: Number(args.count ?? 10),
        });
        return { success: true, result: JSON.stringify(files, null, 2) };
      }

      case "read_drive_file": {
        const content = await ctx.drive.readFile(String(args.file_id));
        return { success: true, result: content };
      }

      // ── Calendar ─────────────────────────────────────────────

      case "create_calendar_event": {
        const event = await ctx.calendar.createEvent({
          title: String(args.title),
          start: String(args.start),
          end: String(args.end),
          description: args.description ? String(args.description) : undefined,
          attendees: args.attendees
            ? String(args.attendees).split(",").map((e) => e.trim())
            : undefined,
        });
        return { success: true, result: `Event created: ${event.htmlLink}` };
      }

      case "get_calendar_events": {
        const events = await ctx.calendar.getEvents({
          daysAhead: Number(args.days_ahead ?? 7),
        });
        return { success: true, result: JSON.stringify(events, null, 2) };
      }

      // ── Docs ─────────────────────────────────────────────────

      case "fill_document_template": {
        const fields = JSON.parse(String(args.fields)) as Record<string, string>;
        const doc = await ctx.docs.fillTemplate({
          templateId: String(args.template_id),
          fields,
          outputName: String(args.output_name),
        });
        return { success: true, result: `Document filled: ${doc.url}` };
      }

      case "create_doc": {
        const doc = await ctx.docs.createDoc({
          title: String(args.title),
          content: String(args.content),
        });
        return { success: true, result: `Document created: ${doc.url}` };
      }

      // ── Memory ───────────────────────────────────────────────

      case "remember": {
        await ctx.memory.set(String(args.key), String(args.value));
        return { success: true, result: `Remembered: ${args.key}` };
      }

      case "recall": {
        if (args.key) {
          const value = await ctx.memory.get(String(args.key));
          return { success: true, result: value ?? "Nothing found for that key." };
        }
        const results = await ctx.memory.search(String(args.query ?? ""));
        return { success: true, result: JSON.stringify(results, null, 2) };
      }

      case "forget": {
        await ctx.memory.delete(String(args.key));
        return { success: true, result: `Deleted: ${args.key}` };
      }

      // ── System ───────────────────────────────────────────────

      case "get_current_time": {
        return {
          success: true,
          result: new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        };
      }

      case "summarize_session": {
        const summary = `Session summary generated at ${new Date().toISOString()}`;
        if (args.save_to_drive) {
          const file = await ctx.drive.createFile({
            name: `JARVIS Session ${new Date().toISOString().slice(0, 10)}.txt`,
            content: summary,
          });
          return { success: true, result: `Summary saved to Drive: ${file.webViewLink}` };
        }
        return { success: true, result: summary };
      }

      default:
        return { success: false, result: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Tool ${toolName} failed: ${msg}`);
    return { success: false, result: `Tool error: ${msg}` };
  }
}

// ─── Format tools for Claude API ──────────────────────────────────

export function formatToolsForClaude() {
  return JARVIS_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, param]) => [
          key,
          { type: param.type, description: param.description },
        ])
      ),
      required: Object.entries(tool.parameters)
        .filter(([, p]) => p.required)
        .map(([k]) => k),
    },
  }));
}
