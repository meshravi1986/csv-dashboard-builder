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
- **Header user menu** — User info and sign-out in the top header bar, always visible
- **Workflow onboarding** — 5-step guide for new users (Upload → Profile → Semantics → Metrics → Dashboard)
- **Product tour** — Mandatory walkthrough for first-time users with SVG visual mockups; 6 slides, per-user completion tracking
- **AI metric generation** — Describe metrics in natural language, get DuckDB SQL with preview
- **Reusable metrics** — Select metrics from other datasets when all required fields exist
- **Drag-and-drop reordering** — Reorder KPI cards, full-width, and half-width charts independently
- **Custom metric formulas** — Per-field aggregation builder (SUM, AVG, COUNT, MIN, MAX)
- **Color palette picker** — 6 chart color schemes (Slate, Ocean, Forest, Sunset, Violet, Rainbow), persists in localStorage
- **Inline title editing** — Click dashboard title to rename it
- **Formula tooltip** — Hover metric name to see formula; saves chart header space
- **List / Grid toggle** — Switch between grid cards and table list view on My Dashboards page
- **Refresh Frequency** — Tag versions with Monthly/Weekly/Quarterly/Adhoc; displayed in dashboard cards and list
- **Sign-up flow** — Account creation redirects to sign-in page with success message (no auto-login); PIN-based auth with rate limiting (5 attempts → cooldown)
- **Filter persistence** — Filters persist across add/delete chart operations; after dashboard refresh, active filters are automatically re-applied to the updated dataset
- **Filter clear** — Restores original chart data from a ref without re-fetching from server
- **Drag state isolation** — Local chart order is never overwritten by prop changes since drag reorder only touches local state; the sync effect only fires when the parent's `dashboard.charts` actually changes
- **Version creation resilience** — Dashboard page retries fetch 3x with delay to handle Supabase commit latency
- **Cascading delete** — Deleting a versioned dashboard removes all versions in the group
- **Duplicate guard** — `startedRef` prevents React StrictMode double-effect from creating two dashboards

## Security

- **SQL injection protection**: All user-supplied filter values (dates, dimension values) use DuckDB positional parameters (`$1`, `$2`, ...). Column names validated via `safe_quote_ident()` regex. Dangerous DuckDB functions blocklisted.
- **No raw SQL execution**: The `/api/v1/query` endpoint was removed entirely
- **Rate-limited auth**: PIN-based login with 5-attempt cooldown (30–300s)
- **Path traversal prevention**: `Path(file.filename).name` strips directory components
- **Consistent error responses**: Supabase API errors are logged server-side; generic messages returned to client (no `resp.text` leaks)
- **Open redirect validation**: Auth callback `next` parameter validated against allowed path whitelist
- **Aggregation whitelist**: DuckDB query layer validates aggregation functions against `{SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT}`
- **IDOR protection**: Tab CRUD returns consistent "Tab not found" regardless of whether tab exists or belongs to another user

## Structure

- `/frontend` — Next.js App Router + React + ECharts + @dnd-kit
- `/backend` — FastAPI + DuckDB + Polars
- `/docs` — Schema, architecture, setup guide

## Philosophy

- **Deterministic analytics**: chart types based on field roles, not AI
- **Human-owned semantics**: users confirm field roles
- **AI assists UX only**: titles, suggestions, metric SQL generation
- **Simple engineering**: no microservices, no agents, no vector DBs
