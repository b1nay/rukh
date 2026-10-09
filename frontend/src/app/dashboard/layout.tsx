import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";

export const metadata: Metadata = { title: "Dashboard — Rukh" };

// The session lives in the browser (token in localStorage), so dashboard pages
// render on the client after login. Each segment opts out of instant-navigation
// validation until auth moves to a server-readable cookie.
export const instant = false;

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardShell>{children}</DashboardShell>;
}
