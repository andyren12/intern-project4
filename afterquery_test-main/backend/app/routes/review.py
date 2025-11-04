from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.services.github_service import GitHubService
from app.schemas import ReviewCommentOut, FollowUpEmailOut, SettingOut, DiffFile, InlineCommentOut
from app.services.email_service import EmailService
from uuid import uuid4
from datetime import datetime, timezone
from app.models import FollowUpEmail, Setting
import json


router = APIRouter(prefix="/review", tags=["review"])


@router.get("/invite/{invite_id}")
def get_review_for_invite(invite_id: str, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    assessment = db.query(models.Assessment).get(invite.assessment_id)
    candidate = db.query(models.Candidate).get(invite.candidate_id)
    candidate_repo = db.query(models.CandidateRepo).filter(models.CandidateRepo.invite_id == invite.id).first()
    submission = db.query(models.Submission).filter(models.Submission.invite_id == invite.id).first()

    commits = []
    if candidate_repo:
        try:
            gh = GitHubService()
            commits = gh.get_commit_history(candidate_repo.repo_full_name)
        except Exception as e:
            commits = []  # Or put [{'message': f'Error: {e}', ...}] for debug

    diff_summary = {
        "against": {
            "seed_repo": assessment.seed_repo_url,
            "branch": "main",
        },
        "files_changed": [],
    }

    return {
        "invite": {
            "id": str(invite.id),
            "status": invite.status.value if hasattr(invite.status, "value") else str(invite.status),
            "started_at": invite.started_at,
            "submitted_at": invite.submitted_at,
        },
        "assessment": {
            "id": str(assessment.id),
            "title": assessment.title,
            "seed_repo_url": assessment.seed_repo_url,
        },
        "candidate": {
            "id": str(candidate.id),
            "email": candidate.email,
            "full_name": candidate.full_name,
        },
        "repo": candidate_repo and {
            "full_name": candidate_repo.repo_full_name,
            "pinned_main_sha": candidate_repo.pinned_main_sha,
            "archived": candidate_repo.archived,
        },
        "submission": submission and {
            "final_sha": submission.final_sha,
            "submitted_at": submission.submitted_at,
        },
        "commits": commits,
        "diff": diff_summary,
    }


@router.get("/comments/{invite_id}", response_model=list[ReviewCommentOut])
def get_review_comments(invite_id: str, db: Session = Depends(get_db)):
    rows = db.query(models.ReviewComment).filter(models.ReviewComment.invite_id == invite_id).order_by(models.ReviewComment.created_at).all()
    return rows

@router.post("/comments/{invite_id}", response_model=ReviewCommentOut)
def add_review_comment(invite_id: str, payload: dict, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    comment = models.ReviewComment(
        id=uuid4(),
        invite_id=invite_id,
        user_type=payload["user_type"],
        author_email=payload["author_email"],
        author_name=payload.get("author_name"),
        message=payload["message"],
        created_at=datetime.now(timezone.utc),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Send notification email
    email_svc = EmailService()
    assessment = db.query(models.Assessment).get(invite.assessment_id)
    candidate = db.query(models.Candidate).get(invite.candidate_id)
    if payload["user_type"] == "admin":
        # Notify candidate
        target_email = candidate.email
        name = candidate.full_name
        email_svc.send_email(
            to=target_email,
            subject=f"Admin replied to your project: {assessment.title}",
            html=f"<p>You have a new message from the admin regarding your assessment <strong>{assessment.title}</strong>.</p><blockquote>{payload['message']}</blockquote>",
        )
    else:
        # Notify admin (can use a static/admin email for now)
        admin_email = "admin@yourdomain.com"  # Replace with real admin email or config
        email_svc.send_email(
            to=admin_email,
            subject=f"Candidate replied: {assessment.title}",
            html=f"<p>{payload.get('author_name') or payload.get('author_email')} replied regarding <strong>{assessment.title}</strong>:</p><blockquote>{payload['message']}</blockquote>",
        )

    return comment

@router.post("/followup/{invite_id}", response_model=FollowUpEmailOut)
def send_followup_email(invite_id: str, body: dict = {}, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    assessment = db.query(models.Assessment).get(invite.assessment_id)
    candidate = db.query(models.Candidate).get(invite.candidate_id)

    # Get template (prefer passed-in, else settings, else fallback)
    template_subject = body.get("subject")
    template_body = body.get("body")
    if not template_subject or not template_body:
        settings_row = db.query(Setting).filter(Setting.key == "followup_template").first()
        default_subj = "Follow-Up Interview Invitation"
        default_body = "We'd like to schedule a follow-up interview. Please reply with your availability."
        if settings_row:
            # stored as {"subject": s, "body": b}
            try:
                parsed = json.loads(settings_row.value)
                template_subject = template_subject or parsed.get("subject", default_subj)
                template_body = template_body or parsed.get("body", default_body)
            except Exception:
                template_subject = template_subject or default_subj
                template_body = template_body or default_body
        else:
            template_subject = template_subject or default_subj
            template_body = template_body or default_body
    # Send email
    email_svc = EmailService()
    email_svc.send_email(
        to=candidate.email,
        subject=template_subject,
        html=template_body,
    )
    # Store history
    rec = FollowUpEmail(
        id=uuid4(),
        invite_id=invite_id,
        sent_at=datetime.now(timezone.utc),
        template_subject=template_subject,
        template_body=template_body,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

@router.get("/followup/{invite_id}", response_model=list[FollowUpEmailOut])
def followup_email_history(invite_id: str, db: Session = Depends(get_db)):
    rows = db.query(FollowUpEmail).filter(FollowUpEmail.invite_id == invite_id).order_by(FollowUpEmail.sent_at.desc()).all()
    return rows

@router.get("/followup-template", response_model=SettingOut)
def get_followup_template(db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == "followup_template").first()
    if not row:
        from uuid import uuid4
        # Create if doesn't exist
        val = json.dumps({"subject": "Follow-Up Interview Invitation", "body": "We'd like to schedule a follow-up interview. Please reply with your availability."})
        row = Setting(id=uuid4(), key="followup_template", value=val)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

@router.put("/followup-template", response_model=SettingOut)
def set_followup_template(body: dict, db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == "followup_template").first()
    val = json.dumps({"subject": body.get("subject", "Follow-Up Interview Invitation"), "body": body.get("body", "We'd like to schedule a follow-up interview. Please reply with your availability.")})
    if not row:
        from uuid import uuid4
        row = Setting(id=uuid4(), key="followup_template", value=val)
        db.add(row)
    else:
        row.value = val
    db.commit()
    db.refresh(row)
    return row

@router.post("/scheduling/{invite_id}")
def send_scheduling_email(invite_id: str, db: Session = Depends(get_db)):
    """Send a scheduling invitation with Calendly link to a specific candidate"""
    invite = db.query(models.AssessmentInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    assessment = db.query(models.Assessment).get(invite.assessment_id)
    candidate = db.query(models.Candidate).get(invite.candidate_id)

    # Get Calendly link - use assessment-specific if available, otherwise default from settings
    calendly_link = assessment.calendly_link
    if not calendly_link:
        settings_row = db.query(Setting).filter(Setting.key == "calendly_link").first()
        if not settings_row or not settings_row.value:
            raise HTTPException(status_code=400, detail="Calendly link not configured. Please set a default link in Settings or an assessment-specific link.")
        calendly_link = settings_row.value

    # Send email with Calendly link
    email_svc = EmailService()
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

    return {"status": "sent", "candidate_email": candidate.email}

@router.get("/calendly-link", response_model=SettingOut)
def get_calendly_link(db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == "calendly_link").first()
    if not row:
        from uuid import uuid4
        row = Setting(id=uuid4(), key="calendly_link", value="")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

@router.put("/calendly-link", response_model=SettingOut)
def set_calendly_link(body: dict, db: Session = Depends(get_db)):
    row = db.query(Setting).filter(Setting.key == "calendly_link").first()
    link = body.get("link", "")
    if not row:
        from uuid import uuid4
        row = Setting(id=uuid4(), key="calendly_link", value=link)
        db.add(row)
    else:
        row.value = link
    db.commit()
    db.refresh(row)
    return row

@router.get("/diff/{invite_id}", response_model=list[DiffFile])
def get_diff(invite_id: str, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    cand_repo = db.query(models.CandidateRepo).filter(models.CandidateRepo.invite_id == invite.id).first()
    if not cand_repo:
        return []
    gh = GitHubService()
    try:
        comp = gh.compare_commits(cand_repo.repo_full_name, cand_repo.pinned_main_sha, "main")
    except Exception as e:
        # If base commit isn't present (e.g., force-push or history mismatch),
        # return an empty diff instead of hard error to avoid blocking review UX.
        msg = str(e)
        if "404" in msg and "compare" in msg:
            return []
        raise HTTPException(status_code=502, detail=f"Failed to compute diff: {str(e)}")

    files = comp.get("files", [])
    result = []
    for f in files:
        result.append({
            "filename": f.get("filename"),
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "changes": f.get("changes", 0),
            "status": f.get("status"),
            "patch": f.get("patch"),
        })
    return result

@router.get("/inline-comments/{invite_id}", response_model=list[InlineCommentOut])
def list_inline_comments(invite_id: str, db: Session = Depends(get_db)):
    rows = db.query(models.ReviewInlineComment).filter(models.ReviewInlineComment.invite_id == invite_id).order_by(models.ReviewInlineComment.created_at).all()
    return rows

@router.post("/inline-comments/{invite_id}", response_model=InlineCommentOut)
def add_inline_comment(invite_id: str, body: dict, db: Session = Depends(get_db)):
    invite = db.query(models.AssessmentInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    from uuid import uuid4
    from datetime import datetime, timezone
    row = models.ReviewInlineComment(
        id=uuid4(),
        invite_id=invite_id,
        file_path=body.get("file_path"),
        line=body.get("line"),
        message=body.get("message"),
        author_email=body.get("author_email") or "admin@yourdomain.com",
        author_name=body.get("author_name") or "Admin",
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


