-- ============================================================
-- ai_usage — registro de generaciones de IA por usuario.
-- Sirve para limitar las generaciones por hora (anti-abuso / control de costo).
-- Ejecuta esto UNA VEZ en: Supabase → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage(user_id, created_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve / inserta su propio uso.
DROP POLICY IF EXISTS ai_usage_select ON ai_usage;
CREATE POLICY ai_usage_select ON ai_usage FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_usage_insert ON ai_usage;
CREATE POLICY ai_usage_insert ON ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
