import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand" fill="currentColor" aria-hidden>
        <path d="M12 2c3.6 2.4 5.6 5.6 5.6 9a5.6 5.6 0 0 1-4.6 5.5V22h-2v-5.5A5.6 5.6 0 0 1 6.4 11C6.4 7.6 8.4 4.4 12 2Z" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">Rukh</span>
    </Link>
  );
}

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#landowners", label: "Land Partners" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-foreground/80 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition hover:text-brand">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/login" className="hidden text-sm font-medium hover:text-brand sm:inline">
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-strong"
          >
            Start for free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo />
        <p>© 2026 Rukh · Kathmandu, Nepal</p>
      </div>
    </footer>
  );
}
