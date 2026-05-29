import { supabase } from './supabase'

// Guardado versionado de resultados de herramientas en Supabase (tabla tool_outputs).
// Todas las funciones capturan errores y devuelven null para no romper la UI.

export interface ToolOutput {
  id: string
  project_id: string
  tool_name: string
  content: unknown
  version: number
  created_at: string
}

export async function saveToolOutput(
  projectId: string,
  toolName: string,
  content: unknown
): Promise<ToolOutput | null> {
  try {
    // Calcular la siguiente versión a partir de la última existente
    const { data: last } = await supabase
      .from('tool_outputs')
      .select('version')
      .eq('project_id', projectId)
      .eq('tool_name', toolName)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (last?.version ?? 0) + 1

    const { data, error } = await supabase
      .from('tool_outputs')
      .insert({ project_id: projectId, tool_name: toolName, content, version: nextVersion })
      .select()
      .single()

    if (error) throw error
    return data as ToolOutput
  } catch (err) {
    console.error('saveToolOutput error:', err)
    return null
  }
}

export async function getToolOutput(
  projectId: string,
  toolName: string
): Promise<ToolOutput | null> {
  try {
    const { data, error } = await supabase
      .from('tool_outputs')
      .select('*')
      .eq('project_id', projectId)
      .eq('tool_name', toolName)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data as ToolOutput) ?? null
  } catch (err) {
    console.error('getToolOutput error:', err)
    return null
  }
}

export async function getToolHistory(
  projectId: string,
  toolName: string
): Promise<ToolOutput[]> {
  try {
    const { data, error } = await supabase
      .from('tool_outputs')
      .select('*')
      .eq('project_id', projectId)
      .eq('tool_name', toolName)
      .order('version', { ascending: false })

    if (error) throw error
    return (data as ToolOutput[]) ?? []
  } catch (err) {
    console.error('getToolHistory error:', err)
    return []
  }
}
