import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { GoogleButton } from "@/components/GoogleButton";
import { GOOGLE_SERVICES } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: connection } = await supabase
    .from("jarvis-google-connections")
    .select("google_email, scopes, connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const grantedScopes: string[] = connection?.scopes ?? [];
  const meta = user.user_metadata ?? {};
  const name = (meta.full_name as string) ?? (meta.name as string) ?? user.email ?? "there";
  const firstName = name.split(" ")[0];

  return (
    <main className="min-h-screen bg-black">
      <Nav signedIn />

      <div className="mx-auto max-w-4xl px-6 pb-24 pt-28">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tightest">
              Hello, {firstName}.
            </h1>
            <p className="mt-2 text-[15px] text-white/50">
              {connection
                ? `Connected as ${connection.google_email}`
                : "No Google account connected yet."}
            </p>
          </div>
          {meta.avatar_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={meta.avatar_url as string}
              alt=""
              className="h-12 w-12 rounded-full border hairline"
            />
          )}
        </div>

        {/* Connected services */}
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border hairline bg-white/5 sm:grid-cols-2">
          {GOOGLE_SERVICES.map((s) => {
            const connected = grantedScopes.includes(s.scope);
            return (
              <div key={s.key} className="flex items-start justify-between bg-black p-6">
                <div>
                  <div className="text-2xl text-accent">{s.glyph}</div>
                  <h3 className="mt-3 text-lg font-semibold">{s.name}</h3>
                  <p className="mt-1 text-sm text-white/40">{s.description}</p>
                </div>
                <span
                  className={
                    connected
                      ? "mt-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent"
                      : "mt-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/40"
                  }
                >
                  {connected ? "Connected" : "Not connected"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <GoogleButton label={connection ? "Reconnect Google" : "Connect Google"} />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border hairline px-6 py-3 text-[15px] font-medium text-white/70 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>

        <p className="mt-8 max-w-xl text-xs leading-relaxed text-white/30">
          JARVIS stores a revocable Google access token to act on your behalf.
          Revoke anytime at myaccount.google.com/permissions or by signing out.
        </p>
      </div>
    </main>
  );
}
