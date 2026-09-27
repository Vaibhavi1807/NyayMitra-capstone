import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Session } from "../../auth/session";
import {
  KNOWN_PARTIES,
  allowedPartners,
  canChatWith,
  listConversations,
  partyFromSession,
  sendMessage,
  startConversation,
} from "../../api/chatApi";
import type {
  ChatConversation,
  ChatParty,
  ChatTarget,
} from "../../api/chatApi";

import "./ChatPage.css";

/* =========================================================
   CHAT — shared inbox

   One screen serves every role. What differs per role is
   only which dashboard you arrived from, because the role
   matrix lives in chatApi and the "New conversation" picker
   filters through it.

   Arriving with a `target` (e.g. "Chat with Lawyer" on the
   Find-a-Lawyer card) opens that thread immediately instead
   of making the user hunt for it in the list.
   ========================================================= */

type ChatPageProps = {
  session: Session;
  onBack?: () => void;

  /* Thread to open on mount, set by a "Chat" button elsewhere. */
  target?: ChatTarget | null;

  /* Called once the target has been consumed, so App can clear it. */
  onTargetConsumed?: () => void;
};

function formatStamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default function ChatPage({
  session,
  onBack,
  target,
  onTargetConsumed,
}: ChatPageProps) {
  /* Memoized so every downstream callback and effect sees a stable party
     object — an inline `partyFromSession(session)` would be a fresh literal
     each render and React Compiler refuses to memoize over it. */
  const me: ChatParty = useMemo(
    () => partyFromSession(session),
    [session],
  );

  const [threads, setThreads] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const next = await listConversations(me);
    setThreads(next);
    return next;
  }, [me]);

  /* ---- initial load ---- */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await refresh();
        if (!cancelled && next.length > 0) {
          setActiveId((current) => current ?? next[0].id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /* ---- open the thread a "Chat" button asked for ---- */
  useEffect(() => {
    if (!target) return;

    let cancelled = false;

    void (async () => {
      try {
        const thread = await startConversation(
          me,
          {
            id: target.id,
            role: target.role,
            name: target.name,
          },
          target.caseCnr,
        );

        if (cancelled) return;
        setActiveId(thread.id);
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not open the chat.",
          );
        }
      } finally {
        if (!cancelled) onTargetConsumed?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target, me, refresh, onTargetConsumed]);

  /* ---- keep the newest message in view ---- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [activeId, threads]);

  const active =
    threads.find((thread) => thread.id === activeId) ?? null;
  const other = active
    ? (active.parties.find((p) => p.id !== me.id) ?? active.parties[0])
    : null;

  /*
   * Deliberately not wrapped in useCallback: React Compiler memoizes this
   * itself, and manual memoization here was rejected because the draft/sending
   * reads sit inside an async closure the compiler will not preserve.
   */
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || sending) return;

    setSending(true);
    setError(null);

    try {
      await sendMessage(active.id, me, draft);
      setDraft("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Message not sent.",
      );
    } finally {
      setSending(false);
    }
  };

  /* Parties this role is allowed to address — the matrix decides, not us. */
  const startable = KNOWN_PARTIES.filter(
    (party) =>
      party.id !== me.id &&
      canChatWith(me.role, party.role) &&
      !threads.some((thread) =>
        thread.parties.some((p) => p.id === party.id),
      ),
  );

  const openNew = useCallback(
    async (party: ChatParty) => {
      setPicking(false);
      setError(null);

      try {
        const thread = await startConversation(me, party);
        setActiveId(thread.id);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start the chat.",
        );
      }
    },
    [me, refresh],
  );

  return (
    <main className="nyaymitra-page chat-page">
      {onBack && (
        <div className="page-back-wrapper">
          <button className="page-back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>
      )}

      <section className="chat-hero">
        <div className="eyebrow">
          <span>✉</span>
          NYAYMITRA MESSAGES
        </div>

        <h1>
          Your
          <br />
          <span>conversations</span>
        </h1>

        <p>
          {allowedPartners(me.role).length > 0
            ? `As ${me.role === "USER" ? "a citizen" : roleLabel(me.role)}, you can message: ${allowedPartners(me.role)
                .map(roleLabel)
                .join(", ")}.`
            : ""}{" "}
          Every message stays inside the case record.
        </p>
      </section>

      <div className="chat-layout">
        {/* ---------- conversation list ---------- */}

        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <h2>Messages</h2>

            <button
              type="button"
              className="chat-new-btn"
              onClick={() => setPicking((value) => !value)}
            >
              New chat
            </button>
          </div>

          {loading ? (
            <p className="chat-muted">Loading conversations…</p>
          ) : threads.length === 0 ? (
            <div className="chat-empty">
              <p>No conversations yet.</p>
              <p className="chat-muted">
                Start one below, or open a lawyer's profile from
                Find a Lawyer and press “Chat”.
              </p>
            </div>
          ) : (
            <ul className="chat-thread-list">
              {threads.map((thread) => {
                const peer =
                  thread.parties.find((p) => p.id !== me.id) ??
                  thread.parties[0];
                const last = thread.messages[thread.messages.length - 1];

                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      className={`chat-thread-item${
                        thread.id === activeId ? " is-active" : ""
                      }`}
                      onClick={() => setActiveId(thread.id)}
                    >
                      <span className="chat-avatar" aria-hidden="true">
                        {peer.name.charAt(0)}
                      </span>

                      <span className="chat-thread-meta">
                        <span className="chat-thread-top">
                          <strong>{peer.name}</strong>
                          <time>{formatStamp(thread.updatedAt)}</time>
                        </span>

                        <span className="chat-thread-sub">
                          {roleLabel(peer.role)}
                          {thread.caseCnr
                            ? ` · ${thread.caseCnr}`
                            : ""}
                        </span>

                        <span className="chat-thread-preview">
                          {last
                            ? `${last.senderId === me.id ? "You: " : ""}${last.body}`
                            : "No messages yet"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {picking && (
            <div className="chat-picker">
              <p className="chat-picker-title">Start a conversation</p>

              {startable.length === 0 ? (
                <p className="chat-muted">
                  No one new to message right now.
                </p>
              ) : (
                <ul>
                  {startable.map((party) => (
                    <li key={party.id}>
                      <button
                        type="button"
                        onClick={() => void openNew(party)}
                      >
                        <strong>{party.name}</strong>
                        <span>{roleLabel(party.role)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* ---------- thread ---------- */}

        <section className="chat-panel">
          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}

          {!active ? (
            <div className="chat-placeholder">
              <span aria-hidden="true">✉</span>
              <p>Select a conversation to read it.</p>
            </div>
          ) : (
            <>
              <header className="chat-panel-head">
                <span className="chat-avatar" aria-hidden="true">
                  {other?.name.charAt(0)}
                </span>

                <div>
                  <h2>{other?.name}</h2>
                  <p>
                    {other ? roleLabel(other.role) : ""}
                    {active.caseCnr
                      ? ` · Case ${active.caseCnr}`
                      : ""}
                  </p>
                </div>
              </header>

              <div className="chat-messages">
                {active.messages.length === 0 && (
                  <p className="chat-muted">
                    No messages yet — say hello.
                  </p>
                )}

                {active.messages.map((message) => {
                  const mine = message.senderId === me.id;

                  return (
                    <div
                      key={message.id}
                      className={`chat-bubble${mine ? " is-mine" : ""}`}
                    >
                      <p>{message.body}</p>
                      <time>{formatStamp(message.sentAt)}</time>
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </div>

              <form className="chat-composer" onSubmit={(e) => void send(e)}>
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${other?.name ?? ""}…`}
                  aria-label="Message"
                />

                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
