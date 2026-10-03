import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Session } from "../../auth/session";
import {
  KNOWN_PARTIES,
  deleteConversation,
  listConversations,
  partyFromSession,
  sendMessage,
  startConversation,
  visiblePartners,
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

/* How the sidebar names each category. The name describes the person on
   the other end, so one map serves every role: a lawyer reads USER threads
   as "Clients", a citizen reads LAWYER threads as "Lawyers", and an admin
   sees exactly the two categories it is meant to have. */
const CATEGORY_LABEL: Record<string, string> = {
  USER: "Clients",
  LAWYER: "Lawyers",
  STAFF: "Staff",
  ADMIN: "Admin",
};

/* The few places where the viewer's own role changes the wording. The
   administrator reads its two channels as inboxes rather than as people
   — "From lawyers" and "From staff", which is what those two categories
   are for. The advocate's list is named exactly as the brief asks:
   clients, lawyers, staff. */
const VIEWER_CATEGORY_LABEL: Record<string, Record<string, string>> = {
  ADMIN: { LAWYER: "From lawyers", STAFF: "From staff" },
  STAFF: { ADMIN: "Admins" },
};

function categoryLabel(viewer: string, peer: string): string {
  return (
    VIEWER_CATEGORY_LABEL[viewer]?.[peer] ??
    CATEGORY_LABEL[peer] ??
    roleLabel(peer)
  );
}

/* The empty-list sentence. It has to be built from the label because the
   label is a sentence fragment in two different ways: "clients" is a kind
   of person, "from lawyers" is a direction. */
function emptyConversations(viewer: string, filter: string): string {
  if (filter === "all") return "No conversations here yet.";

  const label = categoryLabel(viewer, filter);

  if (label.startsWith("From ")) {
    return `No messages ${label.toLowerCase()} yet.`;
  }

  return `No conversations with ${label.toLowerCase()} yet.`;
}

/* The party on the other end of a thread. */
function peerOf(thread: ChatConversation, myId: string): ChatParty {
  return thread.parties.find((p) => p.id !== myId) ?? thread.parties[0];
}

export default function ChatPage({
  session,
  onBack,
  target,
  onTargetConsumed,
}: ChatPageProps) {
  /* Memoized so every downstream callback and effect sees a stable party
     object. An inline `partyFromSession(session)` would give `refresh` a
     fresh dep on every render, which re-runs the initial-load effect —
     and its fetch — on every render. */
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

  /* Which category the list is showing, and the thread the ✕ is armed on.
     Deletion asks twice: the control sits a single click from the
     conversation it destroys, and something irreversible should not be one
     slip away. */
  const [filter, setFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
   * Deliberately not wrapped in useCallback. The eslint react-hooks config
   * rejects a manual one here, because the draft and sending reads sit in
   * an async closure it cannot prove stable — and none is needed: `send` is
   * only ever bound to onSubmit, never listed in an effect's deps, so no
   * effect re-runs when its identity changes.
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

  /* Deleting a thread. The arm state clears on either outcome, so the ✕
     never stays sitting on "Delete?" after a failure. */
  const remove = async (id: string) => {
    setError(null);

    try {
      await deleteConversation(id);

      /* The open thread may be the one going — drop it rather than leave
         the panel reading a conversation that no longer exists. */
      if (activeId === id) setActiveId(null);

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Conversation not deleted.",
      );
    } finally {
      setPendingDelete(null);
    }
  };

  /* The sidebar's categories: every role this account may address, each
     with its count, so the grouping reads even while a category is still
     empty. Derived from the matrix rather than written into the JSX —
     when the rules change, these change with them. */
  const categories = [
    { key: "all", label: "All", count: threads.length },
    ...visiblePartners(me.role).map((role) => ({
      key: role,
      label: categoryLabel(me.role, role),
      count: threads.filter((thread) => peerOf(thread, me.id).role === role)
        .length,
    })),
  ];

  const visibleThreads =
    filter === "all"
      ? threads
      : threads.filter((thread) => peerOf(thread, me.id).role === filter);

  /* Parties this role may start a thread with — the visible list, so
     somebody cannot open a conversation that has no category to file
     it under. Replies into an existing thread are checked separately
     against the full matrix. */
  const startable = KNOWN_PARTIES.filter(
    (party) =>
      party.id !== me.id &&
      visiblePartners(me.role).includes(party.role) &&
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
          {visiblePartners(me.role).length > 0
            ? `As ${me.role === "USER" ? "a citizen" : roleLabel(me.role)}, you can message: ${visiblePartners(me.role)
                .map((role) => CATEGORY_LABEL[role]?.toLowerCase() ?? roleLabel(role))
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
              onClick={() => {
                setPicking((value) => !value);
                setPendingDelete(null);
              }}
            >
              {picking ? "Close" : "＋ New chat"}
            </button>
          </div>

          {loading ? (
            <p className="chat-muted chat-center">Loading conversations…</p>
          ) : threads.length === 0 ? (
            <div className="chat-empty">
              <p>No conversations yet.</p>
              <p className="chat-muted">
                Start one below, or open a lawyer's profile from
                Find a Lawyer and press “Chat”.
              </p>
            </div>
          ) : (
            <>
              <div className="chat-cats">
                {categories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={`chat-cat${
                      filter === category.key ? " is-on" : ""
                    }`}
                    aria-pressed={filter === category.key}
                    onClick={() => {
                      setFilter(category.key);
                      setPendingDelete(null);
                    }}
                  >
                    {category.label}
                    <span>{category.count}</span>
                  </button>
                ))}
              </div>

              {visibleThreads.length === 0 ? (
                <p className="chat-muted chat-center">
                  {emptyConversations(me.role, filter)}
                </p>
              ) : (
                <ul className="chat-thread-list">
                  {visibleThreads.map((thread) => {
                    const peer = peerOf(thread, me.id);
                    const last = thread.messages[thread.messages.length - 1];
                    const armed = pendingDelete === thread.id;

                    return (
                      <li key={thread.id} className="chat-thread-row">
                        <button
                          type="button"
                          className={`chat-thread-item${
                            thread.id === activeId ? " is-active" : ""
                          }`}
                          onClick={() => {
                            setActiveId(thread.id);
                            setPendingDelete(null);
                          }}
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

                        <button
                          type="button"
                          className={`chat-thread-delete${
                            armed ? " is-armed" : ""
                          }`}
                          aria-label={
                            armed
                              ? `Confirm deleting the conversation with ${peer.name}`
                              : `Delete the conversation with ${peer.name}`
                          }
                          onClick={() => {
                            if (armed) void remove(thread.id);
                            else setPendingDelete(thread.id);
                          }}
                        >
                          {armed ? "Delete" : "✕"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
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
