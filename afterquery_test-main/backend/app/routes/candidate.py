from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.services.github_service import GitHubService
from app.services.ai_grading_service import AIGradingService
from app.schemas import CriterionScore
from decimal import Decimal


router = APIRouter(prefix="/candidate", tags=["candidate"])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.get("/start/{slug}")
def get_start_page(slug: str, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).filter(models.AssessmentInvite.start_url_slug == slug).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    assessment = db.query(models.Assessment).get(invite.assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    result = {
        "assessment": {
            "title": assessment.title,
            "instructions": assessment.instructions,
            "seed_repo_url": assessment.seed_repo_url,
            "branch": "main",
        },
        "invite": {
            "status": invite.status.value if hasattr(invite.status, "value") else str(invite.status),
            "start_deadline_at": invite.start_deadline_at,
            "complete_deadline_at": invite.complete_deadline_at,
            "started_at": invite.started_at,
            "submitted_at": invite.submitted_at,
        },
    }

    # If assessment has been started, include repository information
    if invite.status in [models.InviteStatus.started, models.InviteStatus.submitted]:
        cand_repo = db.query(models.CandidateRepo).filter(
            models.CandidateRepo.invite_id == invite.id
        ).first()

        if cand_repo:
            result["git"] = {
                "clone_url": f"https://github.com/{cand_repo.repo_full_name}.git",
                "branch": "main",
            }
            result["repo"] = {
                "full_name": cand_repo.repo_full_name,
                "url": f"https://github.com/{cand_repo.repo_full_name}",
                "pinned_main_sha": cand_repo.pinned_main_sha,
            }

    # include submission details if exists
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.invite_id == invite.id)
        .order_by(models.Submission.submitted_at.desc())
        .first()
    )

    if submission:
        result["submission"] = {
            "final_sha": submission.final_sha,
            "submitted_at": submission.submitted_at,
            "demo_link": submission.demo_link,
        }
    return result


@router.post("/start/{slug}")
def start_assessment(slug: str, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).filter(models.AssessmentInvite.start_url_slug == slug).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    now = datetime.now(timezone.utc)
    
    def to_aware_utc(dt: datetime | None) -> datetime | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    if invite.status in [models.InviteStatus.started, models.InviteStatus.submitted]:
        raise HTTPException(status_code=400, detail="Assessment already started or submitted")
    start_deadline = to_aware_utc(invite.start_deadline_at)
    if start_deadline and now > start_deadline:
        invite.status = models.InviteStatus.expired
        db.commit()
        raise HTTPException(status_code=400, detail="Start deadline has passed")

    assessment = db.query(models.Assessment).get(invite.assessment_id)
    seed = db.query(models.SeedRepo).filter(models.SeedRepo.assessment_id == assessment.id).first()

    try:
        gh = GitHubService()
        seed_full_name = gh.ensure_seed_repo(assessment.seed_repo_url)
        clone_result = gh.create_candidate_repo_from_seed(seed_full_name)
    except RuntimeError as e:
        # Missing configuration such as GITHUB_TOKEN or GITHUB_TARGET_OWNER
        raise HTTPException(status_code=500, detail=f"GitHub configuration error: {str(e)}")
    except Exception as e:
        # Upstream GitHub failure or unexpected error
        raise HTTPException(status_code=502, detail=f"Failed to provision candidate repo: {str(e)}")

    # persist candidate repo
    cand_repo = models.CandidateRepo(
        id=uuid.uuid4(),
        invite_id=invite.id,
        repo_full_name=clone_result.repo_full_name,
        git_provider="github",
        pinned_main_sha=clone_result.pinned_main_sha,
        archived=False,
        created_at=now,
    )
    db.add(cand_repo)

    # set complete deadline
    invite.status = models.InviteStatus.started
    invite.started_at = now
    invite.complete_deadline_at = now + timedelta(hours=assessment.complete_within_hours)

    # create access token valid through complete deadline
    token_plain = secrets.token_urlsafe(32)
    token_hash = _hash_token(token_plain)
    token_row = models.RepoAccessToken(
        id=uuid.uuid4(),
        candidate_repo_id=cand_repo.id,
        token_hash=token_hash,
        expires_at=invite.complete_deadline_at,
        created_at=now,
    )
    db.add(token_row)

    # update seed latest SHA if present
    if seed and not seed.latest_main_sha:
        seed.latest_main_sha = clone_result.pinned_main_sha

    db.commit()
    return {
        "git": {
            "clone_url": f"https://github.com/{cand_repo.repo_full_name}.git",
            "branch": "main",
        },
        "repo": {
            "full_name": cand_repo.repo_full_name,
            "url": f"https://github.com/{cand_repo.repo_full_name}",
            "pinned_main_sha": cand_repo.pinned_main_sha,
        },
        "invite": {
            "status": invite.status.value,
            "complete_deadline_at": invite.complete_deadline_at,
        },
        "token": token_plain,
    }


def _auto_grade_submission(invite_id: uuid.UUID, db: Session) -> None:
    """
    Automatically grade a submission using AI.
    This runs after submission and fails silently to not block the submission process.
    """
    try:
        # Get the invite
        invite = db.query(models.AssessmentInvite).get(str(invite_id))
        if not invite:
            return

        # Get assessment for context
        assessment = db.query(models.Assessment).get(str(invite.assessment_id))
        if not assessment:
            return

        # Get rubric - if no rubric exists, skip AI grading
        rubric = db.query(models.AssessmentRubric).filter(
            models.AssessmentRubric.assessment_id == invite.assessment_id
        ).first()
        if not rubric:
            return  # No rubric, no grading

        # Get candidate repo
        candidate_repo = db.query(models.CandidateRepo).filter(
            models.CandidateRepo.invite_id == invite_id
        ).first()
        if not candidate_repo:
            return

        # Fetch code from GitHub
        gh = GitHubService()
        code_diff = gh.compare_commits(
            candidate_repo.repo_full_name,
            candidate_repo.pinned_main_sha,
            "main"
        )
        commit_history = gh.get_commit_history(candidate_repo.repo_full_name)

        # Initialize AI service
        ai_service = AIGradingService()

        # Get all criteria that can be AI-graded
        # Grade all criteria by default
        criteria_to_grade = [c["name"] for c in rubric.criteria]

        # Run AI grading
        result = ai_service.analyze_code_quality(
            code_diff=code_diff,
            commit_history=commit_history,
            rubric_criteria=rubric.criteria,
            criteria_to_grade=criteria_to_grade,
            model="gpt-4o-mini",
            assessment_title=assessment.title,
            assessment_description=assessment.description,
            assessment_instructions=assessment.instructions
        )

        # Calculate weighted total score
        total_score = _calculate_weighted_score(
            result.criteria_scores,
            rubric.criteria
        )

        # Convert CriterionScore objects to dict
        criteria_scores_dict = {
            name: score.model_dump() for name, score in result.criteria_scores.items()
        }

        # Save the score
        score = models.SubmissionScore(
            id=uuid.uuid4(),
            invite_id=invite_id,
            criteria_scores=criteria_scores_dict,
            total_score=total_score,
            graded_by="AI Auto-Grading",
            graded_at=datetime.utcnow(),
            notes="Automatically generated by AI upon submission.",
        )
        db.add(score)

        # Log the AI grading
        log = models.AIGradingLog(
            id=uuid.uuid4(),
            invite_id=invite_id,
            model=result.model_used,
            prompt_tokens=result.tokens_used // 2,
            completion_tokens=result.tokens_used // 2,
            criteria_analyzed=criteria_to_grade,
            raw_response={"reasoning": result.reasoning},
            created_at=datetime.utcnow(),
        )
        db.add(log)
        db.commit()

    except Exception as e:
        # Log error but don't raise - we don't want AI grading failures to block submissions
        import traceback
        error_details = traceback.format_exc()
        print(f"Auto-grading failed for invite {invite_id}: {str(e)}")
        print(error_details)

        # Try to log the failure to database
        try:
            error_log = models.AIGradingLog(
                id=uuid.uuid4(),
                invite_id=invite_id,
                model="gpt-4o-mini",
                prompt_tokens=0,
                completion_tokens=0,
                criteria_analyzed=[],
                raw_response={"error": str(e), "traceback": error_details},
                created_at=datetime.utcnow(),
            )
            db.add(error_log)
            db.commit()
        except:
            db.rollback()


def _calculate_weighted_score(
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


@router.post("/submit/{slug}")
def submit_assessment(slug: str, body: dict = Body(None), db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).filter(
        models.AssessmentInvite.start_url_slug == slug
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != models.InviteStatus.started:
        raise HTTPException(status_code=400, detail="Assessment is not in progress")

    cand_repo = db.query(models.CandidateRepo).filter(
        models.CandidateRepo.invite_id == invite.id
    ).first()
    if not cand_repo:
        raise HTTPException(status_code=400, detail="Candidate repo not found")

    demo_link = body.get("demo_link") if body else None

    now = datetime.utcnow()

    # revoke tokens
    tokens = db.query(models.RepoAccessToken).filter(
        models.RepoAccessToken.candidate_repo_id == cand_repo.id,
        models.RepoAccessToken.revoked_at.is_(None)
    ).all()
    for t in tokens:
        t.revoked_at = now

    # snapshot submission
    submission = models.Submission(
        id=uuid.uuid4(),
        invite_id=invite.id,
        final_sha=cand_repo.pinned_main_sha,
        demo_link=demo_link,
        submitted_at=now,
    )
    db.add(submission)

    invite.status = models.InviteStatus.submitted
    invite.submitted_at = now

    db.commit()

    _auto_grade_submission(invite.id, db)

    return {
        "status": "submitted",
        "final_sha": submission.final_sha,
        "demo_link": submission.demo_link,
    }



@router.get("/commits/{slug}")
def get_candidate_commits(slug: str, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).filter(models.AssessmentInvite.start_url_slug == slug).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    cand_repo = db.query(models.CandidateRepo).filter(models.CandidateRepo.invite_id == invite.id).first()
    if not cand_repo:
        raise HTTPException(status_code=404, detail="Candidate repo not found")
    gh = GitHubService()
    try:
        history = gh.get_commit_history(cand_repo.repo_full_name)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch commits: {str(e)}")
    return history


