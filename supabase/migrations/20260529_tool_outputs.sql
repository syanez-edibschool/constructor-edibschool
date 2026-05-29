CREATE TABLE IF NOT EXISTS tool_outputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  content JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_outputs_project_tool ON tool_outputs(project_id, tool_name);

ALTER TABLE tool_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tool_outputs_policy ON tool_outputs;
CREATE POLICY tool_outputs_policy ON tool_outputs FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);
