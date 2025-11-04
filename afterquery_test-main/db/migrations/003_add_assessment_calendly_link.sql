-- Add calendly_link column to assessments table for assessment-specific scheduling links
-- This allows each assessment to have its own Calendly link, with a fallback to the default link in settings

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS calendly_link TEXT;

COMMENT ON COLUMN assessments.calendly_link IS 'Optional Calendly scheduling link specific to this assessment. If null, uses default from settings table.';
