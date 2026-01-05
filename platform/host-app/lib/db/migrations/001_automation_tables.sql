-- Automation Service Database Schema
-- Run this migration in Supabase SQL Editor

-- Task types enum
CREATE TYPE automation_task_type AS ENUM (
  'scheduled',    -- Periodic tasks (lottery draw, compound)
  'conditional',  -- Condition-based triggers (time-capsule, heritage)
  'subscription'  -- Data subscriptions (datafeed)
);

-- Task status enum
CREATE TYPE automation_task_status AS ENUM (
  'active',
  'paused',
  'completed',
  'failed'
);

-- Main tasks table
CREATE TABLE automation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  task_type automation_task_type NOT NULL,
  task_name TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status automation_task_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, task_name)
);

-- Schedules table for timing configuration
CREATE TABLE automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES automation_tasks(id) ON DELETE CASCADE,
  cron_expression TEXT,
  interval_seconds INTEGER,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  max_runs INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution logs
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES automation_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  result JSONB,
  error TEXT,
  duration_ms INTEGER,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_app_id ON automation_tasks(app_id);
CREATE INDEX idx_tasks_status ON automation_tasks(status);
CREATE INDEX idx_schedules_next_run ON automation_schedules(next_run_at);
CREATE INDEX idx_logs_task_id ON automation_logs(task_id);
CREATE INDEX idx_logs_executed_at ON automation_logs(executed_at);

-- RLS Policies
ALTER TABLE automation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON automation_tasks
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON automation_schedules
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON automation_logs
  FOR ALL USING (auth.role() = 'service_role');
