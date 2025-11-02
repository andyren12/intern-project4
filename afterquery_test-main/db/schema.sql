-- Postgres schema for Candidate Code platform
-- Run this in Supabase (Postgres) or a local Postgres instance.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Simple status type for invites
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
        CREATE TYPE invite_status AS ENUM ('pending', 'started', 'submitted', 'expired');
    END IF;
END$$;

-- assessments: configured by admin
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    seed_repo_url TEXT NOT NULL,
    start_within_hours INTEGER NOT NULL CHECK (start_within_hours > 0),
    complete_within_hours INTEGER NOT NULL CHECK (complete_within_hours > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Backfill: add archived column if existing table lacks it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='assessments' AND column_name='archived'
    ) THEN
        ALTER TABLE assessments ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END$$;

-- candidates: people who receive invites
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- invites: link a candidate to an assessment with time windows
CREATE TABLE IF NOT EXISTS assessment_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    status invite_status NOT NULL DEFAULT 'pending',
    -- Deadlines are materialized when the invite is created (start window)
    start_deadline_at TIMESTAMPTZ,  -- when they must start by
    complete_deadline_at TIMESTAMPTZ, -- when they must finish after starting
    start_token TEXT UNIQUE, -- one-time token for personalized Start link
    start_url_slug TEXT UNIQUE, -- human-friendly slug for Start page
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_invites_assessment ON assessment_invites(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invites_candidate ON assessment_invites(candidate_id);

-- seed repo state tracking for assessments
CREATE TABLE IF NOT EXISTS seed_repos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
    default_branch TEXT NOT NULL DEFAULT 'main',
    latest_main_sha TEXT, -- last synced SHA of main used for future candidates
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'seed_repos_set_updated_at'
    ) THEN
        CREATE TRIGGER seed_repos_set_updated_at
        BEFORE UPDATE ON seed_repos
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

-- per-candidate repo cloned from seed at a pinned commit
CREATE TABLE IF NOT EXISTS candidate_repos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL UNIQUE REFERENCES assessment_invites(id) ON DELETE CASCADE,
    repo_full_name TEXT, -- e.g., org/repo or user/repo
    git_provider TEXT NOT NULL DEFAULT 'github',
    pinned_main_sha TEXT, -- commit SHA at which the repo was created
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- repo-scoped access tokens with expiry aligned to assessment window
CREATE TABLE IF NOT EXISTS repo_access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_repo_id UUID NOT NULL REFERENCES candidate_repos(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, -- store hashed token only
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repo_access_tokens_repo ON repo_access_tokens(candidate_repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_access_tokens_expires ON repo_access_tokens(expires_at);

-- submissions: snapshot of final state
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL UNIQUE REFERENCES assessment_invites(id) ON DELETE CASCADE,
    final_sha TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- simple audit trail
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    invite_id UUID REFERENCES assessment_invites(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- review comments thread between admin and candidate
CREATE TABLE IF NOT EXISTS review_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL, -- 'admin' or 'candidate'
    author_email TEXT NOT NULL,
    author_name TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_comments_invite ON review_comments(invite_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_created ON review_comments(created_at);

-- follow-up emails history
CREATE TABLE IF NOT EXISTS followup_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    template_subject TEXT NOT NULL,
    template_body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_followup_emails_invite ON followup_emails(invite_id);

-- simple key/value settings store
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL
);

-- inline review comments per file
CREATE TABLE IF NOT EXISTS review_inline_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    line INTEGER,
    message TEXT NOT NULL,
    author_email TEXT NOT NULL,
    author_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inline_comments_invite ON review_inline_comments(invite_id);
