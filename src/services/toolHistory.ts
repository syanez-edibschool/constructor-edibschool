import { supabase } from './supabase'

// Historial de generaciones por herramienta.
// Se guarda como un array dentro de project_tools bajo tool_id = `${toolId}__history`
// (project_tools ya funciona en producción y respeta RLS; no requiere migraciones nuevas).
// Todas las funciones capturan errores y no rompen la UI.

export interface HistoryEntry {
  content: unknown
  created_at: string
}

const HISTORY_LIMIT = 30
const key = (toolId: string) => `${toolId}__history`

export async function getHistory(projectId: string, toolId: string): Promise<HistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('project_tools')
      .select('result_json')
      .eq('project_id', projectId)
      .eq('tool_id', key(toolId))
      .maybeSingle()
    if (error) throw error
    const items = (data?.result_json as { items?: HistoryEntry[] } | null)?.items
    return Array.isArray(items) ? items : []
  } catch (err) {
    console.error('getHistory error:', err)
    return []
  }
}

export async function saveToHistory(projectId: string, toolId: string, content: unknown): Promise<void> {
  try {
    const current = await getHistory(projectId, toolId)
    const entry: HistoryEntry = { content, created_at: new Date().toISOString() }
    const items = [entry, ...current].slice(0, HISTORY_LIMIT)
    const { error } = await supabase.from('project_tools').upsert({
      project_id: projectId,
      tool_id: key(toolId),
      result_json: { items },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,tool_id' })
    if (error) throw error
  } catch (err) {
    console.error('saveToHistory error:', err)
  }
}
