from __future__ import annotations

from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, exists, text

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
        calendly_link=payload.calendly_link,
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


@router.put("/{assessment_id}/calendly-link", response_model=AssessmentOut)
def update_assessment_calendly_link(assessment_id: str, body: dict, db: Session = Depends(get_db)):
    """Update the Calendly scheduling link for a specific assessment"""
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    assessment.calendly_link = body.get("calendly_link")
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.delete("/{assessment_id}", status_code=204)
def delete_assessment(
    assessment_id: str,
    delete_github_repos: bool = Query(True, description="Also delete candidate GitHub repos"),
    db: Session = Depends(get_db)
):
    """
    Permanently delete an assessment and all associated data.

    This will delete:
    - The assessment itself
    - All invites/submissions
    - All scores and AI grading logs
    - All review comments
    - All rubrics
    - Optionally: All candidate GitHub repositories (recommended)

    Note: The seed repository is NOT deleted as it may be reused.
    """
    assessment = db.query(models.Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Optionally delete candidate repos from GitHub
    if delete_github_repos:
        try:
            gh = GitHubService()

            # Get all candidate repos for this assessment
            candidate_repos = (
                db.query(models.CandidateRepo)
                .join(models.AssessmentInvite)
                .filter(models.AssessmentInvite.assessment_id == assessment_id)
                .all()
            )

            # Delete each repo from GitHub
            for repo in candidate_repos:
                if repo.repo_full_name:
                    try:
                        gh.delete_repo(repo.repo_full_name)
                    except Exception as e:
                        # Log but don't fail - repo might already be deleted
                        print(f"Warning: Could not delete repo {repo.repo_full_name}: {str(e)}")
        except Exception as e:
            # Don't fail the deletion if GitHub cleanup fails
            print(f"Warning: GitHub cleanup failed: {str(e)}")

    # Delete the assessment - use raw SQL to let database CASCADE handle it
    # This prevents SQLAlchemy ORM from trying to nullify foreign keys
    assessment_id_to_delete = str(assessment.id)
    db.expunge(assessment)  # Remove from session to avoid ORM interference

    # Use parameterized SQL delete to let database CASCADE work properly
    db.execute(
        text("DELETE FROM assessments WHERE id = :assessment_id"),
        {"assessment_id": assessment_id_to_delete}
    )
    db.commit()

    return None


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


