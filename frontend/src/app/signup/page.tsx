import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupWizard } from "@/components/signup-wizard";
import { Logo } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Create your account — Rukh" };

type SearchParams = PageProps<"/signup">["searchParams"];

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(45%_35%_at_0%_0%,#dcfce7_0%,transparent_70%),radial-gradient(40%_30%_at_100%_0%,#ecfccb_0%,transparent_70%)]">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-6 sm:px-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />}>
          <Wizard searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Wizard({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const side = pick("side");

  return (
    <SignupWizard
      initialSide={side === "landowner" || side === "organization" ? side : undefined}
      initialCategory={pick("category")}
      plan={pick("plan")}
    />
  );
}
