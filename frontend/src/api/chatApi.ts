import type { Role } from "../auth/roles";
import type { Session } from "../auth/session";

/* =========================================================
   CHAT API

   The chat backend has not been delivered yet ("remaining
   APIs will be provided soon"), so this module ships the
   real contract against a localStorage-backed store. The
   pages, navigation and — importantly — the role rules are
   all live and testable today; moving to FastAPI means
   reimplementing the functions below and flipping
   VITE_CHAT_MODE to "api".

   ROLE RULES (as specified)

     USER   may only talk to LAWYER and the STAFF who handle
            user accounts. No direct line to ADMIN.
     LAWYER talks to STAFF and ADMIN, and replies to the
            users who contacted them first.
     STAFF  talk to USER, LAWYER and ADMIN.
     ADMIN  talks to LAWYER and STAFF. Admin authority over
            dashboards is separate (see the admin dashboard).

   The table is symmetric: if A may open a thread with B then
   B lists A too, so neither side can end up unable to see a
   conversation the other can. ADMIN <-> USER is deliberately
   absent on both sides — that follows "user must communicate
   only with lawyer and the staff".
   ========================================================= */

const ALLOWED_PARTNERS: Record<Role, readonly Role[]> = {
  USER: ["LAWYER", "STAFF"],
  LAWYER: ["USER", "STAFF", "ADMIN"],
  STAFF: ["USER", "LAWYER", "ADMIN"],
  ADMIN: ["LAWYER", "STAFF"],
};

export function allowedPartners(role: Role): readonly Role[] {
  return ALLOWED_PARTNERS[role] ?? [];
}

/** Can `role` open a conversation with `other`? Enforced on every send. */
export function canChatWith(role: Role, other: Role): boolean {
  return allowedPartners(role).includes(other);
}

/* =========================================================
   TYPES
   ========================================================= */

export interface ChatParty {
  /* userId for USER/STAFF/ADMIN, lawyer_id for LAWYER. Both are stable keys
     into the same identity space (the demo lawyer's userId === lawyer_id). */
  id: string;
  role: Role;
  name: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: Role;
  body: string;
  sentAt: string;
}

export interface ChatConversation {
  /* Canonical pair key: the two party ids sorted and joined, so A→B and B→A
     always resolve to the same thread. */
  id: string;
  parties: ChatParty[];
  caseCnr?: string;
  messages: ChatMessage[];
  updatedAt: string;
}

/**
 * Who you can address before the real directory endpoint lands. The picker
 * filters this by allowedPartners(), so the matrix is what shapes the list —
 * not a hard-coded button set.
 */
export const KNOWN_PARTIES: ChatParty[] = [
  { id: "USER_0001", role: "USER", name: "Asha Verma" },
  { id: "LAWYER_0003", role: "LAWYER", name: "Adv. Rohan Deshmukh" },
  { id: "STAFF_0001", role: "STAFF", name: "Kavya Iyer" },
  { id: "ADMIN_0001", role: "ADMIN", name: "Site Administrator" },
];

/** Who a screen should open a thread with — set by "Chat" buttons elsewhere. */
export interface ChatTarget {
  id: string;
  name: string;
  role: Role;
  caseCnr?: string;
}

/** The signed-in account as a chat party. */
export function partyFromSession(session: Session): ChatParty {
  return {
    id: session.userId,
    role: session.role,
    name: session.fullName,
  };
}

/* =========================================================
   MOCK SWITCH (mirrors authApi.ts)
   ========================================================= */

const USE_MOCK =
  (import.meta.env.VITE_CHAT_MODE || "mock") !== "api";

const STORAGE_KEY = "nyaymitra.chat.v1";

/* =========================================================
   STORE

   localStorage keeps threads across reloads so a demo can be
   walked through more than once. Everything is read-modify-
   write through read()/write().
   ========================================================= */

function conversationId(a: string, b: string): string {
  return [a, b].sort().join("::");
}

/*
 * In-memory fallback for when localStorage is unavailable — private mode,
 * a full quota, or SSR. Storage is tried first so threads survive reloads;
 * once either call fails we stop touching it and read from `memory` instead,
 * so a failing write can't silently strand the UI on stale data.
 */
let memory: ChatConversation[] | null = null;
let storageUsable = true;

function read(): ChatConversation[] {
  if (!USE_MOCK) return [];

  if (storageUsable) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatConversation[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      storageUsable = false;
    }
  }

  /* First use, or storage has gone: build the seeds once and keep them. */
  if (!memory) {
    memory = buildSeeds();
    write(memory);
  }

  return memory;
}

function write(threads: ChatConversation[]): void {
  memory = threads;

  if (!USE_MOCK || !storageUsable) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch {
    storageUsable = false;
  }
}

/* =========================================================
   SEEDING

   Gives the lawyer and staff dashboards something to show
   on a fresh machine — without this the "who contacted me"
   list would be empty until someone else logged in.
   ========================================================= */

function buildSeeds(): ChatConversation[] {
  const asha: ChatParty = {
    id: "USER_0001",
    role: "USER",
    name: "Asha Verma",
  };
  const rohan: ChatParty = {
    id: "LAWYER_0003",
    role: "LAWYER",
    name: "Adv. Rohan Deshmukh",
  };
  const kavya: ChatParty = {
    id: "STAFF_0001",
    role: "STAFF",
    name: "Kavya Iyer",
  };

  const threads: ChatConversation[] = [
    {
      id: conversationId(asha.id, rohan.id),
      parties: [asha, rohan],
      caseCnr: "PBASB00008022024",
      updatedAt: "2026-09-26T09:14:00.000Z",
      messages: [
        {
          id: "seed-1",
          senderId: asha.id,
          senderRole: "USER",
          body: "Namaste Adv. Deshmukh. I found you on NyayMitra and would like to engage you for my civil suit (CNR PBASB00008022024). The next hearing is on 8 Sep 2026 — could you tell me which documents to bring?",
          sentAt: "2026-09-26T09:10:00.000Z",
        },
        {
          id: "seed-2",
          senderId: rohan.id,
          senderRole: "LAWYER",
          body: "Namaste Asha. I have reviewed the case file. Please bring the sale deed, the property tax receipts for the last three years, and the notice you received from the respondent. We can go over the written statement at the hearing.",
          sentAt: "2026-09-26T09:14:00.000Z",
        },
      ],
    },
    {
      id: conversationId(asha.id, kavya.id),
      parties: [asha, kavya],
      updatedAt: "2026-09-24T13:02:00.000Z",
      messages: [
        {
          id: "seed-3",
          senderId: asha.id,
          senderRole: "USER",
          body: "Hello, I need to update the mobile number registered on my account.",
          sentAt: "2026-09-24T12:58:00.000Z",
        },
        {
          id: "seed-4",
          senderId: kavya.id,
          senderRole: "STAFF",
          body: "Of course. Send me the new number and I will update it and confirm once it is done.",
          sentAt: "2026-09-24T13:02:00.000Z",
        },
      ],
    },
  ];

  write(threads);
  return threads;
}

/* =========================================================
   QUERIES
   ========================================================= */

async function latency(): Promise<void> {
  /* Same trick as authApi: so the UI exercises its real
     loading states instead of only ever rendering instantly. */
  await new Promise((resolve) => setTimeout(resolve, 220));
}

/** Every thread the signed-in party is on either side of, newest first. */
export async function listConversations(
  party: ChatParty,
): Promise<ChatConversation[]> {
  await latency();

  return read()
    .filter((thread) =>
      thread.parties.some((p) => p.id === party.id),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(
  id: string,
): Promise<ChatConversation | null> {
  return read().find((thread) => thread.id === id) ?? null;
}

/**
 * Open (or reuse) a thread with another party.
 *
 * Throws if the role matrix forbids the pairing — the UI also hides the
 * button, but the rule is enforced here so it cannot be reached by any means.
 */
export async function startConversation(
  me: ChatParty,
  other: ChatParty,
  caseCnr?: string,
): Promise<ChatConversation> {
  await latency();

  if (!canChatWith(me.role, other.role)) {
    throw new Error(
      `${me.role} cannot start a conversation with ${other.role}.`,
    );
  }

  const threads = read();
  const id = conversationId(me.id, other.id);
  const existing = threads.find((thread) => thread.id === id);

  if (existing) return existing;

  const created: ChatConversation = {
    id,
    parties: [me, other],
    caseCnr,
    messages: [],
    updatedAt: new Date().toISOString(),
  };

  threads.push(created);
  write(threads);

  return created;
}

export async function sendMessage(
  conversationId_: string,
  me: ChatParty,
  body: string,
): Promise<ChatMessage> {
  await latency();

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const threads = read();
  const thread = threads.find((entry) => entry.id === conversationId_);
  if (!thread) throw new Error("Conversation not found.");

  const other = thread.parties.find((p) => p.id !== me.id) ?? thread.parties[0];

  if (!canChatWith(me.role, other.role)) {
    throw new Error(
      `${me.role} cannot message ${other.role}.`,
    );
  }

  const message: ChatMessage = {
    id: `m_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    senderId: me.id,
    senderRole: me.role,
    body: trimmed,
    sentAt: new Date().toISOString(),
  };

  thread.messages.push(message);
  thread.updatedAt = message.sentAt;
  write(threads);

  return message;
}

/** Test/demo helper — wipes stored threads so the seeds come back. */
export function resetConversations(): void {
  memory = null;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    storageUsable = false;
  }
}
