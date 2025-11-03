-- Migration: Add grading and scoring tables
-- Purpose: Support rubric-based grading and AI-assisted code review

-- Rubric definitions per assessment
CREATE TABLE IF NOT EXISTS assessment_rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
    criteria JSONB NOT NULL, -- Array of {name, description, weight, type, scoring}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_rubrics_assessment ON assessment_rubrics(assessment_id);

-- Trigger to update updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'assessment_rubrics_set_updated_at'
    ) THEN
        CREATE TRIGGER assessment_rubrics_set_updated_at
        BEFORE UPDATE ON assessment_rubrics
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

-- Individual scores for each submission
CREATE TABLE IF NOT EXISTS submission_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL UNIQUE REFERENCES assessment_invites(id) ON DELETE CASCADE,
    criteria_scores JSONB NOT NULL, -- {criteria_name: {score, max_score, notes}, ...}
    total_score DECIMAL(5,2) NOT NULL, -- Weighted total out of 100
    graded_by TEXT, -- admin email or 'ai'
    graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_submission_scores_invite ON submission_scores(invite_id);
CREATE INDEX IF NOT EXISTS idx_submission_scores_total ON submission_scores(total_score DESC);

-- Test execution results (for automated unit test running)
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
    tests_passed INTEGER NOT NULL DEFAULT 0,
    tests_failed INTEGER NOT NULL DEFAULT 0,
    tests_skipped INTEGER NOT NULL DEFAULT 0,
    test_output JSONB, -- Detailed test results
    execution_time_ms INTEGER, -- Total execution time
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_executions_invite ON test_executions(invite_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_executed ON test_executions(executed_at DESC);

-- AI grading logs (track AI analysis for transparency)
CREATE TABLE IF NOT EXISTS ai_grading_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_id UUID NOT NULL REFERENCES assessment_invites(id) ON DELETE CASCADE,
    model TEXT NOT NULL, -- e.g., 'gpt-4o', 'gpt-4o-mini'
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    criteria_analyzed TEXT[], -- Which criteria were AI-graded
    raw_response JSONB, -- Full AI response for debugging
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_grading_logs_invite ON ai_grading_logs(invite_id);
