-- ============================================================
-- CONSTRUCTOR MVP — SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  progress    INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step INTEGER DEFAULT 1,
  total_steps  INTEGER DEFAULT 5,
  status      TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- ============================================================
-- PROJECT QUESTIONS (answers from the 30-question form)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  answers_json JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECT NICHO
-- ============================================================
CREATE TABLE IF NOT EXISTS project_nicho (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  sector      TEXT,
  micronicho  TEXT,
  tam         TEXT,
  ticket      TEXT,
  trend       TEXT,
  momento     TEXT,
  data_json   JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECT AVATAR
-- ============================================================
CREATE TABLE IF NOT EXISTS project_avatar (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT,
  age         TEXT,
  position    TEXT,
  experience  TEXT,
  income      TEXT,
  narrative   TEXT,
  data_json   JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECT COMPETENCIA
-- ============================================================
CREATE TABLE IF NOT EXISTS project_competencia (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  competitors_json JSONB DEFAULT '[]',
  positioning     TEXT,
  data_json       JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECT TOOLS (stores all generated tool outputs)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_tools (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_id     TEXT NOT NULL,
  result_json JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tools_project_id ON project_tools(project_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_nicho ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_avatar ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_competencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tools ENABLE ROW LEVEL SECURITY;

-- Projects: users can only see/edit their own
CREATE POLICY "users_own_projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Project sub-tables: users can access via their projects
CREATE POLICY "users_own_questions" ON project_questions
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_nicho" ON project_nicho
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_avatar" ON project_avatar
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_competencia" ON project_competencia
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_tools" ON project_tools
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_questions_updated_at
  BEFORE UPDATE ON project_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_nicho_updated_at
  BEFORE UPDATE ON project_nicho
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_avatar_updated_at
  BEFORE UPDATE ON project_avatar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_competencia_updated_at
  BEFORE UPDATE ON project_competencia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_tools_updated_at
  BEFORE UPDATE ON project_tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
