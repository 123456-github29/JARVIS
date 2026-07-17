import Link from "next/link";

/** Fixed, blurred top bar — translucent like Apple's global nav. */
export function Nav({ signedIn }: { signedIn?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b hairline bg-black/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-ink">
          JARVIS
        </Link>
        <div className="flex items-center gap-6 text-[13px] text-white/70">
          <Link href="/#features" className="transition-colors hover:text-white">
            Features
          </Link>
          <Link href="/#connect" className="transition-colors hover:text-white">
            Connect
          </Link>
          {signedIn ? (
            <Link href="/dashboard" className="text-accent transition-opacity hover:opacity-80">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-accent transition-opacity hover:opacity-80">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
