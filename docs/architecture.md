# Architecture Overview

## Flow
```
Upload CSV → Profile Dataset → Confirm Semantics → Define Metrics → Generate Dashboard → View/Edit
```

## Key Design Decisions

### Deterministic Analytics
Chart types are determined by field roles (date+measure→line, dimension+measure→bar, etc.).
AI never chooses chart types - only ranks and provides titles.

### Human-Owned Semantics
Users must explicitly confirm field roles. AI only suggests roles
which users can accept or override.

### DuckDB for Queries
All aggregations run via DuckDB in-memory inside the Railway container.
No external query engine needed.

### Parquet Storage
CSV files are converted to Parquet for efficient storage and querying.
Parquet files stored in Supabase Storage.

### Metadata-Driven Rendering
Dashboards render from chart_specs stored in the database.
No code generation involved.

## Technology Choices

- **Next.js App Router**: Single-page app with server-side auth
- **FastAPI**: Simple async Python API
- **DuckDB**: Embedded analytical SQL engine
- **Polars**: CSV to Parquet conversion
- **ECharts**: Rich charting library
- **Supabase**: Auth, storage, and database
- **OpenAI**: Optional AI enhancement (titles, suggestions)

## Data Flow

1. CSV uploaded → processed by FastAPI → converted to Parquet via Polars
2. Parquet stored in Supabase Storage → metadata in datasets table
3. Profile generated via DuckDB queries on Parquet
4. User confirms semantics → stored in semantic_fields table
5. Metrics defined → stored in metrics table
6. Dashboard generation → chart_specs created → stored in dashboards + chart_specs
7. Frontend renders charts via ECharts based on chart_specs
