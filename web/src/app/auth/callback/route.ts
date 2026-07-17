import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { GOOGLE_SCOPES } from "@/lib/google";

/**
 * Google → Supabase OAuth callback.
 *
 * Exchanges the auth code for a session (setting cookies), then captures the
 * Google provider tokens — which Supabase only hands back this once — and
 * stores them, encrypted, via the service-role client. The browser never
 * sees the refresh token beyond the httpOnly session cookie.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { session } = data;
  const user = session.user;
  const meta = user.user_metadata ?? {};
  const admin = createAdminClient();

  // Upsert the JARVIS profile.
  await admin.from("jarvis-profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: meta.full_name ?? meta.name ?? null,
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  // Store the Google connection + tokens (encrypted at rest).
  if (session.provider_refresh_token) {
    await admin.from("jarvis-google-connections").upsert(
      {
        user_id: user.id,
        google_email: user.email,
        google_sub: (meta.sub as string) ?? (meta.provider_id as string) ?? null,
        access_token: session.provider_token ? encrypt(session.provider_token) : null,
        refresh_token: encrypt(session.provider_refresh_token),
        scopes: GOOGLE_SCOPES,
        token_expires_at: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,google_email" }
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
