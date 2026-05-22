# CSV Dashboard Builder

Upload CSV data → Confirm semantics → Define metrics → Generate polished executive dashboards automatically.

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
cp .env.example .env.local  # Edit with your credentials (NEXT_PUBLIC_API_URL must match backend port)
npm run dev
```

## Features

- **Sidebar navigation** — My Dashboards / My Metrics with mobile hamburger toggle, collapsible for more screen space
- **Consistent sign-out** — Sign-out always in sidebar footer, never duplicated on pages
- **Workflow onboarding** — 5-step guide for new users (Upload → Profile → Semantics → Metrics → Dashboard)
- **AI metric generation** — Describe metrics in natural language, get DuckDB SQL with preview
- **Reusable metrics** — Select metrics from other datasets when all required fields exist
- **Drag-and-drop reordering** — Reorder KPI cards, full-width, and half-width charts independently
- **Custom metric formulas** — Per-field aggregation builder (SUM, AVG, COUNT, MIN, MAX)

## Structure

- `/frontend` — Next.js App Router + React + ECharts + @dnd-kit
- `/backend` — FastAPI + DuckDB + Polars
- `/docs` — Schema, architecture, setup guide

## Philosophy

- **Deterministic analytics**: chart types based on field roles, not AI
- **Human-owned semantics**: users confirm field roles
- **AI assists UX only**: titles, suggestions, metric SQL generation
- **Simple engineering**: no microservices, no agents, no vector DBs
