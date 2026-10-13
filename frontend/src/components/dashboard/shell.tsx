"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/site-chrome";
import { ALL_CATEGORIES, ROLES } from "@/lib/content";
import { SolanaProvider, WalletButton } from "@/lib/solana";
import type { UserSide } from "@/lib/types";
import { NotificationBell } from "./notification-bell";
import { Loading } from "./ui";
import { SessionProvider, useSession } from "./session";

type NavItem = { href: string; label: string; icon: string; soon?: boolean };

const NAV: Record<UserSide, NavItem[]> = {
  organization: [
    { href: "/dashboard", label: "Overview", icon: "◎" },
    { href: "/dashboard/trips", label: "Trips", icon: "✈" },
    { href: "/dashboard/itineraries", label: "Itineraries", icon: "☰" },
    { href: "/dashboard/billing", label: "Billing", icon: "▤" },
  ],
  admin: [
    { href: "/dashboard", label: "Overview", icon: "◎" },
    { href: "/dashboard/requests", label: "Requests", icon: "📥" },
    { href: "/dashboard/map", label: "Field map", icon: "◉" },
    { href: "/dashboard/invoices", label: "Invoices", icon: "▤" },
    { href: "/dashboard/payouts", label: "Pay", icon: "◈" },
  ],
  landowner: [
    { href: "/dashboard", label: "Overview", icon: "◎" },
    { href: "/dashboard/fields", label: "My fields", icon: "▦" },
    { href: "/dashboard/earnings", label: "Earnings", icon: "◈" },
    { href: "/dashboard/payments", label: "Payments", icon: "▤" },
  ],
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      fallback={
        <div className="mx-auto w-full max-w-6xl p-8">
          <Loading />
        </div>
      }
    >
      <SolanaProvider>
        <Frame>{children}</Frame>
      </SolanaProvider>
    </SessionProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const items = NAV[user.side];
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const categoryTitle = ALL_CATEGORIES.find((c) => c.id === user.category)?.title;

  return (
    <div className="flex min-h-screen bg-surface-muted/60">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-white px-4 py-5 md:flex">
        <Logo className="px-2" />
        <span className="mx-2 mt-3 w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
          {roleName(user.side)}
        </span>
        <nav className="mt-6 flex-1 space-y-1">
          {items.map((item) =>
            item.soon ? (
              <span key={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted/60">
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive(item.href) ? "bg-brand-soft font-medium text-brand" : "text-foreground/80 hover:bg-surface-muted"
                }`}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="rounded-xl border border-border p-3">
          <p className="truncate text-sm font-medium">{user.display_name}</p>
          <p className="truncate text-xs text-muted">{categoryTitle ?? "Platform control"}</p>
          <button onClick={logout} className="mt-2 text-xs font-medium text-muted hover:text-brand">
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-3 border-b border-border bg-white/80 px-8 backdrop-blur md:flex">
          <span className="text-xs text-muted">{user.display_name}</span>
          <WalletButton />
          <NotificationBell />
        </div>
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-white md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo />
            <div className="flex items-center gap-3">
              <WalletButton />
              <NotificationBell />
              <button onClick={logout} className="text-sm text-muted">
                Log out
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {items
              .filter((i) => !i.soon)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    isActive(item.href) ? "bg-brand-soft font-medium text-brand" : "text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

export function roleName(side: UserSide) {
  return side === "admin" ? "Superadmin" : ROLES[side].name;
}

/** Renders children only for the given role. */
export function RoleOnly({ side, children }: { side: UserSide; children: React.ReactNode }) {
  const { user } = useSession();
  if (user.side !== side) {
    return (
      <p className="rounded-xl border border-border bg-white p-6 text-sm text-muted">
        This page is for {roleName(side)}s. <Link href="/dashboard" className="font-medium text-brand">Go to your overview</Link>
      </p>
    );
  }
  return <>{children}</>;
}
