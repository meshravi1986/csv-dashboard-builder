# Session Summary — Build 2026-05-23

## Goal
Harden SQL injection surfaces, improve performance, remove dead code, fix bugs, and stabilize the CSV dashboard builder for production use.

## Changes

### Security Hardening
- **`_build_filter_sql()` returns `tuple[str, list]`**: All filter values use DuckDB positional parameters (`$1, $2, ...`) instead of raw string interpolation. 4 callers updated.
- **`read_parquet(?)` everywhere**: Parquet file paths parameterized in all queries — prevents path injection.

# Session Summary — 2026-05-24

## Goal
Fix remaining security gaps, remove dead code, eliminate duplication, improve performance, and clean up magic numbers.

## Changes

### Security
- **`preview_metric_sql`**: Removed raw SELECT execution path — now always wraps user expressions in parameterized `SELECT (...) as value FROM read_parquet(?)`. Dangerous function blocklist kept as defense-in-depth.
- **`_ALLOWED_AGG`**: Expanded from `{SUM, AVG, COUNT}` to all 6 types including `MIN, MAX, COUNT_DISTINCT`; updated `semantic_fields.aggregation` CHECK constraint in `docs/schema.sql` to match `metrics` table.

### Dead Code Removal
- **`backend/app/api/query.py`**: Deleted entire file (empty router stub, no routes registered).
- **Unused schemas**: Removed `DashboardListResponse`, `ColumnMatchResult`, `VersionInfo` from `schemas/api.py`.
- **`_extract_formula_columns()`**: Removed dead function from `visualization.py`.
- **Unused imports**: Removed `import polars as pl` from `profiling.py`, `import re` from `visualization.py`.
- **Function-local import**: Moved `from app.utils.duckdb import get_duckdb` inside `count_rows()` to top-level import.

### Duplication Cleanup
- **`_post_json` closures**: Extracted duplicate inline closures in `generate_dashboard()` and `create_dashboard_version()` into shared module-level `_supabase_post()` helper.
- **Column-match logic**: Extracted shared `find_matching_dashboards()` into `services/upload.py`; both `process_upload()` and `check_column_match()` call it.
- **OpenAI client**: Created `app/utils/openai_client.py` — single shared `OpenAI()` instance; `services/dashboard.py`, `services/semantic.py`, `services/metric_sql.py` all import from it.

### Performance
- **`update_dashboard()`**: Replaced N individual `chart_specs.insert()` calls with a single batch insert.

### Code Quality
- **Magic numbers**: Extracted `_MAX_FILTER_CARDINALITY=500`, `_MAX_FILTER_SUGGESTIONS=15`, `_MAX_PIE_CATEGORIES=20`, `_MAX_BAR_LABELS=50`, `_MAX_SCATTER_POINTS=1000` as named constants.

### Files Changed
- `backend/app/api/dashboards.py` — _supabase_post helper, _post_json removed, batch chart inserts, magic number constants, shared find_matching_dashboards call
- `backend/app/api/datasets.py` — preview_metric_sql security fix, _ALLOWED_AGG expanded
- `backend/app/api/query.py` — deleted
- `backend/app/engine/visualization.py` — _extract_formula_columns removed, unused re import removed, magic number constants
- `backend/app/engine/profiling.py` — unused polars import removed, get_duckdb import moved to top
- `backend/app/schemas/api.py` — DashboardListResponse, ColumnMatchResult, VersionInfo removed
- `backend/app/services/dashboard.py` — imports shared openai_client
- `backend/app/services/semantic.py` — imports shared openai_client
- `backend/app/services/metric_sql.py` — imports shared openai_client
- `backend/app/services/upload.py` — find_matching_dashboards helper added
- `backend/app/utils/openai_client.py` — new file, shared OpenAI client instance
- `docs/schema.sql` — semantic_fields.aggregation CHECK constraint expanded
- `docs/architecture.md` — updated SQL injection prevention docs, shared OpenAI client note
- **`safe_quote_ident()` validated column names**: Regex `_COLUMN_NAME_RE` limits to alphanumeric/underscore/space/dot/dash; embedded double-quotes escaped.
- **`_safe_quote_ident` typo fixed → `safe_quote_ident`**: NameError in `metrics.py` fixed (then whole function removed as dead code).
- **`resp.text` leaks removed**: `dashboards.py` lines 810, 919 no longer expose Supabase error details to client. Log lines 129, 301 also sanitized.
- **Aggregation whitelist (`_VALID_AGGS`)**: `duckdb.py:query_parquet()` validates aggregations before execution.
- **Raw SQL endpoint removed**: Entire `/api/v1/query` endpoint deleted from `query.py`; `query_router` import removed from `main.py`.
- **Dangerous DuckDB functions blocklisted**: `read_text, read_blob, read_file, glob, write_text`, etc.
- **Open redirect fix**: `auth/callback/route.ts` validates `next` against allowed paths.
- **No `database_url` in config**: Removed from settings; `extra = "ignore"` so leftover `.env` vars don't crash startup.
- **Login rate limiting**: Client-side 5 attempts → cooldown 30–300s.
- **`setLoading(true)` restored**: Was accidentally removed during PIN/rate-limiting edits.

### Code Quality & Dead Code Removal
- **6 unused schemas removed**: `QueryRequest`, `QueryResponse`, `DatasetResponse`, `ErrorResponse`, `BatchChartDataRequest`, `BatchChartDataResponse`.
- **Dead functions in `metrics.py`**: `compute_metric`, `compute_formula_metric`, `execute_query` removed. Only `_get_parquet_columns()` remains.
- **Dead imports cleaned**: `validate_column_name` from `visualization.py`, unused `query_router` from `main.py`.
- **Unused frontend types**: `ApiResponse`, `DashboardListResponse`, `SemanticState` removed.
- **Unused frontend utilities**: `formatNumber`, `formatPercent`, `truncate` removed.
- **`getSupabaseClient()` removed**: Wrapper function not used anywhere.
- **Redundant `import polars` removed**: Inside function body, never used.

### Performance
- **Connection pooling**: `queue.Queue` with 4 pre-warmed DuckDB connections replaces per-request `create/close`.
- **LRU cache for profiling**: Plain dict replaced with `OrderedDict`, capped at 50 entries, auto-eviction.
- **`_HAS_VERSIONING_COLUMNS` cache**: Module-level cached boolean, avoids repeated `limit(1)` queries.
- **`getChartOption()` memoized**: `useMemo` in `chart-card.tsx` prevents re-computation on every render.
- **`handleGroupDragEnd`/`handleKPIDragEnd`**: Converted to `useCallback`.
- **`SortableGroup` memoized**: Extracted as standalone memoized component.
- **`_PARSED_DATE_CACHE`**: Added to `formatters.ts` for cached `Date` object parsing.
- **Lazy `ProductTour`**: Switched from static import to `dynamic(() => import(...), { ssr: false })`.

### API Refactoring
- **Router prefix conflicts**: `dashboards.py` changed to `/api/v1/dashboards`. Created `datasets_router` at `/api/v1/datasets` for `generate_dashboard` and `column-match` routes. Registered in `main.py`.
- **Circular dependency fix**: `get_dataset()` moved to `upload.py`; dashboards.py imports from there.
- **`_build_filters_dict()` helper**: Extracted duplicate filter-building blocks in `dashboards.py`.
- **`_dedup()`, `_request()`, `_dedupRequest()` helpers**: Eliminate duplicate in-flight GETs and ~25 copies of `_authHeaders() + _fetch() + if (!res.ok)` boilerplate.
- **`preview_metric_sql` error handling**: Logs server-side; generic "SQL preview failed" to client.

### Dependency Fixes
- **`@dnd-kit/sortable` downgraded**: v10 → `^8.0.0` to match `@dnd-kit/core@6`. Eliminates duplicate bundles.

### Bug Fixes
- **`get_ai_chart_titles([])` removed**: Wasted OpenAI call for empty list.
- **`get_ai_dashboard_composition` wrapped in try/except**: Prevents AI failure from blocking dashboard generation.
- **`count_rows()` optimized**: Uses DuckDB `SELECT COUNT(*)` instead of loading all data.

### New Shared Code
- **`frontend/lib/chart-types.ts`**: `CHART_TYPES`, `ChartType`, `AGG_TYPES`, `AggType` shared constants — replaces raw string literals in types and pages.
- **`frontend/lib/chart-options.ts`**: Shared `getChartOption()` utility used by chart-card, chart-detail, view page.
- **`frontend/lib/formatters.ts`**: Cached `Intl.NumberFormat`/`Intl.DateTimeFormat` + `_PARSED_DATE_CACHE`.

### Config Cleanup
- **`frontend/lib/supabase.ts`**: Default bucket name extracted; unused `getSupabaseClient()` removed.
- **`backend/app/config.py`**: `database_url` removed; `extra = "ignore"` added to `BaseSettings.Config`.
- **`frontend/lib/utils.ts`**: Unused utility functions removed.
- **`frontend/package.json`**: `@dnd-kit/sortable` version pinned to `^8.0.0`.
- **`frontend/types/index.ts`**: Removed unused types, added `Tab` interface with `dashboard_id` + `created_at`.

### Files Changed
- `backend/app/api/dashboards.py` — Router prefix fix, datasets_router, filter helper, resp.text fixes
- `backend/app/api/datasets.py` — New file for dataset-specific routes (generate_dashboard, column-match)
- `backend/app/api/query.py` — Raw SQL endpoint removed
- `backend/app/api/metrics.py` — Dead functions removed
- `backend/app/config.py` — database_url removed, extra ignore
- `backend/app/engine/visualization.py` — _build_filter_sql params, safe_quote_ident
- `backend/app/engine/metrics.py` — Dead code removed
- `backend/app/engine/profiling.py` — LRU cache, parameterized queries
- `backend/app/engine/semantic_inference.py` — Parameterized read_parquet
- `backend/app/main.py` — Removed query_router import, registered datasets_router
- `backend/app/schemas/api.py` — 6 unused schemas removed
- `backend/app/services/dashboard.py` — try/except AI, removed wasted call
- `backend/app/services/upload.py` — get_dataset moved here
- `backend/app/utils/duckdb.py` — Connection pool, _VALID_AGGS, blocklist
- `frontend/app/(protected)/dashboards/page.tsx` — Updated types
- `frontend/app/(protected)/semantic/page.tsx` — Updated types
- `frontend/app/auth/callback/route.ts` — Open redirect whitelist
- `frontend/app/dashboard/[id]/view/page.tsx` — Updated types
- `frontend/app/login/page.tsx` — setLoading(true), rate limiting
- `frontend/components/dashboard/chart-card.tsx` — useMemo for chart options
- `frontend/components/dashboard/chart-detail.tsx` — Updated imports
- `frontend/components/dashboard/dashboard-view.tsx` — SortableGroup memoized, useCallback
- `frontend/lib/chart-options.ts` — New shared chart option utility
- `frontend/lib/chart-types.ts` — New shared chart type constants
- `frontend/lib/formatters.ts` — _PARSED_DATE_CACHE
- `frontend/lib/supabase.ts` — Cleanup unused wrappers
- `frontend/lib/utils.ts` — Removed unused functions
- `frontend/package.json` — dnd-kit version pinned
- `frontend/services/api.ts` — _dedup, _request, _dedupRequest helpers
- `frontend/types/index.ts` — Removed unused types, added Tab
