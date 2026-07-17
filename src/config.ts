/**
 * JARVIS Configuration
 *
 * Central place to read + validate environment variables.
 * Everything runs on OpenAI (brain + Realtime voice), Twilio for the phone
 * line, and Google OAuth for Gmail/Drive/Calendar/Docs.
 */

import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val || !val.trim()) {
    console.error(`\n✗ Missing required env variable: ${key}`);
    console.error(`  Copy .env.example to .env and fill it in.\n`);
    process.exit(1);
  }
  return val.trim();
}

function optional(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

export interface JarvisConfig {
  openaiApiKey: string;
  // Model used for the text/REPL brain (chat completions with tools)
  textModel: string;
  // Realtime model used for the voice phone line
  realtimeModel: string;
  realtimeVoice: string;

  // Google — either a static access token (quick testing) OR a full
  // refresh-token flow (production). See README for how to obtain these.
  google: {
    accessToken: string; // optional static token (expires in ~1h)
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };

  // Twilio (only needed for the phone line)
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };

  // Server
  port: number;
  // Public host Twilio dials back into, e.g. "jarvis.up.railway.app".
  // No protocol — used to build wss:// media-stream + https callback URLs.
  publicHost: string;

  timezone: string;
}

/**
 * Load config for text/REPL mode. Requires OpenAI + some Google auth.
 */
export function loadConfig(): JarvisConfig {
  const openaiApiKey = required("OPENAI_API_KEY");

  const google = {
    accessToken: optional("GOOGLE_ACCESS_TOKEN"),
    clientId: optional("GOOGLE_CLIENT_ID"),
    clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    refreshToken: optional("GOOGLE_REFRESH_TOKEN"),
  };

  if (!google.accessToken && !(google.clientId && google.clientSecret && google.refreshToken)) {
    console.error("\n✗ No Google credentials found.");
    console.error("  Set GOOGLE_ACCESS_TOKEN (quick testing), OR");
    console.error("  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN (production).\n");
    process.exit(1);
  }

  return {
    openaiApiKey,
    textModel: optional("OPENAI_TEXT_MODEL", "gpt-4o"),
    realtimeModel: optional("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-12-17"),
    realtimeVoice: optional("OPENAI_REALTIME_VOICE", "alloy"),
    google,
    twilio: {
      accountSid: optional("TWILIO_ACCOUNT_SID"),
      authToken: optional("TWILIO_AUTH_TOKEN"),
      phoneNumber: optional("TWILIO_PHONE_NUMBER"),
    },
    port: Number(optional("PORT", "8080")),
    publicHost: optional("PUBLIC_HOST"),
    timezone: optional("TIMEZONE", "America/Los_Angeles"),
  };
}
