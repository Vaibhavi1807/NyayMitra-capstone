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

## Demo credentials

| Role | Email | Password | ID |
|------|-------|----------|----|
| Citizen | `asha@example.com` | `user123` | `USER_0001` (Asha Verma) |
| Lawyer | `rohan@example.com` | `lawyer123` | `LAWYER_0003` (Adv. Rohan Deshmukh) |
| Administrator | `admin@nyaymitra.in` | `admin123` | `ADMIN_0001` |
| Staff | `kavya@nyaymitra.in` | `staff123` | `STAFF_0001` (Kavya Iyer) |

The login page prints these under each door.

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
| `VITE_LAWYER_ID` | `LAWYER_0003` | Profile opened during development; the session overrides it after login |
| `VITE_AUTH_MODE` | `mock` | `mock` works today; `api` expects `POST /api/auth/login` |
| `VITE_CHAT_MODE` | `mock` | Conversations kept in `localStorage` until chat endpoints land |
| `VITE_AUTHORITY_MODE` | *(not read)* | Reserved for `/authorities`. Grants are always kept in `localStorage` today — the flag is documented in `.env.example` but nothing consumes it yet |

Both switches that *are* read (`VITE_AUTH_MODE`, `VITE_CHAT_MODE`) default to
`mock` when unset, so a missing `.env` is not an error. On the service side,
`MODEL_IDLE_SECONDS` (default `600`) controls how long a loaded NLP checkpoint
is held before it is released.

---

## What each role can do

**Citizen**
- **My Cases** — only the signed-in user's own matters, filtered by
  `owner_user_id`. From one place: file a **new case** with its first
  documents, open an **ongoing case** to see that case's documents, add
  more to it, and **chat with the lawyer assigned to it**.
- **Find a Lawyer** — live directory from `GET /api/lawyers`, with a
  **Chat** button per profile.
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
| GET | `/health` |

All three model checkpoints are gated on HuggingFace. They are loaded lazily
on first use and released after `MODEL_IDLE_SECONDS`, which brings the idle
footprint from roughly 4.5 GB down to about 370 MB.

`/api/explain-order` turns an uploaded court order into plain language;
`/api/guidance` is the rule scorer behind **Voice NyayMitra**. A rule
matches on *coverage* — how much of the rule's own phrasing the question
actually covers — rather than on the raw score, because a near-miss can
out-score a genuine match.

---

## Testing and CI

```powershell
cd NyayMitra-feature-nlp-translation
$env:TRANSLATION_API_URL = 'http://127.0.0.1:8001'
$env:PYTHONUTF8 = '1'
python -u e2e_check.py          # 6 checks across translate / indic-to-indic / voice
```

```powershell
cd frontend
npx tsc -b                      # types
npx eslint .                    # lint — note the react-hooks rules are on
npm run build                   # tsc + vite build
```

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and `feature/**` and
on pull requests to `main`.

---

## Known gaps

These are real and deliberately left visible rather than papered over:

- **No cases endpoint.** `GET /api/cases` returns 404; case records live in
  `src/mocks/cases.ts` and `owner_user_id` / `handling_lawyer_id` are local
  fields on top of them.
- **Chat, authority grants, account status and lawyer verification are
  `localStorage` mocks.** They mirror the real shapes so each swap is a
  one-file change when the endpoints arrive: `chatApi.ts`,
  `authorityApi.ts` (work assignment lives here too), `accountApi.ts`
  and the verification overlay in `lawyerApi.ts`.
- **No `/api/auth/login`** on the lawyer service, so `VITE_AUTH_MODE=api` is
  wired but not yet usable; `mock` is the working mode. The deactivation
  check sits ahead of both modes, so it survives that switch.
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
- [`docs/pwa-strategy.md`](docs/pwa-strategy.md) — offline strategy
- [`docs/postman/NyayMitra.postman_collection.json`](docs/postman/NyayMitra.postman_collection.json) — API collection
