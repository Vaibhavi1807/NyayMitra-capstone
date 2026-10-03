# NyayMitra — AI Court Assistant

NyayMitra helps three people who usually struggle to talk to each other: a
citizen who does not know what their case's next hearing date is, an advocate
carrying more matters than they can hold in their head, and the court staff and
administrators who keep the record straight. The frontend serves all of them
from one login — the door you choose decides which dashboard you get.

---

## Roles

| Role | Sign in through | Gets |
|------|-----------------|------|
| **Citizen (USER)** | "I am a citizen" | My Cases (new case, documents, chat with the assigned lawyer), Court Orders in plain language, Case Timeline, Delay Analysis, Voice NyayMitra, Find a Lawyer, Translation |
| **Lawyer (LAWYER)** | "I am an advocate" | Active Cases with documents, next hearings and court orders, Messages, an editable profile |
| **Administrator (ADMIN)** | "Administrator / staff" | Every dashboard section, staff account issuance and work assignment, Access & Roles authority grants, user deactivation, lawyer verification |
| **Staff (STAFF)** | **through the Admin door** | Case files, hearings, document processing, **lawyer verification**, task queue, reports — each gated on what the admin granted |

Staff deliberately has no door of its own: an administrator issues the
credentials, and the staff member then signs in through the administrator's
login. The same administrator can grant and revoke each staff authority later
under **Access & Roles**.

---

## Architecture

```text
  Browser
     │  Vite/React (5173 dev, 8080 in Docker)
     ▼
  ┌───────────────────────────────────────────┐
  │  frontend/        React 19 + TypeScript   │  ← talks ONLY to FastAPI
  └───────────────────────────────────────────┘
        │ HTTP + JSON                  │ HTTP + JSON
        ▼                             ▼
  ┌──────────────────┐        ┌───────────────────────────┐
  │ Lawyer API :8000 │        │ NLP service :8001         │
  │ FastAPI + SQLAlchemy       │ FastAPI + IndicTrans2     │
  └──────────────────┘        └───────────────────────────┘
        │                             │
        ▼                             │ local model cache
  ┌──────────────────┐        ┌───────────────────────────┐
  │ PostgreSQL :5432 │        │ HF gated checkpoints       │
  └──────────────────┘        └───────────────────────────┘
```

The frontend never talks to PostgreSQL directly — every read and write goes
through a FastAPI service.

---

## Repository layout

| Path | What it holds |
|------|---------------|
| `frontend/` | React + Vite + TypeScript client. No router: navigation is a state-based `Page` union in `src/App.tsx`. Dependencies are just `react`, `react-dom`, `lucide-react`. |
| `NyayMitra-feature-lawyer-api/` | Lawyer service — profile, listing, practice areas. `main.py`, `lawyer_database.sql`, `requirements.txt`. |
| `NyayMitra-feature-nlp-translation/` | Translation, indic-to-indic, voice, OCR/PDF pipelines. `translate_service.py` is the running app. |
| `docs/` | `auth-decision.md`, `pwa-strategy.md`, `postman/NyayMitra.postman_collection.json` |
| `docker-compose.yml` | Frontend + PostgreSQL only. The two FastAPI services run on the host. |
| `.github/workflows/ci.yml` | Frontend CI: `npm ci` → `npm audit --audit-level=high` → `npm run build`. |

> `translation_service.py` and `DEPRECATED_translation_api.py` are historical
> files. The service launched is `translate_service:app`.

---

## Running it locally

### 1. Database (Docker)

```bash
docker compose up -d database     # postgres:16-alpine on :5432
```

### 2. Lawyer API (:8000)

```powershell
cd NyayMitra-feature-lawyer-api
copy .env.example .env            # then fill in your real DB password
# load lawyer_database.sql into the database once
python -m database.seed_demo_accounts   # demo accounts (idempotent, see below)
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. NLP service (:8001)

Python 3.14, CPU-only. Install torch from its own index first — see the
header of `NyayMitra-feature-nlp-translation/requirements.txt` for the
FFmpeg DLL step Windows needs.

```powershell
cd NyayMitra-feature-nlp-translation
pip install --index-url https://download.pytorch.org/whl/cpu torch==2.11.0+cpu torchaudio==2.11.0+cpu
pip install -r requirements.txt

$env:HF_TOKEN = '<your HuggingFace token>'   # all three models are gated
$env:HF_HUB_OFFLINE = '0'
python -m uvicorn translate_service:app --host 127.0.0.1 --port 8001
```

### 4. Frontend (:5173)

```powershell
cd frontend
copy .env.example .env            # or use the committed example values as-is
npm ci
npm run dev                       # http://localhost:5173
```

Then open **http://localhost:5173** — use `localhost`, not `127.0.0.1`.

---

## Demo credentials (development & testing only)

These are **seeded demo/test accounts — never real user data.** Creating them
is repeatable and idempotent (re-running never duplicates an account):

```powershell
cd NyayMitra-feature-lawyer-api
python -m database.seed_demo_accounts
```

| Role | Email | Password | Profile |
|------|-------|----------|---------|
| USER (citizen) | `asha@example.com` | `user123` | Asha Verma (`is_demo = 1`) |
| LAWYER | `rohan@example.com` | `lawyer123` | Adv. Rohan Deshmukh — `lawyer_id LAWYER_0003`, verification **APPROVED** |
| ADMIN | `admin@nyaymitra.in` | `admin123` | Site Administrator — for Admin Dashboard integration testing only; ADMIN has **no** self-registration path |

- Passwords live in the database only as PBKDF2-HMAC-SHA256 hashes; the
  plaintext above exists in this README and in the seeder's console output
  only. `users.is_demo = 1` marks every seeded account.
- **Production frontend builds never contain these credentials** — they are
  dev-gated (`import.meta.env.DEV`), so a `vite build` bundle has none of
  them; the login page's demo panel appears only in dev builds running
  `VITE_AUTH_MODE=mock`.
- Mock-mode only (never seeded into the database): Staff
  `kavya@nyaymitra.in` / `staff123` — STAFF accounts are issued by ADMIN in
  the offline demo and have no database role.
- In dev mock mode the login page still prints the demo credentials under
  each door.

---

## Environment variables

The frontend reads its own `frontend/.env` — Vite inlines `VITE_*` values at
build time. Everything is documented in `frontend/.env.example`; nothing has to
be set for the app to run.

| Variable | Default | Meaning |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Lawyer service |
| `VITE_TRANSLATION_API_URL` | `http://127.0.0.1:8001` | NLP service |
| `VITE_TRANSLATION_API_KEY` | `nyaymitra-local-test-2026` | Bearer key the NLP service expects |
| `NYAYMITRA_NLP_KEY` | `nyaymitra-local-test-2026` | The service-side half of that key — the NLP service reads it, so the two must be set together |
| `VITE_LAWYER_ID` | `LAWYER_0003` | Profile opened during development; the session overrides it after login |
| `VITE_AUTH_MODE` | `api` | `api` talks to the FastAPI auth endpoints (`/api/auth/register`, `/api/auth/login`); `mock` uses the offline demo accounts (dev builds only — production bundles contain no credentials) |
| `VITE_CHAT_MODE` | `api` | `api` talks to the FastAPI chat endpoints (`/api/chat/...` — conversations persist server-side); `mock` keeps threads in `localStorage` for offline demos |
| `VITE_AUTHORITY_MODE` | *(not read)* | Reserved for `/authorities`. Grants are always kept in `localStorage` today — the flag is documented in `.env.example` but nothing consumes it yet |

`VITE_AUTH_MODE` and `VITE_CHAT_MODE` both default to `api` (the real
FastAPI endpoints), so a missing `.env` is not an error; setting either
to `mock` switches that module to its offline demo store.
On the service side,
`MODEL_IDLE_SECONDS` (default `600`) controls how long a loaded NLP checkpoint
is held before it is released. On the lawyer service, `CASE_DATA_PROVIDER`
(default `development`) picks the case provider behind `/api/cases`,
`CASE_DATASET_PATH` optionally points the development provider at another
dataset file, and `CASE_EXTERNAL_DSN` stays unset until an authorised external
source exists. See [`docs/my-cases.md`](docs/my-cases.md).

---

## What each role can do

**Citizen**
- **My Cases** — only the signed-in user's own matters, filtered by
  `owner_user_id`. From one place: file a **new case** with its first
  documents, open an **ongoing case** to see that case's documents, add
  more to it, and **chat with the lawyer assigned to it**. A **CNR
  search** at the top opens any case by its 16-character CNR — full
  dashboard with status, parties, court, chronological timeline, orders
  and next-steps guidance ([`docs/my-cases.md`](docs/my-cases.md)).
- **Find a Lawyer** — live directory from `GET /api/lawyers`, with a
  **Chat** button per profile.
- **Messages** — the shared inbox against **APPROVED lawyers only**:
  open a thread from a Find-a-Lawyer card or the inbox's New chat
  picker (the picker lists the verified-lawyer directory from
  `GET /api/chat/lawyers`), with full history that survives refresh
  and re-login, and an optional link to a saved case's CNR.
- **Court Order** — upload an image or PDF and the NLP service explains
  it in simple words; orders are listed per ongoing case.
- **Case Timeline** and **Delay Analysis** — pick an ongoing case, then
  read its timeline, or ask for a predicted delay and the reason behind
  it.
- **Voice NyayMitra** — speak, the audio becomes text, and the answer
  comes back as **What to do next** plus an **Urgency of your incident**
  panel.
- **Translation** — translate case documents through the NLP service.

**Lawyer**
- **Active Cases** sits above the profile block, with each matter's
  documents on file, its next court hearing and its court orders.
- **Messages** — one click into the shared inbox, categories for
  clients, staff and other advocates, plus "Message client" buttons on
  each matter.
- **View your profile** opens the full record, where an **Edit profile**
  toggle lets the advocate change their own fields. Verification status
  is deliberately not one of them.

**Administrator**
- **Staff Management** — issue credentials through the Admin door and
  **assign each member the work they do** (case records, hearings,
  document processing, lawyer verification, communications, reports).
- **Manage Users** — switch a citizen account **active or deactivated**;
  a deactivated account is refused at the login door with a plain
  explanation rather than a wrong-password error.
- **Manage Lawyers** — **verify or reject** an advocate's registration
  on the row it belongs to.
- **Messages** — two categories, **from lawyers** and **from staff**.
- **Access & Roles** — staff grouped **by their assigned work**,
  authorities grouped **into categories**, with grant and revoke per
  category and per authority.
- Lawyer Records and Platform Data are unchanged.

**Staff**
- Case Files, Hearings, Document Processing, **Lawyer Verification**,
  Task Queue, Reports — each section opens only if its authority is
  granted, and otherwise reads **Not granted** rather than failing when
  clicked.
- Their own **work assignment** at the top of the dashboard, and a live
  **Your authorities** panel grouped by the same categories Access &
  Roles uses.
- Verification runs on the same store the admin writes to, so a ruling
  made as staff shows up on the admin's screens and vice versa.

### Communication matrix

Who may start a chat with whom:

| | Citizen | Lawyer | Staff | Admin |
|---|---|---|---|---|
| **Citizen** | — | ✅ | ✅ | ❌ |
| **Lawyer** | ✅ | — | ✅ | ✅ |
| **Staff** | ✅ | ✅ | — | ✅ |
| **Admin** | ❌ | ✅ | ✅ | — |

Citizen ↔ Admin is deliberately absent: a citizen reaches the administration
through staff. The matrix is enforced in `src/api/chatApi.ts`, not by hiding
buttons.

Two lists are derived from that one matrix:

- **`allowedPartners`** — who a role may exchange messages with.
- **`visiblePartners`** — who becomes a sidebar category and a "new
  conversation" entry point. It differs in exactly one place: an advocate
  browses **Clients / Lawyers / Staff** (the three the brief asks for)
  and does not navigate by an Admin channel, while the administrator
  still opens threads with advocates — which is what puts its
  **From lawyers** category to work.

---

## Service APIs

**Lawyer service — `:8000`**

| Method | Path | Used by |
|--------|------|---------|
| GET | `/api/lawyers` | Find a Lawyer, admin Manage Lawyers / Platform Data |
| GET | `/api/lawyers/{lawyer_id}` | Lawyer profile, admin Lawyer Records |
| GET | `/api/practice-areas` | Practice-area filtering |
| GET | `/api/cases` | My Cases list (`q`, `status`, `state`, `page`, `limit`) |
| GET | `/api/cases/cnr/{cnr}` | My Cases detail — 400 malformed / 404 unknown |
| GET | `/api/cases/meta` | Status and court filters for My Cases |

> The **list** response is a summary: `enrollment_number`, `bar_council`,
> `practice_areas` and `profile_status` are blank there. They are only present
> on the **detail** endpoint, which is why Lawyer Records resolves each row
> through it.

**NLP service — `:8001`**

| Method | Path |
|--------|------|
| POST | `/api/translate` |
| POST | `/api/translate/indic-to-indic` |
| POST | `/api/voice` |
| POST | `/api/guidance` |
| POST | `/api/explain-order` |
| POST | `/api/court-order/explain` |
| POST | `/api/court-order/extract` |
| GET | `/health` |

All three model checkpoints are gated on HuggingFace. They are loaded lazily
on first use and released after `MODEL_IDLE_SECONDS`, which brings the idle
footprint from roughly 4.5 GB down to about 370 MB.

`/api/explain-order` turns an uploaded court order into plain language;
`/api/court-order/explain` is the newer pipeline: it accepts a multipart
PDF upload (or the old pasted-text body) and returns a stable shape of
`summary` plus the five document sections — Case Details, Proceedings,
Order, Signatures, Document Certification — with `metadata.ocr_used`,
`page_count` and the security scan result. Uploaded files are validated
(PDF only, size cap), scanned for active content, extracted to a temp
file that is always deleted, and never executed; sections the document
does not contain come back as `"Not available in the document."` rather
than as invented text.

Every answer — the document and each of its sections — arrives in three
layers:

```text
layers.legal       the order exactly as the court wrote it
layers.simple      the same words, in everyday English
layers.translated  that plain English in हिंदी / मराठी
```

The middle layer is a deterministic rewrite of *wording* only
(`court_order_simple_english.py`): "the matter is adjourned" becomes
"the hearing has been postponed", while names, dates, case numbers and
citations pass through untouched, and a passage with no plain
equivalent is left exactly as written. The translation model is given
that layer rather than the legalese, so step three reads the way a
person would say it. Ask for `language=hi` or `language=mr` (form field
on an upload, `language` in a JSON body for pasted text) to get step
three; English answers with two layers.

`/api/guidance` is the rule scorer behind **Voice NyayMitra**. A rule
matches on *coverage* — how much of the rule's own phrasing the question
actually covers — rather than on the raw score, because a near-miss can
out-score a genuine match.

---

## Testing and CI

```powershell
cd NyayMitra-feature-lawyer-api
python -m pytest              # 37 checks: CNR validation, timeline, orders,
                              # provider failures — no server, no network
python tests/smoke_cases_api.py http://127.0.0.1:8000   # against a live server
```

```powershell
cd NyayMitra-feature-nlp-translation
$env:TRANSLATION_API_URL = 'http://127.0.0.1:8001'
$env:PYTHONUTF8 = '1'
python -u e2e_check.py          # 6 checks across translate / indic-to-indic / voice
```

```powershell
cd frontend
npm test                       # 34 checks: CNR lookup, case dashboard, Tell Us What Happened
npx tsc -b                      # types
npx eslint .                    # lint — note the react-hooks rules are on
npm run build                   # tsc + vite build
```

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and `feature/**` and
on pull requests to `main`.

---

## Known gaps

These are real and deliberately left visible rather than papered over:

- **Case data is development data, not eCourts.** `GET /api/cases` and
  `GET /api/cases/cnr/{cnr}` now exist and serve 109 CNR records through
  `cases/provider.py`, but the default `DevelopmentCaseProvider` reads a
  file built from the project's own captures — every response says so in
  `data_source.live_ecourts_data: false`. `AuthorizedExternalCaseProvider`
  is the stub for a real authorised source and refuses to answer until
  `CASE_EXTERNAL_DSN` is set; nothing is scraped from eCourts.
- **Authority grants, account status and chat *deletion* are
  `localStorage` mocks.** `authorityApi.ts` (work assignment lives
  here too) and `accountApi.ts` mirror the real shapes so each swap
  is a one-file change when the endpoints arrive. `chatApi.ts` now
  runs against the live `/api/chat` endpoints by default (its
  localStorage store is kept behind `VITE_CHAT_MODE=mock`), and the
  inbox hides its delete control in API mode because the server
  keeps message history by design — there is no delete endpoint.
  The verification overlay in `lawyerApi.ts` is
  still a local mock as well — its backend (`/api/admin/lawyers`)
  is live now and documented in the Postman collection, waiting for
  the Admin Dashboard to be pointed at it.
- **Auth now runs on the lawyer service** (it used to be frontend-mock
  only): `POST /api/auth/register`, `POST /api/auth/register/lawyer`,
  `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  and `GET /api/auth/lawyer/profile`, plus the ADMIN-only lawyer
  verification API (`GET/PATCH /api/admin/lawyers[/{lawyer_id}]`),
  backed by one SQLite file (`data/nyaymitra.db`,
  schema `database/auth_schema.sql`). Lawyer registration lands
  `PENDING`; only an ADMIN can move it to `APPROVED`/`REJECTED`
  (self-approval is refused server-side). The register page offers
  **Create User Account** or **Create Lawyer Account**; the lawyer
  form adds optional profile fields (bar council, experience, phone,
  bio) and uploads the licence document in the same submission:
  `POST /api/auth/lawyer/verification-document` (multipart, PDF/JPG/
  PNG, max 10 MB, magic-byte checked, one replaceable copy per
  lawyer under the gitignored `data/uploads/verification/`, never
  served statically). Bytes leave the server only through the
  lawyer's own `GET /api/auth/lawyer/verification-document` or the
  ADMIN-only `GET /api/admin/lawyers/{lawyer_id}/document`, and the
  registration/list/detail responses carry the document *metadata*
  (`document: {filename, mime_type, size_bytes, sha256, uploaded_at}`
  or `null`) for the admin dashboard to display. Until an admin
  approves, the register page and the lawyer dashboard say
  "Your lawyer registration is pending admin verification." The
  schema is portable SQL reserved for a later PostgreSQL migration;
  the legacy Postgres tables are untouched. Account deactivation is
  still a frontend-only mock.
- **Chat runs on the lawyer service** (Phase 3): `GET /api/chat/lawyers`
  lists APPROVED lawyers only (PENDING/REJECTED never appear; no email,
  licence id or phone leaves the server), `GET/POST
  /api/chat/conversations` is the citizen side, `GET/POST
  /api/chat/lawyer/conversations` the verified-lawyer side, and
  `GET /api/chat/conversations/{id}[/messages]` plus
  `POST .../messages` read and append history — plain HTTP, no
  WebSockets, one thread per (citizen, lawyer) pair that is reused
  rather than duplicated, with an optional `case_cnr` link (4 letters
  + 12 digits, same format `cases/routes.py` enforces) to My Cases.
  Identity always comes from the bearer session: payloads cannot name
  a sender or an owner (extra identity fields are 422), threads are
  visible only to their two participants (anyone else gets 404, so
  ids cannot be probed), PENDING/REJECTED lawyers get 403 with their
  own status, and signed-out requests get 401. Messages persist in the
  same `data/nyaymitra.db` (`conversations`/`messages` already in
  `database/auth_schema.sql` — no new tables, no schema change). The
  shared inbox (`ChatPage`) uses the API by default
  (`VITE_CHAT_MODE=api`); its New chat picker shows the verified
  directory, and the ✕ delete control appears only in mock mode.
  Covered by `tests/test_chat_api.py`, `chatApi.test.ts`,
  `ChatPage.test.tsx` and the `Chat (User ↔ Lawyer)` folder of the
  Postman collection.
- **Newly issued staff fall back to default authorities and no work
  assignment.** Staff issued during a session do not appear in the seeded
  account list until reload.
- **Urgency has no model.** Voice NyayMitra's *Urgency of your incident*
  panel says so plainly rather than inventing a number; the endpoint is
  awaited.
- **Delay prediction has no model.** Delay Analysis shows the ongoing
  cases and the **Predict Delay** control with its reasoning, but the
  result panel is a placeholder until the model API lands.
- **`LAWYER_0003` differs between mock and API.** The mock session calls it
  Adv. Rohan Deshmukh; the database has another advocate at that ID.
- **React Compiler is not enabled.** `react()` is called without `compiler: true`
  and `oxc-transform-react` is not installed — only its lint rules arrive via
  `eslint-plugin-react-hooks`. Do not rely on automatic memoization.

---

## Further reading

- [`frontend/README.md`](frontend/README.md) — Vite template notes, ESLint setup
- [`NyayMitra-feature-lawyer-api/README.md`](NyayMitra-feature-lawyer-api/README.md) — lawyer API integration guide
- [`docs/auth-decision.md`](docs/auth-decision.md) — how sign-in decides the role
- [`docs/my-cases.md`](docs/my-cases.md) — My Cases: CNR lookup, case dashboard, the development dataset and its provider
- [`docs/pwa-strategy.md`](docs/pwa-strategy.md) — offline strategy
- [`docs/postman/NyayMitra.postman_collection.json`](docs/postman/NyayMitra.postman_collection.json) — API collection
