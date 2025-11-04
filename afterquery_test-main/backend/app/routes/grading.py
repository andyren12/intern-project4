"""
Grading API Routes - Handle rubrics, scoring, and rankings
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.database import get_db
from app import models
from app.schemas import (
    RubricCreate,
    RubricOut,
    SubmissionScoreCreate,
    SubmissionScoreOut,
    AIGradingRequest,
    AIGradingResult,
    RankingEntry,
    CriterionScore,
    UpdateRankingsRequest,
)
from app.services.ai_grading_service import AIGradingService
from app.services.github_service import GitHubService
from app.services.email_service import EmailService
import json


router = APIRouter(prefix="/grading", tags=["grading"])


# ============================================================================
# RUBRIC ENDPOINTS
# ============================================================================

@router.post("/rubrics", response_model=RubricOut, status_code=201)
def create_rubric(payload: RubricCreate, db: Session = Depends(get_db)):
    """Create or update grading rubric for an assessment"""

    # Validate weights sum to 1.0
    try:
        payload.validate_weights()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if assessment exists
    assessment = db.query(models.Assessment).get(str(payload.assessment_id))
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check if rubric already exists
    existing = db.query(models.AssessmentRubric).filter(
        models.AssessmentRubric.assessment_id == payload.assessment_id
    ).first()

    if existing:
        # Update existing
        existing.criteria = [c.model_dump() for c in payload.criteria]
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    # Create new
    rubric = models.AssessmentRubric(
        id=uuid.uuid4(),
        assessment_id=payload.assessment_id,
        criteria=[c.model_dump() for c in payload.criteria],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(rubric)
    db.commit()
    db.refresh(rubric)
    return rubric


@router.get("/rubrics/assessment/{assessment_id}", response_model=RubricOut)
def get_rubric(assessment_id: str, db: Session = Depends(get_db)):
    """Get rubric for an assessment"""
    rubric = db.query(models.AssessmentRubric).filter(
        models.AssessmentRubric.assessment_id == assessment_id
    ).first()

    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    return rubric


@router.delete("/rubrics/{rubric_id}", status_code=204)
def delete_rubric(rubric_id: str, db: Session = Depends(get_db)):
    """Delete a rubric"""
    rubric = db.query(models.AssessmentRubric).get(rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    db.delete(rubric)
    db.commit()
    return None


# ============================================================================
# SCORING ENDPOINTS
# ============================================================================

@router.post("/scores", response_model=SubmissionScoreOut, status_code=201)
def create_or_update_score(payload: SubmissionScoreCreate, db: Session = Depends(get_db)):
    """Create or update submission score"""

    # Check if invite exists
    invite = db.query(models.AssessmentInvite).get(str(payload.invite_id))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Get rubric to calculate weighted total
    rubric = db.query(models.AssessmentRubric).filter(
        models.AssessmentRubric.assessment_id == invite.assessment_id
    ).first()

    if not rubric:
        raise HTTPException(status_code=404, detail="No rubric defined for this assessment")

    # Calculate weighted total score
    total_score = calculate_weighted_score(
        payload.criteria_scores,
        rubric.criteria
    )

    # Check if score already exists
    existing = db.query(models.SubmissionScore).filter(
        models.SubmissionScore.invite_id == payload.invite_id
    ).first()

    # Convert CriterionScore objects to dict
    criteria_scores_dict = {
        name: score.model_dump() for name, score in payload.criteria_scores.items()
    }

    if existing:
        # Update existing
        existing.criteria_scores = criteria_scores_dict
        existing.total_score = total_score
        existing.graded_by = payload.graded_by
        existing.graded_at = datetime.utcnow()
        existing.notes = payload.notes
        db.commit()
        db.refresh(existing)
        return existing

    # Create new
    score = models.SubmissionScore(
        id=uuid.uuid4(),
        invite_id=payload.invite_id,
        criteria_scores=criteria_scores_dict,
        total_score=total_score,
        graded_by=payload.graded_by,
        graded_at=datetime.utcnow(),
        notes=payload.notes,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


@router.get("/scores/invite/{invite_id}", response_model=SubmissionScoreOut)
def get_score(invite_id: str, db: Session = Depends(get_db)):
    """Get score for a submission"""
    score = db.query(models.SubmissionScore).filter(
        models.SubmissionScore.invite_id == invite_id
    ).first()

    if not score:
        raise HTTPException(status_code=404, detail="Score not found")

    return score


@router.delete("/scores/{score_id}", status_code=204)
def delete_score(score_id: str, db: Session = Depends(get_db)):
    """Delete a score"""
    score = db.query(models.SubmissionScore).get(score_id)
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")

    db.delete(score)
    db.commit()
    return None


# ============================================================================
# AI GRADING ENDPOINTS
# ============================================================================

@router.post("/ai-grade", response_model=AIGradingResult)
def ai_grade_submission(payload: AIGradingRequest, db: Session = Depends(get_db)):
    """Use AI to grade specific criteria of a submission"""

    # Get invite and validate
    invite = db.query(models.AssessmentInvite).get(str(payload.invite_id))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.status.value != "submitted":
        raise HTTPException(status_code=400, detail="Can only grade submitted assessments")

    # Get assessment
    assessment = db.query(models.Assessment).get(str(invite.assessment_id))
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get rubric
    rubric = db.query(models.AssessmentRubric).filter(
        models.AssessmentRubric.assessment_id == invite.assessment_id
    ).first()

    if not rubric:
        raise HTTPException(status_code=404, detail="No rubric defined for this assessment")

    # Get candidate repo
    candidate_repo = db.query(models.CandidateRepo).filter(
        models.CandidateRepo.invite_id == payload.invite_id
    ).first()

    if not candidate_repo:
        raise HTTPException(status_code=404, detail="No candidate repo found")

    # Get code diff and commit history from GitHub
    try:
        gh = GitHubService()

        # Get diff between seed and submission
        code_diff = gh.compare_commits(
            candidate_repo.repo_full_name,
            candidate_repo.pinned_main_sha,
            "main"
        )

        # Get commit history
        commit_history = gh.get_commit_history(candidate_repo.repo_full_name)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch code: {str(e)}")

    # Initialize AI grading service
    try:
        ai_service = AIGradingService()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Run AI grading
    try:
        result = ai_service.analyze_code_quality(
            code_diff=code_diff,
            commit_history=commit_history,
            rubric_criteria=rubric.criteria,
            criteria_to_grade=payload.criteria_to_grade,
            model=payload.model,
            assessment_title=assessment.title,
            assessment_description=assessment.description,
            assessment_instructions=assessment.instructions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI grading failed: {str(e)}")

    # Log the AI grading
    log = models.AIGradingLog(
        id=uuid.uuid4(),
        invite_id=payload.invite_id,
        model=result.model_used,
        prompt_tokens=result.tokens_used // 2,  # Rough estimate
        completion_tokens=result.tokens_used // 2,
        criteria_analyzed=payload.criteria_to_grade,
        raw_response={"reasoning": result.reasoning},
        created_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()

    return result


@router.post("/ai-grade/estimate-cost")
def estimate_ai_grading_cost(invite_id: str, model: str = "gpt-4o-mini", db: Session = Depends(get_db)):
    """Estimate the cost of AI grading for a submission"""

    # Get candidate repo
    candidate_repo = db.query(models.CandidateRepo).filter(
        models.CandidateRepo.invite_id == invite_id
    ).first()

    if not candidate_repo:
        raise HTTPException(status_code=404, detail="No candidate repo found")

    try:
        gh = GitHubService()
        code_diff = gh.compare_commits(
            candidate_repo.repo_full_name,
            candidate_repo.pinned_main_sha,
            "main"
        )

        ai_service = AIGradingService()
        estimate = ai_service.estimate_cost(code_diff, model)

        return estimate

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to estimate cost: {str(e)}")


# ============================================================================
# RANKINGS ENDPOINTS
# ============================================================================

@router.get("/rankings/assessment/{assessment_id}", response_model=list[RankingEntry])
def get_assessment_rankings(
    assessment_id: str,
    db: Session = Depends(get_db),
    status: str | None = Query(None, description="Filter by status: submitted, started, all")
):
    """Get ranked list of all submissions for an assessment"""

    # Verify assessment exists
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Build query with joins
    query = (
        db.query(
            models.SubmissionScore,
            models.AssessmentInvite,
            models.Candidate
        )
        .join(models.AssessmentInvite, models.SubmissionScore.invite_id == models.AssessmentInvite.id)
        .join(models.Candidate, models.AssessmentInvite.candidate_id == models.Candidate.id)
        .filter(models.AssessmentInvite.assessment_id == assessment_id)
    )

    # Apply status filter
    if status and status != "all":
        query = query.filter(models.AssessmentInvite.status == status)

    # Order by manual_rank first (if set), then by total_score descending
    # NULLs in manual_rank go last, so unranked candidates are sorted by score
    query = query.order_by(
        models.SubmissionScore.manual_rank.asc().nullslast(),
        desc(models.SubmissionScore.total_score)
    )

    results = query.all()

    # Format response
    rankings = []
    for score, invite, candidate in results:
        rankings.append(RankingEntry(
            invite_id=invite.id,
            candidate_id=candidate.id,
            candidate_email=candidate.email,
            candidate_name=candidate.full_name,
            total_score=score.total_score,
            graded_at=score.graded_at,
            status=invite.status.value if hasattr(invite.status, "value") else str(invite.status),
            submitted_at=invite.submitted_at,
            manual_rank=score.manual_rank,
        ))

    return rankings


@router.get("/rankings/ungraded/{assessment_id}")
def get_ungraded_submissions(assessment_id: str, db: Session = Depends(get_db)):
    """Get list of submitted but ungraded submissions"""

    # Get all submitted invites without scores
    invites = (
        db.query(models.AssessmentInvite)
        .outerjoin(models.SubmissionScore, models.AssessmentInvite.id == models.SubmissionScore.invite_id)
        .filter(
            models.AssessmentInvite.assessment_id == assessment_id,
            models.AssessmentInvite.status == "submitted",
            models.SubmissionScore.id.is_(None)  # No score exists
        )
        .all()
    )

    results = []
    for invite in invites:
        candidate = db.query(models.Candidate).get(invite.candidate_id)
        results.append({
            "invite_id": invite.id,
            "candidate_id": candidate.id,
            "candidate_email": candidate.email,
            "candidate_name": candidate.full_name,
            "submitted_at": invite.submitted_at,
        })

    return results


@router.get("/ai-grade/logs/{invite_id}")
def get_ai_grading_logs(invite_id: str, db: Session = Depends(get_db)):
    """Get AI grading logs for a submission to debug auto-grading issues"""

    logs = db.query(models.AIGradingLog).filter(
        models.AIGradingLog.invite_id == invite_id
    ).order_by(models.AIGradingLog.created_at.desc()).all()

    return [{
        "id": log.id,
        "model": log.model,
        "prompt_tokens": log.prompt_tokens,
        "completion_tokens": log.completion_tokens,
        "criteria_analyzed": log.criteria_analyzed,
        "created_at": log.created_at,
    } for log in logs]


@router.put("/rankings/assessment/{assessment_id}/reorder", status_code=200)
def update_rankings_order(
    assessment_id: str,
    payload: UpdateRankingsRequest,
    db: Session = Depends(get_db)
):
    """
    Update manual ranking order for an assessment.
    Admin can drag-and-drop to reorder candidates.

    The rankings list should contain objects with:
    - invite_id: UUID of the invite
    - manual_rank: Integer position (1=first, 2=second, etc.)
    """
    # Verify assessment exists
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Update manual_rank for each submission score
    for ranking_item in payload.rankings:
        invite_id = ranking_item.get("invite_id")
        manual_rank = ranking_item.get("manual_rank")

        if not invite_id:
            continue

        # Find the score for this invite
        score = db.query(models.SubmissionScore).filter(
            models.SubmissionScore.invite_id == invite_id
        ).first()

        if score:
            score.manual_rank = manual_rank if manual_rank is not None else None

    db.commit()

    return {"message": "Rankings updated successfully"}


@router.post("/rankings/assessment/{assessment_id}/send-scheduling")
def send_bulk_scheduling(
    assessment_id: str,
    top_n: int = Query(..., description="Number of top candidates to email"),
    status: str | None = Query("submitted", description="Filter by status"),
    db: Session = Depends(get_db)
):
    """
    Send meeting scheduling links (Calendly) to the top N candidates in the rankings.
    """
    # Verify assessment exists
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get Calendly link - use assessment-specific if available, otherwise default from settings
    calendly_link = assessment.calendly_link
    if not calendly_link:
        settings_row = db.query(models.Setting).filter(models.Setting.key == "calendly_link").first()
        if not settings_row or not settings_row.value:
            raise HTTPException(status_code=400, detail="Calendly link not configured. Please set a default link in Settings or an assessment-specific link.")
        calendly_link = settings_row.value

    # Get top N candidates using the same ranking logic
    query = (
        db.query(
            models.SubmissionScore,
            models.AssessmentInvite,
            models.Candidate
        )
        .join(models.AssessmentInvite, models.SubmissionScore.invite_id == models.AssessmentInvite.id)
        .join(models.Candidate, models.AssessmentInvite.candidate_id == models.Candidate.id)
        .filter(models.AssessmentInvite.assessment_id == assessment_id)
    )

    if status and status != "all":
        query = query.filter(models.AssessmentInvite.status == status)

    query = query.order_by(
        models.SubmissionScore.manual_rank.asc().nullslast(),
        desc(models.SubmissionScore.total_score)
    )

    results = query.limit(top_n).all()

    if not results:
        raise HTTPException(status_code=404, detail="No candidates found")

    # Send emails with Calendly link
    email_svc = EmailService()
    sent_count = 0
    failed_emails = []

    for _, invite, candidate in results:
        try:
            subject = f"Interview Invitation - {assessment.title}"
            body = f"""
            <p>Hi {candidate.full_name or candidate.email},</p>

            <p>Congratulations! We would like to schedule an interview with you regarding your submission for <strong>{assessment.title}</strong>.</p>

            <p>Please select a time that works best for you by clicking the link below:</p>

            <p><a href="{calendly_link}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Schedule Interview</a></p>

            <p>Or copy this link: {calendly_link}</p>

            <p>We look forward to speaking with you!</p>
            """

            email_svc.send_email(
                to=candidate.email,
                subject=subject,
                html=body,
            )

            sent_count += 1

        except Exception as e:
            failed_emails.append({
                "email": candidate.email,
                "name": candidate.full_name,
                "error": str(e)
            })

    db.commit()

    return {
        "message": f"Scheduling emails sent to top {top_n} candidates",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "failed_emails": failed_emails
    }


@router.post("/rankings/assessment/{assessment_id}/send-followup")
def send_bulk_followup(
    assessment_id: str,
    top_n: int = Query(..., description="Number of top candidates to email"),
    status: str | None = Query("submitted", description="Filter by status"),
    db: Session = Depends(get_db)
):
    """
    Send follow-up emails to the top N candidates in the rankings.
    Uses the same template as individual follow-up emails from settings.
    """
    # Verify assessment exists
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get top N candidates using the same ranking logic
    query = (
        db.query(
            models.SubmissionScore,
            models.AssessmentInvite,
            models.Candidate
        )
        .join(models.AssessmentInvite, models.SubmissionScore.invite_id == models.AssessmentInvite.id)
        .join(models.Candidate, models.AssessmentInvite.candidate_id == models.Candidate.id)
        .filter(models.AssessmentInvite.assessment_id == assessment_id)
    )

    # Apply status filter
    if status and status != "all":
        query = query.filter(models.AssessmentInvite.status == status)

    # Order by manual_rank first, then by total_score
    query = query.order_by(
        models.SubmissionScore.manual_rank.asc().nullslast(),
        desc(models.SubmissionScore.total_score)
    )

    # Limit to top N
    results = query.limit(top_n).all()

    if not results:
        raise HTTPException(status_code=404, detail="No candidates found")

    # Get email template (priority: assessment-specific > global settings > fallback)
    default_subj = "Follow-Up Interview Invitation"
    default_body = "We'd like to schedule a follow-up interview. Please reply with your availability."

    # Check for assessment-specific template first
    if assessment.followup_subject and assessment.followup_body:
        template_subject = assessment.followup_subject
        template_body = assessment.followup_body
    else:
        # Fall back to global settings
        settings_row = db.query(models.Setting).filter(models.Setting.key == "followup_template").first()
        if settings_row:
            try:
                parsed = json.loads(settings_row.value)
                template_subject = parsed.get("subject", default_subj)
                template_body = parsed.get("body", default_body)
            except Exception:
                template_subject = default_subj
                template_body = default_body
        else:
            template_subject = default_subj
            template_body = default_body

    # Get next stage assessment if configured
    next_stage = None
    if assessment.next_stage_assessment_id:
        next_stage = db.query(models.Assessment).get(assessment.next_stage_assessment_id)

    # Send emails and record history
    email_svc = EmailService()
    sent_count = 0
    failed_emails = []

    for score, invite, candidate in results:
        try:
            # Replace candidate name wildcard for personalization
            candidate_name = candidate.full_name or candidate.email
            personalized_subject = template_subject.replace("{candidate_name}", candidate_name)
            personalized_body = template_body.replace("{candidate_name}", candidate_name)

            # Create next stage invite if configured
            next_stage_info = ""
            if next_stage:
                # Check if invite already exists for this candidate and next stage
                existing_next_invite = db.query(models.AssessmentInvite).filter(
                    models.AssessmentInvite.assessment_id == next_stage.id,
                    models.AssessmentInvite.candidate_id == candidate.id
                ).first()

                if not existing_next_invite:
                    # Create new invite for next stage
                    start_deadline = datetime.now(timezone.utc) + timedelta(hours=next_stage.start_within_hours)
                    next_invite = models.AssessmentInvite(
                        id=uuid.uuid4(),
                        assessment_id=next_stage.id,
                        candidate_id=candidate.id,
                        status=models.InviteStatus.pending,
                        start_deadline_at=start_deadline,
                        start_url_slug=secrets.token_urlsafe(10).lower(),
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(next_invite)
                    db.flush()  # Flush to get the next_invite ID without committing
                else:
                    next_invite = existing_next_invite

                # Generate start link
                public_base = os.getenv("PUBLIC_APP_BASE_URL", "http://localhost:3000")
                next_start_link = f"{public_base}/candidate/{next_invite.start_url_slug}"

                next_stage_info = f"""
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                <h2 style="font-size: 20px; font-weight: bold; margin: 20px 0 10px 0;">Next Round Assessment</h2>
                <p>You have been invited to complete the assessment <strong>{next_stage.title}</strong>.</p>
                <p>Please start here: <a href="{next_start_link}" style="color: #2563eb; text-decoration: none;">{next_start_link}</a></p>
                <p>Good luck!</p>
                """

            # Send email with next stage info appended if available
            email_svc.send_email(
                to=candidate.email,
                subject=personalized_subject,
                html=personalized_body + next_stage_info,
            )

            # Record in follow-up history
            rec = models.FollowUpEmail(
                id=uuid.uuid4(),
                invite_id=invite.id,
                sent_at=datetime.utcnow(),
                template_subject=template_subject,
                template_body=template_body,
            )
            db.add(rec)
            sent_count += 1

        except Exception as e:
            failed_emails.append({
                "email": candidate.email,
                "name": candidate.full_name,
                "error": str(e)
            })

    db.commit()

    return {
        "message": f"Follow-up emails sent to top {top_n} candidates",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "failed_emails": failed_emails
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_weighted_score(
    criteria_scores: dict[str, CriterionScore],
    rubric_criteria: list[dict]
) -> Decimal:
    """Calculate weighted total score out of 100"""

    total = 0.0

    for criterion in rubric_criteria:
        name = criterion["name"]
        weight = criterion["weight"]

        if name in criteria_scores:
            score_data = criteria_scores[name]
            # Normalize to 0-100 scale
            normalized = (score_data.score / score_data.max_score) * 100
            weighted = normalized * weight
            total += weighted

    return Decimal(str(round(total, 2)))
