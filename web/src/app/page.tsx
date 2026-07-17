import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { GOOGLE_SERVICES } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="bg-black">
      <Nav signedIn={!!user} />
      <Hero />

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-5xl px-6 py-32">
        <Reveal>
          <h2 className="max-w-2xl text-4xl font-semibold tracking-tightest sm:text-5xl">
            One number. Everything handled.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-white/50">
            JARVIS connects to the Google apps you already use and acts on them
            for you — no tapping, no typing.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border hairline bg-white/5 sm:grid-cols-2">
          {GOOGLE_SERVICES.map((s, i) => (
            <Reveal key={s.key} delay={i * 0.06}>
              <div className="h-full bg-black p-8">
                <div className="text-3xl text-accent">{s.glyph}</div>
                <h3 className="mt-5 text-xl font-semibold">{s.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/50">
                  {s.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="border-y hairline bg-white/[0.02] py-32">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <h2 className="text-4xl font-semibold tracking-tightest sm:text-5xl">
              How it works
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            {[
              { n: "01", t: "Connect", d: "Sign in and grant JARVIS access to your Google account — Gmail, Drive, Calendar, and Docs." },
              { n: "02", t: "Call", d: "Dial your JARVIS number and just talk. It understands and gets to work in real time." },
              { n: "03", t: "Done", d: "Emails sent, files saved, events booked. JARVIS confirms each action out loud." },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 0.08}>
                <div>
                  <div className="text-sm font-medium text-white/30">{step.n}</div>
                  <h3 className="mt-3 text-2xl font-semibold">{step.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/50">{step.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Connect CTA ──────────────────────────────────────────── */}
      <section id="connect" className="mx-auto max-w-5xl px-6 py-36 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tightest sm:text-6xl">
            Connect your Google account.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/50">
            It takes about thirty seconds. Your credentials stay with Google —
            JARVIS only ever holds a revocable access token.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-block rounded-full bg-white px-8 py-3.5 text-[15px] font-medium text-black transition-transform hover:scale-[1.03]"
            >
              {user ? "Go to dashboard" : "Get started"}
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-10 text-[13px] text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>JARVIS</span>
          <span>Your voice. Your assistant. On the line.</span>
        </div>
      </footer>
    </main>
  );
}
