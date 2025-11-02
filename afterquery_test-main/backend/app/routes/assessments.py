from __future__ import annotations

from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, exists

from app.database import get_db
from app import models
from app.schemas import AssessmentCreate, AssessmentOut
from app.services.github_service import GitHubService


router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.post("/", response_model=AssessmentOut)
def create_assessment(payload: AssessmentCreate, db: Session = Depends(get_db)):
    # Validate seed repository before creating assessment
    try:
        gh = GitHubService()
        seed_full_name = gh.ensure_seed_repo(str(payload.seed_repo_url))
        seed_sha = gh.get_branch_sha(seed_full_name, branch="main")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"GitHub configuration error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to validate seed repository: {str(e)}")

    assessment = models.Assessment(
        id=uuid.uuid4(),
        title=payload.title,
        description=payload.description,
        instructions=payload.instructions,
        seed_repo_url=str(payload.seed_repo_url),
        start_within_hours=payload.start_within_hours,
        complete_within_hours=payload.complete_within_hours,
        created_at=datetime.utcnow(),
        archived=False,
    )
    db.add(assessment)
    # ensure seed repo row exists with default branch main and store the validated SHA
    seed_repo = models.SeedRepo(
        id=uuid.uuid4(),
        assessment_id=assessment.id,
        default_branch="main",
        latest_main_sha=seed_sha,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(seed_repo)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/{assessment_id}", response_model=AssessmentOut)
def get_assessment(assessment_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Assessment).get(assessment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return row


@router.get("/", response_model=list[AssessmentOut])
def list_assessments(
    status: str | None = Query(None, description="available | archived | undefined for all"),
    db: Session = Depends(get_db),
):
    """
    Challenges listing:
    - available: assessments.archived = false
    - archived: assessments.archived = true
    - undefined/any other: return all
    """
    base_query = db.query(models.Assessment)

    if status == "available":
        return (
            base_query.filter(models.Assessment.archived.is_(False))
            .order_by(models.Assessment.created_at.desc())
            .all()
        )
    if status == "archived":
        return (
            base_query.filter(models.Assessment.archived.is_(True))
            .order_by(models.Assessment.created_at.desc())
            .all()
        )

    return base_query.order_by(models.Assessment.created_at.desc()).all()


@router.put("/{assessment_id}/archive", response_model=AssessmentOut)
def archive_assessment(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment.archived = True
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.put("/{assessment_id}/unarchive", response_model=AssessmentOut)
def unarchive_assessment(assessment_id: str, db: Session = Depends(get_db)):
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment.archived = False
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/{assessment_id}/invites")
def get_assessment_invites(assessment_id: str, db: Session = Depends(get_db)):
    # gets all invites/submissions for a specific assessment
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    invites = (
        db.query(models.AssessmentInvite)
        .filter(models.AssessmentInvite.assessment_id == assessment_id)
        .order_by(models.AssessmentInvite.created_at.desc())
        .all()
    )

    results = []
    for inv in invites:
        candidate = db.query(models.Candidate).get(inv.candidate_id)
        results.append({
            "id": inv.id,
            "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
            "created_at": inv.created_at,
            "start_deadline_at": inv.start_deadline_at,
            "complete_deadline_at": inv.complete_deadline_at,
            "started_at": inv.started_at,
            "submitted_at": inv.submitted_at,
            "candidate": candidate,
        })

    return results


