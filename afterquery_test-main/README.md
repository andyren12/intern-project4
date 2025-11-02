# INSTRUCTIONS
1. The full assessment instructions will be sent to your email.

# SUBMISSION

1. DEMO: 
    - https://drive.google.com/file/d/152wGgr3ds9YgyCRzp_bwOCS0Ip6iEc0n/view?usp=sharing
    - https://drive.google.com/file/d/1kw0k_dc7jFvDrTqvEZ4Lw-s38VGsKf6K/view?usp=sharing
2. LIVE WEBSITE: https://afterquery-test.vercel.app/
3. MAKE SURE TO FILL OUT .ENV.EXAMPLE: Updated

# Full Stack Starter Template

A clean monorepo structure for projects using **Next.js** (frontend) and **FastAPI** (backend).

## Getting Started

### Clone
```bash
git clone https://github.com/mykolas921/afterquery_test
cd afterquery_test
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m app.main
```

Visit:
- Frontend → http://localhost:3000  
- Backend → http://localhost:8000

## Environment Variables

Create `.env` files where appropriate. Example keys:

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Backend (`.env` or export in shell)
```
# Postgres (Supabase or local)
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/candidate_code

# GitHub integration
GITHUB_TOKEN=ghp_...            # classic PAT or installation token with repo access
GITHUB_TARGET_OWNER=your-org-or-username

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=Candidate Code <noreply@yourdomain.com>

# Public app URL to construct candidate start links in emails
PUBLIC_APP_BASE_URL=http://localhost:3000
```

## Database Setup

Apply schema to your Postgres instance (e.g., Supabase SQL editor or local psql):
```sql
-- file: db/schema.sql
```

## Deployment Notes

- Backend can be hosted on Railway. Ensure `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_TARGET_OWNER`, `RESEND_API_KEY`, `EMAIL_FROM`, and `PUBLIC_APP_BASE_URL` are set.
- Frontend (Vercel/Netlify) must have `NEXT_PUBLIC_API_BASE_URL` pointing at the backend URL.
