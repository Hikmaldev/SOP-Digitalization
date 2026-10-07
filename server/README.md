# SOPly API — Backend

Express 5 + TypeScript API for the SOP Digitalization app (**SOPly**), backed
by **Neon Postgres**. Implements the backend requirements and architecture of
the project brief: a versioning state machine, role-based access control,
department-scoped approvals, and full-text search.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js ≥ 20 (tested on 24) |
| Framework | Express 5 (async errors forwarded natively) |
| Language | TypeScript, strict (`verbatimModuleSyntax`, no enums) |
| Database | Neon Postgres via `pg` Pool — raw SQL, no ORM |
| Auth | JWT (`jose`, HS256) + scrypt password hashing (`node:crypto`) |
| Validation | Zod 4 on every request body/query/params |
| Uploads | Multer memory storage → `StorageDriver` (local disk in dev; object storage provider TBD per PRD) |
| Tests | Vitest (unit) + `scripts/smoke.ts` (end-to-end) |

## Getting started

```bash
cd server
cp .env.example .env        # then fill DATABASE_URL + JWT_SECRET
npm install
npm run db:migrate          # apply db/schema.sql
npm run db:seed             # seed the frontend's mock dataset
npm run dev                 # http://localhost:4000
```

Demo users (seeded, password `Soply123!` for all):

| Email | Role | Department |
| --- | --- | --- |
| alex.rivera@soply.test | author | Finance |
| monica.chen@soply.test | approver | Finance |
| sarah.lee@soply.test | author | People & Culture |
| dev.patel@soply.test | author | IT Operations |
| admin@soply.test | admin | Finance |
| viewer@soply.test | viewer | Operations |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | tsx watch dev server |
| `npm run build` / `start` | esbuild bundle → `dist/`, run with Node |
| `npm run typecheck` / `lint` / `test` | strict TS, oxlint, Vitest (19 tests) |
| `npm run smoke` | end-to-end checks against a running server |
| `npm run db:migrate` / `db:migrate:fresh` | apply schema / drop + re-apply |
| `npm run db:seed` / `db:reset` | seed demo data / fresh + seed |

## API

All routes under `/api`. `Authorization: Bearer <jwt>` required unless noted.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | FR-AUTH-01 email+password → JWT |
| GET | `/auth/me` | any | current user |
| POST | `/auth/password-reset/request` | public | FR-AUTH-04 (dev returns token) |
| POST | `/auth/password-reset/confirm` | public | set new password |
| GET | `/departments` | any | filter/reference data |
| GET | `/users` | admin | list users + departments |
| PATCH | `/users/:userId` | admin | FR-AUTH-03 assign role/department |
| GET | `/sops` | any | list, `?department=`, `?includeDrafts=` |
| POST | `/sops` | author, approver | create SOP + first draft |
| GET | `/sops/:sopId` | any | detail + versions + change log + approvals |
| PATCH | `/sops/:sopId` | author, approver | rename / move department |
| POST | `/sops/:sopId/versions` | author, approver | FR-VER-01 new draft (optional `sourceVersionId`) |
| GET | `/sops/:sopId/versions` | any | version history |
| GET | `/sops/:sopId/versions/:versionId` | any | one version (snapshot for diff) |
| PATCH | `/sops/:sopId/versions/:versionId` | author (own draft) | edit draft content/diagram |
| POST | `/sops/:sopId/versions/:versionId/submit` | author, approver | FR-APR-01 + FR-SOP-05 validation |
| GET | `/approvals` | approver | FR-APR-02 review queue (own department) |
| GET | `/approvals/decided` | approver | recently decided drafts (own department) |
| POST | `/approvals/:versionId/decision` | approver | FR-APR-03 approve/reject (comment required to reject) |
| GET | `/history` | any | FR-VER-02/03 global version history feed (`q`, `status`, `department`) |
| GET | `/search` | any | FR-SRCH-* full-text search |
| POST | `/uploads/diagram` | author, approver | FR-SOP-03 multipart upload (PNG/JPG/PDF ≤ 10 MB) |
| GET | `/health` | public | liveness + DB check |

## Architecture

```
src/
  app.ts / index.ts      express assembly + listener
  config.ts              Zod-validated env
  db.ts                  pg Pool, query helpers, withTransaction
  types.ts               API types (mirror frontend src/types.ts)
  lib/                   errors, jwt, password, permissions, storage, mappers, validate
  middleware/            requireAuth / requireRole, error handler
  services/              auth, user, sop, version, approval, search
  routes/                thin HTTP layer per resource
db/schema.sql            full schema (design doc §4) + FTS + triggers
scripts/                 migrate, seed (imports the frontend mock data), smoke
test/                    state machine, RBAC matrix, password hashing
```

Key invariants, enforced where the design doc says they belong:

- **One published version per SOP, ever** — partial unique index
  `one_published_version_per_sop` in the database itself.
- **No status change skips the state machine** — every transition goes through
  `transitionVersion()` in `services/version.service.ts`.
- **Approval is atomic** — `decideOnVersion()` runs record-decision →
  demote-old → promote-new → repoint-SOP in one transaction, with the version
  row locked `FOR UPDATE`. A second concurrent decision gets a 409
  `invalid_transition`.
- **No version is ever deleted** — there are no delete endpoints; edits create
  new rows.
- **Search reads published only by default**; viewers can never include drafts.

Full-text search uses a generated `tsvector` column (title + body + diagram
annotations) with a GIN index, ranked with exact title match first, then
`ts_rank_cd` (design doc §8).

## Notes and next steps

- **Frontend integration is done** — the React app in `../src` talks to this
  API (login, search, editors, approvals, history). CORS allows
  `http://localhost:5173`.
- **Version numbers are integers** in the database (per the design doc); the
  frontend demo used decimals like `v3.2`.
- **Email delivery for password resets** is a stub: with `EXPOSE_RESET_TOKEN=true`
  the token is returned in the response and logged. Swap in an email provider
  before production.
- **Object storage** is behind `StorageDriver` (`src/lib/storage.ts`); the local
  disk driver is dev-only. Implement the S3-compatible driver once the provider
  is chosen (PRD open question).
- The dev `DATABASE_URL` contains a password for the `soply_owner` role in the
  Neon project `soply-dev`. Rotate it with `ALTER ROLE soply_owner PASSWORD ...`
  and update `.env` whenever needed.
