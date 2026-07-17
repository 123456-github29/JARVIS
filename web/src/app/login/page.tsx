import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/GoogleButton";
import { GOOGLE_SERVICES } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  missing_code: "Sign-in was cancelled. Try again.",
  exchange_failed: "We couldn't complete sign-in. Please try again.",
  auth: "Something went wrong signing you in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="aurora flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-semibold text-white/60 transition-colors hover:text-white">
          ← JARVIS
        </Link>

        <div className="mt-8 rounded-3xl border hairline bg-white/[0.03] p-10 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold tracking-tightest">Connect to JARVIS</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/50">
            Sign in with the Google account you want JARVIS to work with. You'll
            grant access to these services:
          </p>

          <ul className="mt-6 space-y-2">
            {GOOGLE_SERVICES.map((s) => (
              <li key={s.key} className="flex items-center gap-3 text-[15px] text-white/80">
                <span className="text-accent">{s.glyph}</span>
                {s.name}
              </li>
            ))}
          </ul>

          {error && (
            <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {ERRORS[error] ?? ERRORS.auth}
            </p>
          )}

          <div className="mt-8">
            <GoogleButton />
          </div>

          <p className="mt-6 text-xs leading-relaxed text-white/30">
            By continuing you allow JARVIS to access the Google services above on
            your behalf. You can revoke access anytime from your Google Account
            settings.
          </p>
        </div>
      </div>
    </main>
  );
}
