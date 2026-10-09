"use client";

import { Invoices } from "@/components/dashboard/invoices";
import { RoleOnly } from "@/components/dashboard/shell";
import { PageHeader } from "@/components/dashboard/ui";

export function View() {
  return (
    <RoleOnly side="organization">
      <PageHeader title="Billing" subtitle="Every bill you've received from Rukh, and its payment status." />
      <Invoices />
    </RoleOnly>
  );
}
