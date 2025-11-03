"""
Quick script to add a rubric to an existing assessment
Usage: python add_rubric.py <assessment_id>
"""
import sys
import uuid
from datetime import datetime
from app.database import SessionLocal
from app.models import AssessmentRubric

# Default rubric template (3 AI-graded criteria)
DEFAULT_CRITERIA = [
    {
        "name": "code_quality",
        "description": "Evaluate code readability, maintainability, proper naming conventions, and adherence to best practices",
        "weight": 0.34,
        "type": "automated",
        "scoring": "percentage",
        "max_score": 100
    },
    {
        "name": "design",
        "description": "Assess architecture decisions, code organization, separation of concerns, and scalability",
        "weight": 0.33,
        "type": "automated",
        "scoring": "percentage",
        "max_score": 100
    },
    {
        "name": "creativity",
        "description": "Evaluate innovative solutions, unique approaches, and problem-solving creativity",
        "weight": 0.33,
        "type": "automated",
        "scoring": "percentage",
        "max_score": 100
    }
]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python add_rubric.py <assessment_id>")
        sys.exit(1)

    assessment_id = sys.argv[1]

    db = SessionLocal()
    try:
        # Check if rubric already exists
        existing = db.query(AssessmentRubric).filter(
            AssessmentRubric.assessment_id == assessment_id
        ).first()

        if existing:
            print(f"Rubric already exists for assessment {assessment_id}")
            print("Updating criteria...")
            existing.criteria = DEFAULT_CRITERIA
            existing.updated_at = datetime.utcnow()
            db.commit()
            print("Rubric updated successfully!")
        else:
            print(f"Creating rubric for assessment {assessment_id}...")
            rubric = AssessmentRubric(
                id=uuid.uuid4(),
                assessment_id=uuid.UUID(assessment_id),
                criteria=DEFAULT_CRITERIA,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(rubric)
            db.commit()
            print("Rubric created successfully!")

        print("\nCriteria:")
        for c in DEFAULT_CRITERIA:
            print(f"  - {c['name']}: {c['weight']*100}% weight")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()
