"use client";

import Link from "next/link";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";
import {
  ALL_CATEGORIES,
  Category,
  LANDOWNER_CATEGORIES,
  ORGANIZATION_CATEGORIES,
  PLANS,
  ROLES,
  Side,
} from "@/lib/content";
import { CATEGORY_FIELDS, Field } from "@/lib/signup-fields";

type Values = Record<string, string | string[]>;
type Step = "role" | "type" | "account" | "verify" | "details";
type Account = { full_name: string; email: string; phone: string; password: string };

const STEPS: { id: Step; label: string }[] = [
  { id: "role", label: "Role" },
  { id: "type", label: "Type" },
  { id: "account", label: "Account" },
  { id: "verify", label: "Verify" },
  { id: "details", label: "Details" },
];

type Props = { initialSide?: Side; initialCategory?: string; plan?: string };

/**
 * Next.js keeps hidden pages mounted (React Activity), so a finished sign-up would
 * reappear on the next visit. Once an account is created, remount a fresh wizard
 * when the page is hidden. An unfinished sign-up keeps its progress when the
 * user returns through the same link.
 */
export function SignupWizard(props: Props) {
  const [run, setRun] = useState(0);
  const finished = useRef(false);

  useLayoutEffect(
    () => () => {
      if (finished.current) {
        finished.current = false;
        setRun((r) => r + 1);
      }
    },
    [],
  );

  // A different entry link (?side=, ?category=, ?plan=) also starts a fresh wizard.
  const key = [run, props.initialSide, props.initialCategory, props.plan].join("|");
  return <Wizard key={key} {...props} onFinished={() => (finished.current = true)} />;
}

function Wizard({ initialSide, initialCategory, plan, onFinished }: Props & { onFinished: () => void }) {
  const preset = ALL_CATEGORIES.find((c) => c.id === initialCategory);
  const [side, setSide] = useState<Side | undefined>(preset?.side ?? initialSide);
  const [category, setCategory] = useState<Category | undefined>(preset);
  const [step, setStep] = useState<Step>(preset ? "account" : initialSide ? "type" : "role");
  const [account, setAccount] = useState<Account>({ full_name: "", email: "", phone: "", password: "" });
  const [profile, setProfile] = useState<Values>({});
  const [done, setDone] = useState(false);
  const [verified, setVerified] = useState<{ destination: string; token: string } | null>(null);

  const channel: Channel = side === "landowner" ? "phone" : "email";
  const destination = account[channel].trim();
  const isVerified = verified?.destination === destination;

  if (done && category) return <Success category={category} name={account.full_name} />;

  const pickSide = (s: Side) => {
    if (s !== side) {
      setCategory(undefined);
      setProfile({});
    }
    setSide(s);
    setStep("type");
  };

  const pickCategory = (c: Category) => {
    if (c.id !== category?.id) setProfile({});
    setCategory(c);
    setStep("account");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Progress current={step} />
      {step === "role" && <RoleStep selected={side} onPick={pickSide} />}
      {step === "type" && side && (
        <TypeStep side={side} selected={category} onPick={pickCategory} onBack={() => setStep("role")} />
      )}
      {step === "account" && side && category && (
        <AccountStep
          side={side}
          category={category}
          value={account}
          onChange={setAccount}
          onBack={() => setStep("type")}
          onNext={() => setStep(isVerified ? "details" : "verify")}
        />
      )}
      {step === "verify" && side && category && (
        <VerifyStep
          channel={channel}
          destination={destination}
          onBack={() => setStep("account")}
          onVerified={(token) => {
            setVerified({ destination, token });
            setStep("details");
          }}
        />
      )}
      {step === "details" && side && category && (
        <DetailsStep
          category={category}
          plan={side === "organization" ? plan : undefined}
          account={account}
          otpToken={isVerified ? verified!.token : ""}
          values={profile}
          onChange={setProfile}
          onBack={() => setStep("account")}
          onDone={() => {
            setDone(true);
            onFinished();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Progress ---------- */

function Progress({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="mb-10">
      <div className="flex justify-between text-xs font-medium">
        {STEPS.map((s, i) => (
          <span key={s.id} className={i <= index ? "text-brand" : "text-muted"}>
            {i + 1}. {s.label}
          </span>
        ))}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StepHead({ title, body, onBack }: { title: string; body?: string; onBack?: () => void }) {
  return (
    <div className="mb-8">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-3 text-sm text-muted hover:text-brand">
          ← Back
        </button>
      )}
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {body && <p className="mt-2 text-sm text-muted">{body}</p>}
    </div>
  );
}

/* ---------- Step 1: role ---------- */

function RoleStep({ selected, onPick }: { selected?: Side; onPick: (s: Side) => void }) {
  return (
    <div>
      <StepHead title="How would you like to join Rukh?" body="Choose how you'll use Rukh." />
      <div className="grid gap-5 sm:grid-cols-2">
        {(Object.keys(ROLES) as Side[]).map((s) => {
          const role = ROLES[s];
          const active = selected === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className={`card-tint group flex flex-col rounded-2xl border p-7 text-left transition hover:border-brand hover:shadow-[0_16px_40px_-20px_rgba(22,163,74,0.35)] ${
                active ? "border-brand ring-1 ring-brand/30" : "border-border"
              }`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-white text-2xl shadow-sm">
                {role.icon}
              </span>
              <p className="mt-5 text-xl font-semibold">{role.name}</p>
              <p className="mt-1 text-sm text-muted">{role.tagline}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {role.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckIcon /> {p}
                  </li>
                ))}
              </ul>
              <span className="mt-6 text-sm font-medium text-brand">
                Continue as {role.name} <span className="inline-block transition group-hover:translate-x-1">→</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium text-brand">Login</Link>
      </p>
    </div>
  );
}

/* ---------- Step 2: type ---------- */

function TypeStep({
  side,
  selected,
  onPick,
  onBack,
}: {
  side: Side;
  selected?: Category;
  onPick: (c: Category) => void;
  onBack: () => void;
}) {
  const list = side === "organization" ? ORGANIZATION_CATEGORIES : LANDOWNER_CATEGORIES;
  return (
    <div>
      <StepHead
        title={side === "organization" ? "What kind of organization are you?" : "What kind of land do you manage?"}
        body="We'll only ask for what's relevant to you."
        onBack={onBack}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((c) => {
          const active = selected?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className={`flex items-start gap-4 rounded-2xl border bg-white p-5 text-left transition hover:border-brand ${
                active ? "border-brand ring-1 ring-brand/30" : "border-border"
              }`}
            >
              <span
                className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-brand" : "border-border"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
              </span>
              <span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{c.title}</span>
                  {c.fit === "Coming soon" && (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted">Waitlist</span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-muted">{c.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Step 3: account ---------- */

function AccountStep({
  side,
  category,
  value,
  onChange,
  onBack,
  onNext,
}: {
  side: Side;
  category: Category;
  value: Account;
  onChange: (a: Account) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isLand = side === "landowner";
  const set = (k: keyof Account) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <form onSubmit={submit}>
      <StepHead title="Create your account" body={`${ROLES[side].name} · ${category.title}`} onBack={onBack} />
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label={isLand ? "Full name (पूरा नाम)" : "Your name"} required value={value.full_name} onChange={set("full_name")} autoComplete="name" />
          {isLand ? (
            <Input label="Mobile number" type="tel" required placeholder="98XXXXXXXX" value={value.phone} onChange={set("phone")} autoComplete="tel" />
          ) : (
            <Input label="Work email" type="email" required value={value.email} onChange={set("email")} autoComplete="email" />
          )}
          {isLand ? (
            <Input label="Email" type="email" hint="Optional" value={value.email} onChange={set("email")} autoComplete="email" />
          ) : (
            <Input label="Phone" type="tel" hint="Optional" value={value.phone} onChange={set("phone")} autoComplete="tel" />
          )}
          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            hint="Min. 8 characters"
            value={value.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </div>
      </div>
      <Actions next="Continue" />
    </form>
  );
}

/* ---------- Step 4: verify ---------- */

type Channel = "phone" | "email";
const RESEND_SECONDS = 30;

function VerifyStep({
  channel,
  destination,
  onBack,
  onVerified,
}: {
  channel: Channel;
  destination: string;
  onBack: () => void;
  onVerified: (token: string) => void;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const sentFor = useRef<string | null>(null);

  async function send() {
    setError(null);
    try {
      const res = await api.post<{ demo_code: string | null }>("/api/v1/auth/otp/send", { channel, destination });
      setDemoCode(res.demo_code);
      setCooldown(RESEND_SECONDS);
      inputs.current[0]?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code");
    }
  }

  useEffect(() => {
    if (sentFor.current === destination) return;
    sentFor.current = destination;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ otp_token: string }>("/api/v1/auth/otp/verify", { channel, destination, code });
      onVerified(res.otp_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
      setBusy(false);
    }
  }

  function setDigit(i: number, raw: string) {
    const chars = raw.replace(/\D/g, "");
    if (!chars) {
      setDigits((d) => d.map((v, j) => (j === i ? "" : v)));
      return;
    }
    // Typing one digit or pasting the whole code both work.
    const next = [...digits];
    for (let k = 0; k < chars.length && i + k < 4; k++) next[i + k] = chars[k];
    setDigits(next);
    const filled = next.findIndex((v) => !v);
    if (filled === -1) verify(next.join(""));
    else inputs.current[filled]?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (digits.every(Boolean)) verify(digits.join(""));
  }

  return (
    <form onSubmit={submit}>
      <StepHead
        title={channel === "phone" ? "Verify your mobile number" : "Verify your email"}
        body={`We sent a 4-digit code to ${destination}.`}
        onBack={onBack}
      />
      <div className="card-tint rounded-2xl border border-border p-6 sm:p-8">
        <div className="flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              disabled={busy}
              className="h-14 w-12 rounded-xl border border-border bg-white text-center text-2xl font-semibold outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 sm:h-16 sm:w-14"
            />
          ))}
        </div>
        {demoCode && (
          <p className="mx-auto mt-5 w-fit rounded-full bg-brand-soft px-3 py-1 text-xs text-brand-strong">
            Demo mode: no message is sent. Use code <span className="font-semibold">{demoCode}</span>
          </p>
        )}
        <p className="mt-5 text-center text-sm text-muted">
          Didn&apos;t get it?{" "}
          {cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <button type="button" onClick={send} className="font-medium text-brand">
              Resend code
            </button>
          )}
        </p>
      </div>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Actions next={busy ? "Verifying…" : "Verify"} disabled={busy || !digits.every(Boolean)} />
    </form>
  );
}

/* ---------- Step 5: details ---------- */

function DetailsStep({
  category,
  plan,
  account,
  otpToken,
  values,
  onChange,
  onBack,
  onDone,
}: {
  category: Category;
  plan?: string;
  account: Account;
  otpToken: string;
  values: Values;
  onChange: (v: Values) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const fields = CATEGORY_FIELDS[category.id] ?? [];
  const isLand = category.side === "landowner";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const planName = PLANS.find((p) => p.id === plan)?.name;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const profile: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      profile[f.name] = f.type === "number" ? Number(v) : v;
    }
    setSubmitting(true);
    try {
      const res = await api.post<AuthResponse>("/api/v1/signup", {
        category: category.id,
        plan: plan ?? null,
        account: {
          full_name: account.full_name,
          email: account.email || null,
          phone: account.phone || null,
          password: account.password,
        },
        profile,
        otp_token: otpToken,
      });
      setToken(res.token);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <StepHead
        title={isLand ? "Tell us about your land" : "Tell us about your organization"}
        body={planName ? `${category.title} · ${planName} plan` : category.title}
        onBack={onBack}
      />
      {fields.length > 0 ? (
        <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f) => (
              <DynamicField key={f.name} field={f} value={values[f.name]} onChange={(v) => onChange({ ...values, [f.name]: v })} />
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-white p-6 text-sm text-muted">Nothing else needed.</p>
      )}
      {isLand && (
        <p className="mt-4 rounded-xl bg-brand-soft p-3 text-xs text-brand-strong">
          Next, you&apos;ll draw your field on a satellite map and add trees by species. It takes about five minutes.
        </p>
      )}
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Actions
        next={submitting ? "Creating account…" : category.fit === "Coming soon" ? "Join the waitlist" : "Create account"}
        disabled={submitting}
      />
    </form>
  );
}

function Actions({ next, disabled }: { next: string; disabled?: boolean }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {next} <span aria-hidden>→</span>
      </button>
    </div>
  );
}

/* ---------- Success ---------- */

function Success({ category, name }: { category: Category; name: string }) {
  const router = useRouter();
  const waitlist = category.fit === "Coming soon";
  const isLand = category.side === "landowner";
  const next = isLand
    ? ["Draw your field on the map", "Add trees by species and age", "We verify by satellite", "Get matched and paid"]
    : ["Upload your first traveler list", "Review the CO₂ per trip", "Choose Protect or Plant", "Share tree maps"];

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-3xl">🌱</div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        {waitlist ? "You're on the list" : `Welcome, ${name.split(" ")[0]}!`}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {waitlist
          ? "We'll email you when individual traveler accounts open."
          : `Your ${ROLES[category.side].name} account is ready${isLand ? " and pending verification" : ""}.`}
      </p>
      {!waitlist && (
        <div className="card-tint mt-8 rounded-2xl border border-border p-6 text-left">
          <p className="text-sm font-semibold">Your next steps</p>
          <ol className="mt-4 space-y-3 text-sm">
            {next.map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-white text-xs font-semibold text-brand">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      )}
      <button
        type="button"
        onClick={() => router.push(waitlist ? "/" : isLand ? "/dashboard/fields/new" : "/dashboard/trips/new")}
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-strong"
      >
        {waitlist ? "Back to home" : isLand ? "Add your first field" : "Add your first trip"} <span aria-hidden>→</span>
      </button>
    </div>
  );
}

/* ---------- Inputs ---------- */

const inputCls =
  "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

function Label({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <span className="flex items-baseline justify-between text-sm font-medium">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </span>
  );
}

function Input({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <Label label={label} required={props.required} hint={hint} />
      <input {...props} className={inputCls} />
    </label>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const span = field.half ? "" : "sm:col-span-2";

  if (field.type === "chips") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={span}>
        <Label label={field.label} required={field.required} hint={field.hint} />
        <div className="mt-2 flex flex-wrap gap-2">
          {field.options!.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  on ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-brand/50"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <label className={`block ${span}`}>
        <Label label={field.label} required={field.required} hint={field.hint} />
        <select required={field.required} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="" disabled>
            Select…
          </option>
          {field.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={`block ${span}`}>
      <Label label={field.label} required={field.required} hint={field.hint} />
      <input
        type={field.type}
        required={field.required}
        placeholder={field.placeholder}
        min={field.type === "number" ? 0 : undefined}
        step={field.type === "number" ? "any" : undefined}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand" fill="currentColor" aria-hidden>
      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3-4 4a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4L9 10.6l3.3-3.3a1 1 0 0 1 1.4 1.4Z" />
    </svg>
  );
}
