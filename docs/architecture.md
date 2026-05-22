# Architecture Overview

## Flow

```
Upload CSV → Column Match Check → [Version Found?] → Version Modal (skip profile/semantics/metrics)
           → [No Match?] → Profile Dataset → Confirm Semantics → Define Metrics → Generate Dashboard → View/Edit (reorder, filter)
```

The versioning column match happens **server-side during upload**. If the uploaded CSV's columns match an existing dashboard's dataset, the user is offered a choice: create a new version (reusing layout, metrics, chart types — only data is refreshed) or proceed as a new dashboard. This avoids redoing the profile/semantics/metrics flow for data refreshes.

Three metric modes:
- **Simple**: pick a field + aggregation
- **Custom**: build formulas with per-field aggregations (e.g. `SUM(A) - SUM(B)`)
- **AI**: describe in natural language → GPT generates DuckDB SQL → preview value

Two metric sources:
- **Create**: define a new metric from scratch
- **Select**: reuse a metric from another dataset when its required fields exist in the current dataset

## Navigation

```
Top Header Bar
└── User info (avatar + name + email) + Sign out (always visible)

Sidebar (collapsible to icon-only)
├── My Dashboards  (/dashboards) — grid/list toggle, versions count + tag
├── My Metrics     (/my-metrics)
├── Product Tour   (available from My Dashboards)
└── Collapse toggle (bottom)

Dashboard Versions  (/dashboard-versions/[versionGroupId])
├── Table of all versions with v1/v2 tags, chart count, links
└── "Latest" badge on newest version

Dashboard Detail
├── Title (inline editable)
├── Color Palette picker
├── Version info (via breadcrumb to versions list)
├── Filters (dimension multi-select + date picker + presets)
├── Charts (grouped: KPI / full-width / half-width, drag-reorderable)
└── Formula tooltip on hover
├── Color palette picker
├── Chart area (sortable by drag & drop, color-schemed)
├── Add chart panel
├── Filter bar (global dimension/date filters)
├── Formula tooltip on hover (instead of persistent text)
└── Edit workspace (back to semantics)

My Dashboards
├── Grid view (cards)
└── List view (sortable table)
   └── Toggle persisted in localStorage
```

Sidebar can be collapsed to a narrow icon strip via the chevron button at the bottom.
Collapse state persists in localStorage. User info and sign-out moved to the top
header bar so they're always visible regardless of page scroll.

## Key Design Decisions

### Deterministic Analytics
Chart types are determined by field roles (date+measure→line, dimension+measure→bar, etc.).
AI never chooses chart types - only ranks, provides titles, and generates metric SQL.

### Human-Owned Semantics
Users must explicitly confirm field roles. AI only suggests roles
which users can accept or override.

### DuckDB for Queries
All aggregations run via DuckDB in-memory inside the backend container.
No external query engine needed.

### Dashboard Version Creation
- Copies semantics, metrics, and chart_specs from the source dashboard
- On the frontend, `loadDashboard()` retries up to 3 times with 800ms delays
  to handle the race condition between version creation and dashboard page load

### Parquet Storage
CSV files are converted to Parquet for efficient storage and querying.
Parquet files stored in Supabase Storage.

### Metadata-Driven Rendering
Dashboards render from chart_specs stored in the database.
No code generation involved.

### Metric Reusability
Metrics from any dataset can be reused in another dataset if all required fields exist.
Required fields are extracted from `field_name` (simple) or parsed from formula strings (custom).
Compatibility checked via DuckDB DESCRIBE on the target parquet file.

## Technology Choices

- **Next.js App Router**: Single-page app with server-side auth
- **FastAPI**: Simple async Python API
- **DuckDB**: Embedded analytical SQL engine
- **Polars**: CSV to Parquet conversion
- **ECharts**: Rich charting library
- **@dnd-kit**: Drag-and-drop chart reordering
- **Supabase**: Auth, storage, and database
- **OpenAI**: Optional AI enhancement (titles, suggestions, metric SQL)

## Data Flow

1. CSV uploaded → processed by FastAPI → converted to Parquet via Polars
2. Parquet stored in Supabase Storage → metadata in datasets table
3. Profile generated via DuckDB queries on Parquet
4. User confirms semantics → stored in semantic_fields table
5. Metrics defined → stored in metrics table
6. Dashboard generation → chart_specs created → stored in dashboards + chart_specs
7. Frontend renders charts via ECharts based on chart_specs
8. Charts can be reordered via drag-and-drop; order persisted to backend
9. Filter changes save original unfiltered data in a ref and restore it locally on clear (no server re-fetch)
10. Dashboard fetch retries 3x with 800ms delay to handle Supabase propagation lag on version creation

## Drag-and-Drop Reordering

Charts are grouped into three independent sortable contexts (KPI, full-width, half-width), each with its own `DndContext` + `SortableContext`. On drag end:
- Local `charts` state is optimistically updated
- `persistOrder` fires `PUT /dashboards/{id}/charts/reorder`
- If the API fails, the error is logged (no rollback — state persists until next server sync)
- The `useEffect` that syncs from `dashboard.charts` prop is **guarded by a ref**: it only runs on initial mount or when the dashboard ID changes. This prevents parent re-renders from overwriting the local drag state.

## Filtering

- Filters save the original unfiltered chart data in `unfilteredDataRef` before applying
- Clearing filters restores data from the ref — **no server round-trip**
- This avoids a previous infinite re-render loop caused by `dashboard?.charts` in the filter effect deps
