# CSV Dashboard Builder

Upload CSV data → Confirm semantics → Generate polished executive dashboards automatically.

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # Edit with your credentials
npm run dev
```

## Structure

- `/frontend` — Next.js App Router + React + ECharts
- `/backend` — FastAPI + DuckDB + Polars
- `/docs` — Schema, architecture, setup guide

## Philosophy

- **Deterministic analytics**: chart types based on field roles, not AI
- **Human-owned semantics**: users confirm field roles
- **AI assists UX only**: titles, suggestions, chart ranking
- **Simple engineering**: no microservices, no agents, no vector DBs
