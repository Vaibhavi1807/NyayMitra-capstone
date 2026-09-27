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
| **Citizen (USER)** | "I am a citizen" | My Cases, Find a Lawyer, chat with a lawyer or staff, translated case documents |
| **Lawyer (LAWYER)** | "I am an advocate" | Profile, active caseload with full matter detail, chat with clients and staff |
| **Administrator (ADMIN)** | "Administrator / staff" | Every dashboard section, staff account issuance, Access & Roles authority grants |
| **Staff (STAFF)** | **through the Admin door** | Case files, hearings, document processing, task queue, reports — each gated on what the admin granted |

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
  `owner_user_id`; stages, hearing dates, timeline and metrics.
- **Find a Lawyer** — live directory from `GET /api/lawyers`, with a
  **Chat** button per profile.
- **Dashboard Chat** — a card that opens a conversation with a chosen lawyer.
- Translated case documents and voice input through the NLP service.

**Lawyer**
- Profile and practice areas from the lawyer service.
- **Active Cases** — matters where `handling_lawyer_id` matches the session,
  with parties, stage, presiding judge, schedule and full history.
- **Messages** — one click into the shared inbox, plus "Message client"
  buttons on each matter, so a lawyer always sees who contacted them.

**Administrator**
- Staff management (issue credentials through the Admin door).
- **Access & Roles** — grant or revoke each staff authority individually, or
  grant-all / revoke-all. The admin's own row is fixed at full authority.
- Manage Users, Manage Lawyers, Lawyer Records, Platform Data.

**Staff**
- Case Files, Hearings, Document Processing, Task Queue, Reports — each
  section opens only if its authority is granted, and otherwise reads
  **Not granted** rather than failing when clicked.
- A live **Your authorities** panel listing what this account holds.

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
| GET | `/health` |

All three model checkpoints are gated on HuggingFace. They are loaded lazily
on first use and released after `MODEL_IDLE_SECONDS`, which brings the idle
footprint from roughly 4.5 GB down to about 370 MB.

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
- **Chat and authority grants are `localStorage` mocks.** They mirror the
  real shapes so the swap is a one-file change when the endpoints arrive.
- **No `/api/auth/login`** on the lawyer service, so `VITE_AUTH_MODE=api` is
  wired but not yet usable; `mock` is the working mode.
- **Newly issued staff fall back to default authorities.** Staff issued during
  a session do not appear in the seeded account list until reload.
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
