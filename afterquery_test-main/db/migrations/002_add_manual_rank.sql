-- Add manual_rank column to submission_scores for admin drag-and-drop reordering
ALTER TABLE submission_scores ADD COLUMN IF NOT EXISTS manual_rank INTEGER;

-- Add index for efficient sorting by manual_rank
CREATE INDEX IF NOT EXISTS idx_submission_scores_manual_rank ON submission_scores(manual_rank) WHERE manual_rank IS NOT NULL;
