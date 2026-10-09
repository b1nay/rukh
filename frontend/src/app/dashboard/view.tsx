"use client";

import { AdminOverview } from "@/components/dashboard/admin-overview";
import { ClimateOverview } from "@/components/dashboard/climate-overview";
import { LandOverview } from "@/components/dashboard/land-overview";
import { useSession } from "@/components/dashboard/session";

export function View() {
  const { user } = useSession();
  if (user.side === "admin") return <AdminOverview />;
  return user.side === "organization" ? <ClimateOverview /> : <LandOverview />;
}
