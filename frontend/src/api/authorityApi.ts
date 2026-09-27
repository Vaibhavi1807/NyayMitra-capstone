/* =========================================================
   AUTHORITY API

   The administrator holds every authority and delegates a
   subset to staff. Which subset is decided here; the admin
   screen only toggles flags, and the staff dashboard reads
   them back.

   Mock-backed like the other pending endpoints — flip
   VITE_AUTHORITY_MODE to "api" and reimplement the three
   functions below once FastAPI exposes /authorities.

   The catalogue deliberately mirrors the staff dashboard's
   sections one-for-one, so a grant maps onto a real screen
   instead of a flag nothing reads.
   ========================================================= */

export interface Authority {
  id: string;
  label: string;
  description: string;
}

export const AUTHORITY_CATALOG: Authority[] = [
  {
    id: "cases.update",
    label: "Update case files",
    description:
      "Edit case records, attach documents and mark filing status.",
  },
  {
    id: "hearings.view",
    label: "View hearings",
    description:
      "See upcoming hearings, cause lists and court activities.",
  },
  {
    id: "documents.process",
    label: "Process documents",
    description:
      "Upload and process court orders through OCR and PDF pipelines.",
  },
  {
    id: "messages.send",
    label: "Message users and lawyers",
    description:
      "Hold conversations with citizens and advocates on assigned matters.",
  },
  {
    id: "reports.submit",
    label: "Submit reports",
    description:
      "File daily activity summaries to the administrator.",
  },
];

export const AUTHORITY_IDS: string[] = AUTHORITY_CATALOG.map(
  (authority) => authority.id,
);

/** What a newly issued staff account starts with. */
export const DEFAULT_AUTHORITIES: string[] = [
  "cases.update",
  "hearings.view",
  "messages.send",
];

/* =========================================================
   STORE

   Same shape as chatApi: localStorage first, an in-memory
   copy behind it so a blocked quota degrades instead of
   dropping every grant the admin has set.
   ========================================================= */

const STORAGE_KEY = "nyaymitra.authorities.v1";

type GrantMap = Record<string, string[]>;

let memory: GrantMap | null = null;
let storageUsable = true;

function readGrants(): GrantMap {
  if (storageUsable) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GrantMap;
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      storageUsable = false;
    }
  }

  memory ??= {};
  return memory;
}

function writeGrants(next: GrantMap): void {
  memory = next;

  if (!storageUsable) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    storageUsable = false;
  }
}

/* =========================================================
   QUERIES
   ========================================================= */

/**
 * Authorities held by one staff member. Unknown accounts fall back to
 * DEFAULT_AUTHORITIES so an account issued before this existed is not
 * silently locked out of everything.
 */
export function getAuthoritiesFor(staffUserId: string): string[] {
  const grants = readGrants();
  const stored = grants[staffUserId];

  if (Array.isArray(stored)) return stored;

  return [...DEFAULT_AUTHORITIES];
}

export function hasAuthority(
  staffUserId: string,
  authorityId: string,
): boolean {
  return getAuthoritiesFor(staffUserId).includes(authorityId);
}

/**
 * Grant or revoke one authority for one staff member.
 *
 * Returns the resulting list so callers can render the new state without
 * a second read.
 */
export function setAuthorityFor(
  staffUserId: string,
  authorityId: string,
  on: boolean,
): string[] {
  if (!AUTHORITY_IDS.includes(authorityId)) {
    throw new Error(`Unknown authority: ${authorityId}`);
  }

  const grants = readGrants();
  const current = new Set(getAuthoritiesFor(staffUserId));

  if (on) {
    current.add(authorityId);
  } else {
    current.delete(authorityId);
  }

  const next = [...current];
  writeGrants({ ...grants, [staffUserId]: next });

  return next;
}

/**
 * Replace a staff member's authorities wholesale — used by the "grant all" /
 * "revoke all" controls so the admin does not have to click through five rows.
 */
export function setAuthoritiesFor(
  staffUserId: string,
  authorityIds: string[],
): string[] {
  const unknown = authorityIds.filter(
    (id) => !AUTHORITY_IDS.includes(id),
  );

  if (unknown.length > 0) {
    throw new Error(`Unknown authorities: ${unknown.join(", ")}`);
  }

  const grants = readGrants();
  const next = [...new Set(authorityIds)];

  writeGrants({ ...grants, [staffUserId]: next });

  return next;
}

/**
 * The administrator holds everything. Exposed so the admin screen can show
 * its own row as locked-on rather than as just another grantable list.
 */
export const ADMIN_AUTHORITIES: readonly string[] = AUTHORITY_IDS;
