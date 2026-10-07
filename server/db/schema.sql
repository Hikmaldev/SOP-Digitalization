-- ============================================================================
-- SOPly — Neon Postgres schema
-- Mirrors the data model in design-sop-digitalization.md §4, with two
-- additions required by the PRD: auth tables and diagram annotation text
-- for full-text search (FR-SRCH-01).
-- Run with: npm run db:migrate
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('author', 'approver', 'viewer', 'admin')),
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  title TEXT NOT NULL,
  current_published_version_id UUID, -- nullable until first publish
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sop_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES sops(id),
  version_number INT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'pending_approval', 'published', 'superseded', 'rejected')
  ),
  body_content TEXT,
  diagram_data JSONB,       -- shapes/edges if built with the in-app editor
  diagram_file_url TEXT,    -- uploaded image/PDF path, if used instead
  annotation_text TEXT,     -- text annotations placed on uploaded diagrams (FR-SRCH-01)
  title_cache TEXT,         -- denormalized SOP title, kept in sync by trigger
  change_summary TEXT,      -- why this version was created
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(title_cache, '') || ' ' || coalesce(body_content, '') || ' ' || coalesce(annotation_text, '')
    )
  ) STORED,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sop_id, version_number)
);

-- Circular FK: the SOP points at its current published version.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sops_current_published_version_fk'
  ) THEN
    ALTER TABLE sops
      ADD CONSTRAINT sops_current_published_version_fk
      FOREIGN KEY (current_published_version_id) REFERENCES sop_versions(id);
  END IF;
END $$;

-- The database itself enforces "only one published version per SOP, ever"
-- (design doc §4). Not decoration: a bug cannot silently corrupt the library.
CREATE UNIQUE INDEX IF NOT EXISTS one_published_version_per_sop
  ON sop_versions (sop_id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS sop_search_idx ON sop_versions USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS version_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_version_id UUID NOT NULL REFERENCES sop_versions(id),
  changed_by UUID NOT NULL REFERENCES users(id),
  change_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_version_id UUID NOT NULL REFERENCES sop_versions(id),
  approver_id UUID NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Fill title_cache from the parent SOP on insert, so search_vector has a title.
CREATE OR REPLACE FUNCTION fill_version_title_cache() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.title_cache IS NULL THEN
    SELECT title INTO NEW.title_cache FROM sops WHERE id = NEW.sop_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sop_versions_fill_title ON sop_versions;
CREATE TRIGGER sop_versions_fill_title
  BEFORE INSERT ON sop_versions
  FOR EACH ROW EXECUTE FUNCTION fill_version_title_cache();

-- Keep every version's title_cache in sync when a SOP title changes.
CREATE OR REPLACE FUNCTION sync_sop_title_cache() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sop_versions SET title_cache = NEW.title WHERE sop_id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sops_sync_title_cache ON sops;
CREATE TRIGGER sops_sync_title_cache
  AFTER UPDATE OF title ON sops
  FOR EACH ROW EXECUTE FUNCTION sync_sop_title_cache();

-- Maintain updated_at on version edits.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sop_versions_touch ON sop_versions;
CREATE TRIGGER sop_versions_touch
  BEFORE UPDATE ON sop_versions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- Supporting indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sop_versions_sop ON sop_versions (sop_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_sop_versions_status ON sop_versions (status);
CREATE INDEX IF NOT EXISTS idx_sops_department ON sops (department_id);
CREATE INDEX IF NOT EXISTS idx_approvals_version ON approvals (sop_version_id);
CREATE INDEX IF NOT EXISTS idx_change_log_version ON version_change_log (sop_version_id);
CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens (token_hash);
