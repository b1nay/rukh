"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";
import { Modal } from "./modal";

const POLL_MS = 10_000;

/** Message thread between a Climate Partner and Rukh about one allocation request. */
export function Correspondence({ requestId, title, onClose }: { requestId: number; title: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<Message[]>(`/api/v1/requests/${requestId}/messages`)
        .then((m) => alive && setMessages(m))
        .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't load messages"));
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [requestId]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const m = await api.post<Message>(`/api/v1/requests/${requestId}/messages`, { body });
      setMessages((ms) => [...(ms ?? []), m]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      title="Messages"
      subtitle={title}
      onClose={onClose}
      footer={
        <form onSubmit={send} className="flex w-full items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            rows={2}
            placeholder="Write a message… (Enter to send)"
            className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <button disabled={sending || !body.trim()} className="rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50">
            Send
          </button>
        </form>
      }
    >
      <div className="min-h-48 space-y-3">
        {messages === null && <p className="text-sm text-muted">Loading…</p>}
        {messages?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No messages yet. Ask about fields, timing or the bill. The other side gets notified.</p>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface-muted"}`}>
              {!m.mine && <p className="mb-0.5 text-[11px] font-semibold text-brand">{m.sender}</p>}
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? "text-white/70" : "text-muted"}`}>
                {new Date(m.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}

export function MessageButton({ count, onClick, label = "Message Rukh" }: { count: number; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand">
      💬 {label}
      {count > 0 && <span className="rounded-full bg-surface-muted px-1.5 text-xs text-muted">{count}</span>}
    </button>
  );
}
