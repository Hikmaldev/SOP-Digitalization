# 📋 SOPly — SOP & Business Process Digitalization

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Neon Postgres](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT%20HS256-000000)
![License](https://img.shields.io/badge/License-MIT-green)

**SOPly** is a full-stack application for digitalizing Standard Operating Procedures (SOPs)&nbsp;— from authoring a draft, through a real approval workflow, to versioned publication with a full audit trail. Built with **React 19 + Vite** on the frontend and an **Express 5 + Neon Postgres** API on the backend.

> *"Turn procedures into living documents — author, review, publish, and audit."*

---

## ✨ Key Features

### 📚 SOP Library & Search
- Full-text search over titles, bodies, and diagram annotations (Postgres FTS + GIN index), ranked with exact title matches first
- Filter by department, include drafts (authors only), open read-only SOP detail for viewers
- Live search-as-you-type with highlighted matches

### ✍️ Authoring & Versioning
- Draft editor with title, department, and rich body content
- Visual **process-flow diagram editor** — add task / decision / start / end shapes; connectors are drawn dynamically as a measured SVG overlay
- Every edit creates a new version — **no version is ever deleted** (immutable history)
- Unpublished statuses (draft / pending) are visible **only inside the SOP's own department**

### ✅ Approval Workflow
- Approver queue scoped to the approver's department with a pending count badge
- Side-by-side **line diff** of the published version vs. the draft under review
- Approve & publish / reject with a required comment
- Transactional & atomic: a second concurrent decision gets a `409 invalid_transition` — and only **one published version per SOP can ever exist** (enforced in the database itself)

### 🕘 Version History & Audit
- Global audit feed with search, status, and department filters
- Every change stores the old and new body, change summary, author, and timestamp

### 🧑‍💼 Admin Management
- **Departments** — directory of all 8 departments with member counts, published-SOP coverage, and an "Unassigned" card
- **People & roles** — change any user's role or department, row-locked for your own account (so you can't lock yourself out)

### 🔐 Role-Based Access
| Role | Access |
|---|---|
| `viewer` | read published SOPs only |
| `author` | create/edit drafts and submit them for approval (own department) |
| `approver` | everything an author can do + review/decide drafts (own department) |
| `admin` | superuser + **Departments** and **People & roles** management |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (strict, `verbatimModuleSyntax`) |
| **Build** | [Vite 8](https://vite.dev/) |
| **Routing** | [React Router 8](https://reactrouter.com/) (`createBrowserRouter`, protected shell) |
| **Styling** | Plain CSS (ported from the static prototype) |
| **Backend** | [Express 5](https://expressjs.com/) + TypeScript (strict) |
| **Database** | [Neon Serverless Postgres](https://neon.tech/) via `pg` — raw SQL, no ORM |
| **Authentication** | JWT HS256 with [`jose`](https://github.com/panva/jose) + scrypt password hashing (`node:crypto`) |
| **Validation** | [Zod 4](https://zod.dev/) on every request |
| **Uploads** | Multer memory storage → `StorageDriver` (local disk in dev) |
| **Security** | `helmet`, `cors`, `express-rate-limit` |
| **Linting** | [oxlint](https://oxc.rs/) (0 warnings) |
| **Tests** | [Vitest](https://vitest.dev/) (19 unit) + smoke suite + [TestSprite](https://testsprite.com/) E2E (10 tests) |

---

## 🗂️ Project Structure

```
SOP-Digitalization/
├── src/                      # React SPA (Vite, :5173)
│   ├── api/                  # fetch client + JWT, endpoints, useApi hooks
│   ├── components/           # layout/ (Sidebar, Topbar), FlowDiagram, Badge, Button, … 
│   ├── pages/                # one component per screen
│   ├── context/              # auth + workspace providers
│   ├── lib/display.ts        # labels, avatars, relative time, formatting
│   └── data/mock.ts          # seed dataset (imported by the server seed)
├── server/                   # Express 5 API (:4000)
│   ├── src/                  # routes, services, middleware, lib, db
│   ├── db/schema.sql         # full schema + FTS + triggers
│   └── scripts/              # migrate, seed, smoke
├── static/                   # original HTML/CSS prototype (reference)
├── testsprite-plans/         # TestSprite E2E test plans (10 tests)
├── .env.example              # VITE_API_URL template
└── package.json              # workspaces: root (app) + server
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ (backend tested on v24)
- A [Neon](https://neon.tech/) account (free) — the API needs a Postgres database

### 1. Clone & Install

```bash
git clone https://github.com/Hikmaldev/SOP-Digitalization.git
cd SOP-Digitalization
npm install
cd server && npm install && cd ..
```

### 2. Setup Environment Variables

```bash
cp .env.example .env            # frontend — VITE_API_URL (default http://localhost:4000)
cp server/.env.example server/.env   # backend — DATABASE_URL + JWT_SECRET
```

Edit `server/.env`:

```env
# Neon connection string (neon.tech → Dashboard → Connection Details)
DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require

# Any random string — signs the JWT HS256 tokens
JWT_SECRET=your-random-secret-key-min-32-chars
```

### 3. Setup Database

```bash
cd server
npm run db:migrate   # apply db/schema.sql (once)
npm run db:seed      # demo dataset (re-run to reset)
```

### 4. Run the App

Two terminals — backend first, frontend second:

```bash
# terminal 1 — API on http://localhost:4000
cd server
npm run dev

# terminal 2 — SPA on http://localhost:5173
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you'll land on the login screen.

---

## 🔑 Demo Accounts

Every seeded user shares the password `Soply123!` (click a chip on the login screen to fill one in):

| Email | Role | Department | Can do |
|---|---|---|---|
| `alex.rivera@soply.test` | author | Finance | create/edit Finance SOPs, submit drafts |
| `monica.chen@soply.test` | approver | Finance | everything above + approve/reject |
| `viewer@soply.test` | viewer | Operations | read published SOPs only |
| `admin@soply.test` | admin | Finance | superuser — **Departments** & **People & roles** (sidebar → Manage) |

---

## 🔄 Feature Flows

1. **Create and publish** — sign in as Alex → *Create new SOP* → fill the form → *Continue to diagram* (saves the draft, opens the diagram editor) → add shapes / upload a file → back to the draft → *Submit for approval*.
2. **Approve** — sign in as Monica → *Approval queue* → compare published vs. draft (line diff) → *Approve & publish*. Search now finds it; the previous published version is marked superseded; the queue badge clears.
3. **Reject and revise** — reject a draft with a comment; as the author, open the SOP and *Start draft* from the rejected version.
4. Watch the **Overview** metrics, **Version history** audit feed, and **SOP library** results update from real data as you go.

---

## 🧪 Testing

### Frontend

```bash
npm run build      # type-check (tsc -b) + production build
npm run lint       # oxlint — 0 warnings
```

### Backend (server/)

```bash
npm run typecheck  # strict TS
npm test           # Vitest — 19 unit tests (state machine, RBAC matrix, hashing)
npm run smoke      # end-to-end checks against a running server (re-seed afterwards)
```

### End-to-End (TestSprite)

Browser E2E tests live in a TestSprite project (`c52c2a07-68ce-40b0-a660-7fe1a164e9a3`); source plans are in `testsprite-plans/`. 10 tests cover login (valid + wrong password), search + SOP detail, process-flow diagram rendering, draft creation, submit-for-approval, the approver queue, version history, and the admin pages.

```bash
testsprite test run --all --project c52c2a07-68ce-40b0-a660-7fe1a164e9a3 \
  --local 5173 --local-host localhost            # all tests, one tunnel
```

> **Note:** local E2E runs hit the real dev database and the draft/submit tests write test data — re-run `npm run db:seed` afterwards to restore the demo dataset (each FE run costs 0.5 credit).

---

## 📡 API Endpoints

All routes are under `/api`. `Authorization: Bearer <jwt>` required unless noted.

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Email + password → JWT |
| `GET` | `/api/auth/me` | any | Current user |
| `POST` | `/api/auth/password-reset/request` | public | Request reset (dev returns token) |
| `POST` | `/api/auth/password-reset/confirm` | public | Set new password |
| `GET` | `/api/departments` | any | Filter / reference data |
| `GET` | `/api/users` | admin | List users + departments |
| `PATCH` | `/api/users/:userId` | admin | Assign role / department |
| `GET` | `/api/sops` | any | List (`?department=`, `?includeDrafts=`) |
| `POST` | `/api/sops` | author, approver | Create SOP + first draft |
| `GET` | `/api/sops/:sopId` | any | Detail + versions + change log + approvals |
| `PATCH` | `/api/sops/:sopId` | author, approver | Rename / move department |
| `POST` | `/api/sops/:sopId/versions` | author, approver | New draft (optional `sourceVersionId`) |
| `GET` | `/api/sops/:sopId/versions` | any | Version history |
| `GET` | `/api/sops/:sopId/versions/:versionId` | any | One version (snapshot for diff) |
| `PATCH` | `/api/sops/:sopId/versions/:versionId` | author (own draft) | Edit draft content / diagram |
| `POST` | `/api/sops/:sopId/versions/:versionId/submit` | author, approver | Submit for approval |
| `GET` | `/api/approvals` | approver | Review queue (own department) |
| `GET` | `/api/approvals/decided` | approver | Recently decided drafts |
| `POST` | `/api/approvals/:versionId/decision` | approver | Approve / reject (comment required to reject) |
| `GET` | `/api/history` | any | Global version history feed (`q`, `status`, `department`) |
| `GET` | `/api/search` | any | Full-text search |
| `POST` | `/api/uploads/diagram` | author, approver | Multipart diagram upload (PNG/JPG/PDF ≤ 10 MB) |
| `GET` | `/api/health` | public | Liveness + DB check |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (SPA :5173)                       │
│        React 19 + Vite · React Router 8 · plain CSS          │
│        JWT stored in localStorage (restored via /auth/me)     │
└──────────────────────────────┬───────────────────────────────┘
                               │  CORS: http://localhost:5173
                 ┌─────────────▼─────────────┐
                 │      Express 5 API (:4000) │
                 │  routes → services → db    │
                 │  middleware: requireAuth / │
                 │  requireRole · helmet ·    │
                 │  cors · rate-limit · Zod   │
                 └─────────────┬─────────────┘
                               │  pg Pool (raw SQL, transactions)
                 ┌─────────────▼─────────────┐
                 │      Neon Postgres         │
                 │  FTS tsvector + GIN index  │
                 │  one_published_version_per_sop (unique index) │
                 └────────────────────────────┘
```

**State machine & invariants**, enforced where the design brief says they belong:

- **One published version per SOP, ever** — partial unique index in the database itself
- **No status change skips a step** — every transition goes through `transitionVersion()`, including a `409 invalid_transition` when a draft was already decided
- **Approval is atomic** — record decision → demote old → promote new → repoint SOP in one transaction with the version row locked `FOR UPDATE`
- **Search reads published content by default**; viewers can never include drafts
- **No version is ever deleted** — there are no delete endpoints

---

## 🔒 Security

- **JWT HS256** signed with `jose`, verified on every protected route
- **Scrypt password hashing** with a random salt (`node:crypto`) — plaintext passwords never stored
- **Role middleware** (`requireRole`) enforces the author/approver/viewer/admin matrix on every endpoint
- **Department-scoped visibility** — drafts and pending reviews are only readable by the SOP's own department; viewers always see published content
- **Zod 4 validation** on every request body, query, and params
- **helmet + cors + rate limiting** applied at the API edge
- **Input sanitization** on body content before it is stored or searched

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an *issue* or *pull request* for bug fixes, new features, or documentation improvements.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

<p align="center">
  Built with ❤️ so procedures stay alive, searchable, and versioned
</p>