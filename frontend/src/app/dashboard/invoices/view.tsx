"use client";

import { Invoices } from "@/components/dashboard/invoices";
import { RoleOnly } from "@/components/dashboard/shell";
import { PageHeader } from "@/components/dashboard/ui";

export function View() {
  return (
    <RoleOnly side="admin">
      <PageHeader title="Invoices" subtitle="All bills issued to Climate Partners." />
      <Invoices admin />
    </RoleOnly>
  );
}
