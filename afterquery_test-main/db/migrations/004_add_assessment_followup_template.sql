-- Add custom follow-up email template fields to assessments table
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS followup_subject TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS followup_body TEXT;
