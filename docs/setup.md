# CSV Dashboard Builder - Setup Guide

## Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- OpenAI API key (optional, for AI suggestions)

## Infrastructure Setup (Supabase)

1. Create a new Supabase project
2. Enable Google OAuth in Auth → Providers → Google
3. Run `docs/schema.sql` in Supabase SQL Editor
4. Create Storage bucket named `datasets` (private)
5. Copy your Project URL, anon key, and service role key

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start backend
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd frontend
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Start frontend
npm run dev
```

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=sk-...  # Optional
APP_SECRET=generate_a_random_secret
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy via Vercel CLI or GitHub integration
```

### Backend (Railway)
```bash
cd backend
# Connect GitHub repo to Railway
# Set environment variables in Railway dashboard
# Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
