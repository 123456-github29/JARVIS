/**
 * jarvis-store-connection — Supabase Edge Function
 *
 * Stores a user's Google OAuth tokens after sign-in. This lives in Supabase
 * (not the Next.js app) so the sensitive credentials stay off the web host:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase.
 *   - APP_ENCRYPTION_KEY is a Supabase Edge Function secret.
 *
 * The website's OAuth callback calls this with the signed-in user's JWT in the
 * Authorization header and the Google provider tokens in the body. We verify
 * the JWT, then upsert the profile and the encrypted tokens with the service
 * role (which bypasses RLS / column grants).
 *
 * Token encryption is AES-256-GCM, payload layout base64(iv[12] || tag[16] ||
 * ciphertext) — byte-compatible with the Node backend's decrypt so the phone
 * assistant can later read these tokens with the same APP_ENCRYPTION_KEY.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GOOGLE_SCOPES_DEFAULT = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/documents",
];

function keyBytes(): Uint8Array {
  const raw = Deno.env.get("APP_ENCRYPTION_KEY");
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not set");
  let bytes: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  } else {
    const bin = atob(raw);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  if (bytes.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex)");
  }
  return bytes;
}

async function encrypt(plain: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes(),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // WebCrypto returns ciphertext||tag (tag is the trailing 16 bytes).
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  const tag = sealed.slice(sealed.length - 16);
  const body = sealed.slice(0, sealed.length - 16);
  // Re-pack as iv || tag || ciphertext to match the Node format.
  const out = new Uint8Array(12 + 16 + body.length);
  out.set(iv, 0);
  out.set(tag, 12);
  out.set(body, 28);
  let bin = "";
  out.forEach((c) => (bin += String.fromCharCode(c)));
  return btoa(bin);
}

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "missing_token" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the caller and get their identity from the token.
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userRes.user) return json(401, { error: "unauthorized" });
  const user = userRes.user;
  const meta = (user.user_metadata ?? {}) as Record<string, string>;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const providerAccess = body.provider_token as string | undefined;
  const providerRefresh = body.provider_refresh_token as string | undefined;
  const scopes = (body.scopes as string[]) ?? GOOGLE_SCOPES_DEFAULT;
  const now = new Date().toISOString();

  // Always keep the profile fresh.
  const { error: profileErr } = await admin.from("jarvis-profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: meta.full_name ?? meta.name ?? null,
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (profileErr) return json(500, { error: "profile_upsert_failed", detail: profileErr.message });

  // Store the Google connection + encrypted tokens (only when we have them).
  if (providerRefresh) {
    const { error: connErr } = await admin.from("jarvis-google-connections").upsert(
      {
        user_id: user.id,
        google_email: user.email,
        google_sub: meta.sub ?? meta.provider_id ?? null,
        access_token: providerAccess ? await encrypt(providerAccess) : null,
        refresh_token: await encrypt(providerRefresh),
        scopes,
        token_expires_at: null,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,google_email" },
    );
    if (connErr) return json(500, { error: "connection_upsert_failed", detail: connErr.message });
  }

  return json(200, { ok: true, stored: !!providerRefresh });
});
