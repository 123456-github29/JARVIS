/**
 * The Google services JARVIS connects to, and the OAuth scopes each needs.
 * A single Google sign-in grants all of these at once (one account, many
 * services). Multi-account support can come later.
 */

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/documents",
];

export interface GoogleService {
  key: string;
  name: string;
  description: string;
  scope: string;
  glyph: string;
}

export const GOOGLE_SERVICES: GoogleService[] = [
  {
    key: "gmail",
    name: "Gmail",
    description: "Read, draft, send, and reply to your email.",
    scope: "https://www.googleapis.com/auth/gmail.modify",
    glyph: "✉",
  },
  {
    key: "drive",
    name: "Drive",
    description: "Save files and transcripts, read your documents.",
    scope: "https://www.googleapis.com/auth/drive",
    glyph: "◈",
  },
  {
    key: "calendar",
    name: "Calendar",
    description: "Check your schedule and create events.",
    scope: "https://www.googleapis.com/auth/calendar",
    glyph: "◷",
  },
  {
    key: "docs",
    name: "Docs",
    description: "Create documents and fill in templates.",
    scope: "https://www.googleapis.com/auth/documents",
    glyph: "❐",
  },
];
