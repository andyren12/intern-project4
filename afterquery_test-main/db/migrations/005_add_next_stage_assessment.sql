-- Add next stage assessment reference to assessments table
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS next_stage_assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL;
