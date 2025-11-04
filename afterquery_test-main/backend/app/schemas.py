from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, HttpUrl, EmailStr, Field
from decimal import Decimal


class AssessmentCreate(BaseModel):
    title: str
    description: str | None = None
    instructions: str | None = None
    seed_repo_url: HttpUrl
    start_within_hours: int
    complete_within_hours: int
    calendly_link: str | None = None


class AssessmentOut(BaseModel):
    id: UUID
    title: str
    description: str | None
    instructions: str | None
    seed_repo_url: str
    start_within_hours: int
    complete_within_hours: int
    created_at: datetime
    calendly_link: str | None = None

    class Config:
        from_attributes = True


class InviteCreate(BaseModel):
    assessment_id: str
    email: EmailStr
    full_name: str | None = None


class InviteOut(BaseModel):
    id: UUID
    assessment_id: UUID
    candidate_id: UUID
    status: str
    start_deadline_at: datetime | None
    complete_deadline_at: datetime | None
    start_url_slug: str | None
    started_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True



class CandidateLite(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None

    class Config:
        from_attributes = True


class AssessmentLite(BaseModel):
    id: UUID
    title: str
    seed_repo_url: str
    archived: bool

    class Config:
        from_attributes = True


class SubmissionLite(BaseModel):
    final_sha: str | None
    submitted_at: datetime
    demo_link: str | None

    class Config:
        from_attributes = True


class AdminInviteOut(BaseModel):
    id: UUID
    status: str
    created_at: datetime
    start_deadline_at: datetime | None
    complete_deadline_at: datetime | None
    started_at: datetime | None
    submitted_at: datetime | None
    candidate: CandidateLite
    assessment: AssessmentLite
    submission: SubmissionLite | None = None

    class Config:
        from_attributes = True


class ReviewCommentOut(BaseModel):
    id: UUID
    invite_id: UUID
    user_type: str  # "admin" or "candidate"
    author_email: str
    author_name: str | None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class FollowUpEmailOut(BaseModel):
    id: UUID
    invite_id: UUID
    sent_at: datetime
    template_subject: str
    template_body: str

    class Config:
        from_attributes = True

class SettingOut(BaseModel):
    id: UUID
    key: str
    value: str

    class Config:
        from_attributes = True


class DiffFile(BaseModel):
    filename: str
    additions: int
    deletions: int
    changes: int
    status: str
    patch: str | None = None

class InlineCommentOut(BaseModel):
    id: UUID
    invite_id: UUID
    file_path: str
    line: int | None
    message: str
    author_email: str
    author_name: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# Grading Schemas

class RubricCriterion(BaseModel):
    """Individual grading criterion"""
    name: str
    description: str
    weight: float = Field(gt=0, le=1)  # Must sum to 1.0 across all criteria
    type: str = Field(default="manual")  # "manual" or "automated"
    scoring: str = Field(default="scale")  # "scale" (1-5), "percentage" (0-100), "binary" (0 or 1)
    max_score: int = Field(default=5)  # Max value for scale scoring


class RubricCreate(BaseModel):
    """Create or update rubric for an assessment"""
    assessment_id: UUID
    criteria: list[RubricCriterion]

    def validate_weights(self):
        """Ensure weights sum to approximately 1.0"""
        total = sum(c.weight for c in self.criteria)
        if not (0.99 <= total <= 1.01):
            raise ValueError(f"Criteria weights must sum to 1.0, got {total}")


class RubricOut(BaseModel):
    """Rubric output"""
    id: UUID
    assessment_id: UUID
    criteria: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CriterionScore(BaseModel):
    """Score for a single criterion"""
    score: float
    max_score: float
    notes: str | None = None


class SubmissionScoreCreate(BaseModel):
    """Create or update submission score"""
    invite_id: UUID
    criteria_scores: dict[str, CriterionScore]  # {criteria_name: CriterionScore}
    graded_by: str  # admin email or 'ai'
    notes: str | None = None


class SubmissionScoreOut(BaseModel):
    """Submission score output"""
    id: UUID
    invite_id: UUID
    criteria_scores: dict[str, Any]
    total_score: Decimal
    graded_by: str | None
    graded_at: datetime
    notes: str | None

    class Config:
        from_attributes = True


class TestExecutionOut(BaseModel):
    """Test execution result"""
    id: UUID
    invite_id: UUID
    tests_passed: int
    tests_failed: int
    tests_skipped: int
    test_output: dict[str, Any] | None
    execution_time_ms: int | None
    executed_at: datetime

    class Config:
        from_attributes = True


class AIGradingRequest(BaseModel):
    """Request AI grading for specific criteria"""
    invite_id: UUID
    criteria_to_grade: list[str]  # Which criteria should be AI-graded
    model: str = Field(default="gpt-4o-mini")  # OpenAI model to use


class AIGradingResult(BaseModel):
    """Result of AI grading"""
    criteria_scores: dict[str, CriterionScore]
    reasoning: dict[str, str]  # Explanation for each criterion
    model_used: str
    tokens_used: int


class RankingEntry(BaseModel):
    """Single entry in rankings"""
    invite_id: UUID
    candidate_id: UUID
    candidate_email: str
    candidate_name: str | None
    total_score: Decimal
    graded_at: datetime
    status: str
    submitted_at: datetime | None
    manual_rank: int | None = None


class UpdateRankingsRequest(BaseModel):
    """Request to update manual ranking order"""
    rankings: list[dict[str, Any]]  # List of {invite_id: str, manual_rank: int}

    class Config:
        from_attributes = True

