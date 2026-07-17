/**
 * Builds the ToolContext — the set of live API clients the agent's tools run
 * against — from config. Shared by the text/REPL entry point and the phone
 * server so both wire up Google auth identically.
 */

import type { JarvisConfig } from "../config.js";
import { tokenProviderFromConfig } from "../integrations/google-auth.js";
import { GmailClient } from "../integrations/gmail.js";
import { DriveClient } from "../integrations/drive.js";
import { CalendarClient } from "../integrations/calendar.js";
import { DocsClient } from "../integrations/docs.js";
import { MemoryStore } from "../memory/store.js";
import type { ToolContext } from "./tools.js";

export function createToolContext(config: JarvisConfig, userId = "default"): ToolContext {
  const getToken = tokenProviderFromConfig(config.google);
  return {
    userId,
    gmail: new GmailClient(getToken),
    drive: new DriveClient(getToken),
    calendar: new CalendarClient(getToken),
    docs: new DocsClient(getToken),
    memory: new MemoryStore(),
  };
}
