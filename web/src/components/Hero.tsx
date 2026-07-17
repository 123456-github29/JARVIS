"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section className="aurora relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease }}
        className="mb-5 text-[13px] font-medium uppercase tracking-[0.25em] text-white/50"
      >
        Personal AI · on the phone
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease, delay: 0.05 }}
        className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-tightest sm:text-8xl"
      >
        Just call
        <br />
        <span className="shimmer-text">JARVIS.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease, delay: 0.15 }}
        className="mt-7 max-w-xl text-lg text-white/60 sm:text-xl"
      >
        Your voice, your assistant. It reads and sends your email, saves to
        Drive, manages your calendar, and drafts your docs — while you talk.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease, delay: 0.25 }}
        className="mt-10 flex items-center gap-5"
      >
        <Link
          href="/login"
          className="rounded-full bg-white px-7 py-3 text-[15px] font-medium text-black transition-transform hover:scale-[1.03]"
        >
          Get started
        </Link>
        <Link
          href="/#features"
          className="text-[15px] font-medium text-accent transition-opacity hover:opacity-80"
        >
          Learn more →
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.6 }}
        className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <div className="h-10 w-[1px] bg-gradient-to-b from-white/40 to-transparent" />
      </motion.div>
    </section>
  );
}
