-- Playwright Dashboard Database Schema
-- Run this in Neon to create the required tables

-- Test runs table - stores each test run
CREATE TABLE IF NOT EXISTS test_runs (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    run_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stats_total INTEGER NOT NULL DEFAULT 0,
    stats_passed INTEGER NOT NULL DEFAULT 0,
    stats_failed INTEGER NOT NULL DEFAULT 0,
    stats_skipped INTEGER NOT NULL DEFAULT 0,
    stats_duration INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(50) DEFAULT 'ci-upload',
    exit_code INTEGER DEFAULT 0,
    suites JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_timestamp ON test_runs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_project_timestamp ON test_runs(project_id, timestamp DESC);

-- Projects table - stores project metadata
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    base_url VARCHAR(500),
    port INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default projects
INSERT INTO projects (id, name, base_url, port) VALUES
    ('sorring-udlejning', 'Sorring Udlejning', 'https://sorringudlejning.dk', 3002),
    ('wodforge', 'WODForge', 'https://wodforge.exe.pm', 3000),
    ('calify', 'Calify', 'https://calify.it', 3020),
    ('kanban', 'Kanban Board', 'https://kanban.exe.pm', 3010),
    ('grablist', 'Grablist', 'https://grablist.org', 3040),
    ('sorring3d', 'Sorring 3D', 'https://sorring3d.dk', 3050),
    ('playwright', 'Playwright Dashboard', 'https://playwright.exe.pm', 3030)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Manual Testing Tables
-- ============================================

-- Manual test sessions - stores each manual test session
CREATE TABLE IF NOT EXISTS manual_test_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) UNIQUE NOT NULL,
    project_id VARCHAR(100) NOT NULL REFERENCES projects(id),
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, cancelled
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_items INTEGER DEFAULT 0,
    passed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    skipped_items INTEGER DEFAULT 0,
    created_by VARCHAR(100),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_manual_sessions_project ON manual_test_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_manual_sessions_status ON manual_test_sessions(status);

-- Manual test items - stores each item in a manual test session
CREATE TABLE IF NOT EXISTS manual_test_items (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES manual_test_sessions(session_id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    category VARCHAR(100),
    title TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, passed, failed, skipped
    error_description TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    tested_at TIMESTAMPTZ,
    kanban_card_id VARCHAR(50),
    UNIQUE(session_id, item_index)
);

CREATE INDEX IF NOT EXISTS idx_manual_items_session ON manual_test_items(session_id);
CREATE INDEX IF NOT EXISTS idx_manual_items_category ON manual_test_items(session_id, category);
