-- CSV Dashboard Builder Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    parquet_path TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0,
    file_size INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'profiled', 'semantic', 'ready')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semantic fields table
CREATE TABLE IF NOT EXISTS semantic_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('dimension', 'measure', 'date')),
    aggregation TEXT CHECK (aggregation IN ('SUM', 'AVG', 'COUNT')),
    formatting TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    expression TEXT NOT NULL,
    aggregation TEXT NOT NULL CHECK (aggregation IN ('SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT')),
    field_name TEXT NOT NULL DEFAULT '',
    formula TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chart specs table
CREATE TABLE IF NOT EXISTS chart_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    chart_type TEXT NOT NULL CHECK (chart_type IN ('line', 'bar', 'kpi', 'scatter', 'pie')),
    title TEXT NOT NULL,
    x_field TEXT NOT NULL,
    y_field TEXT NOT NULL,
    aggregation TEXT NOT NULL CHECK (aggregation IN ('SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT')),
    x_role TEXT NOT NULL CHECK (x_role IN ('dimension', 'date', 'measure')),
    y_role TEXT NOT NULL DEFAULT 'measure' CHECK (y_role = 'measure'),
    semantic_reasoning TEXT NOT NULL DEFAULT '',
    chart_reasoning TEXT NOT NULL DEFAULT '',
    aggregation_reasoning TEXT NOT NULL DEFAULT '',
    formula TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    width TEXT NOT NULL DEFAULT 'half' CHECK (width IN ('full', 'half')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard versioning columns (run after existing schema)
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS version_group_id UUID;
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS refresh_frequency TEXT NOT NULL DEFAULT 'Adhoc';

-- Dataset columns JSONB for fast column matching (run after existing schema)
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS columns JSONB;

-- Dashboard tabs for multi-tab reports
CREATE TABLE IF NOT EXISTS dashboard_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Tab 1',
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chart_specs ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES dashboard_tabs(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_semantic_fields_dataset_id ON semantic_fields(dataset_id);
CREATE INDEX IF NOT EXISTS idx_metrics_dataset_id ON metrics(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_dataset_id ON dashboards(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_version_group_id ON dashboards(version_group_id);
CREATE INDEX IF NOT EXISTS idx_chart_specs_dashboard_id ON chart_specs(dashboard_id);

-- Enable Row Level Security
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_specs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own datasets"
    ON datasets FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage semantic fields of their datasets"
    ON semantic_fields FOR ALL
    USING (
        dataset_id IN (
            SELECT id FROM datasets WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own metrics"
    ON metrics FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own dashboards"
    ON dashboards FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage chart specs of their dashboards"
    ON chart_specs FOR ALL
    USING (
        dashboard_id IN (
            SELECT id FROM dashboards WHERE user_id = auth.uid()
        )
    );

-- Storage bucket setup
-- Run this in Supabase SQL Editor:
-- CREATE BUCKET datasets;
-- Set bucket to private

-- Limited database role for backend application (recommended)
-- Instead of using the full service key, create a limited role and generate a JWT for it:
--
-- CREATE ROLE dashboard_app WITH NO LOGIN;
-- GRANT USAGE ON SCHEMA public TO dashboard_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON datasets TO dashboard_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON semantic_fields TO dashboard_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON metrics TO dashboard_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON dashboards TO dashboard_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON chart_specs TO dashboard_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON chart_specs TO dashboard_app;
--
-- Then create a custom JWT with `role` set to `dashboard_app` and
-- use it as SUPABASE_LIMITED_KEY in your backend .env.
-- See: https://supabase.com/docs/guides/database/secure-data#using-custom-roles-and-claims
