import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { GOOGLE_SCOPES } from "@/lib/google";

/**
 * Google → Supabase OAuth callback.
 *
 * Exchanges the auth code for a session (setting cookies), then hands the
 * Google provider tokens — which Supabase returns only this once — to the
 * `jarvis-store-connection` Supabase Edge Function. That function holds the
 * service-role key and encryption key, so no secrets live in this app: the
 * web host only ever needs the public Supabase URL + anon key.
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

  // Persist profile + encrypted Google tokens via the Edge Function. The user's
  // access token authorizes the call; the function verifies it server-side.
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/jarvis-store-connection`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider_token: session.provider_token,
        provider_refresh_token: session.provider_refresh_token,
        scopes: GOOGLE_SCOPES,
      }),
    });
  } catch {
    // Non-fatal: the user is signed in. They can hit "Reconnect" on the
    // dashboard to retry storing their Google connection.
  }

  return NextResponse.redirect(`${origin}${next}`);
}
