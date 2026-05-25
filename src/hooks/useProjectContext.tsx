import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'

export interface ProjectContext {
  nicho:       Record<string, unknown> | null
  avatar:      Record<string, unknown> | null
  competencia: Record<string, unknown> | null
  calendario:  Record<string, unknown> | null
  vsl:         Record<string, unknown> | null
  propuesta:   Record<string, unknown> | null
  precios:     Record<string, unknown> | null
  website:     Record<string, unknown> | null
  contrato:    Record<string, unknown> | null
  tracker:     Record<string, unknown> | null
  estrategia:  Record<string, unknown> | null
  casos:       Record<string, unknown> | null
  copys:       Record<string, unknown>[]
  carruseles:  Record<string, unknown>[]
  reels:       Record<string, unknown>[]
  imagenes:    Record<string, unknown>[]
  emails:      Record<string, unknown>[]
  completedTools: string[]
}

const EMPTY: ProjectContext = {
  nicho: null, avatar: null, competencia: null,
  calendario: null, vsl: null, propuesta: null, precios: null,
  website: null, contrato: null, tracker: null,
  estrategia: null, casos: null,
  copys: [], carruseles: [], reels: [], imagenes: [], emails: [],
  completedTools: [],
}

const MULTI_TOOLS = new Set(['copy', 'carruseles', 'reels', 'imagenes', 'emails'])

export function useProjectContext(projectId: string | null | undefined) {
  const [context, setContext] = useState<ProjectContext>(EMPTY)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [nichoRes, avatarRes, compRes, toolsRes] = await Promise.all([
        supabase.from('project_nicho').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('project_avatar').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('project_competencia').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('project_tools').select('tool_id,result_json').eq('project_id', projectId),
      ])

      const tools = (toolsRes.data || []) as Array<{ tool_id: string; result_json: Record<string, unknown> }>
      const completedTools = tools.map(t => t.tool_id)

      const byId = (id: string) => tools.find(t => t.tool_id === id)?.result_json ?? null
      const allById = (id: string) => tools.filter(t => t.tool_id === id).map(t => t.result_json)

      setContext({
        nicho:       (nichoRes.data as Record<string, unknown> | null) ?? null,
        avatar:      (avatarRes.data as Record<string, unknown> | null) ?? null,
        competencia: (compRes.data as Record<string, unknown> | null) ?? null,
        calendario:  byId('calendario'),
        vsl:         byId('vsl'),
        propuesta:   byId('propuesta'),
        precios:     byId('precios'),
        website:     byId('website'),
        contrato:    byId('contrato'),
        tracker:     byId('tracker'),
        estrategia:  byId('estrategia'),
        casos:       byId('casos'),
        copys:       allById('copy'),
        carruseles:  allById('carruseles'),
        reels:       allById('reels'),
        imagenes:    allById('imagenes'),
        emails:      allById('emails'),
        completedTools,
      })
    } catch (err) {
      console.error('[useProjectContext]', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  return { context, loading, refreshContext: load }
}

// Visible context summary for tool panels
export function ContextBadges({ context }: { context: ProjectContext }) {
  const items = [
    context.nicho     && { label: `Nicho: ${(context.nicho as any)?.micronicho || '✓'}`, color: '#00D9FF' },
    context.avatar    && { label: `Avatar: ${(context.avatar as any)?.name || '✓'}`, color: '#8B5CF6' },
    context.calendario && { label: `Calendario: ${(context.calendario as any)?.weeks?.length || '?'} semanas`, color: '#EC4899' },
    context.copys?.length && { label: `Copys: ${context.copys.length}`, color: '#10B981' },
  ].filter(Boolean) as { label: string; color: string }[]

  if (items.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', marginBottom: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>
        Contexto
      </span>
      {items.map(item => (
        <span key={item.label} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: `${item.color}18`, color: item.color, border: `1px solid ${item.color}30`, fontWeight: 600 }}>
          {item.label}
        </span>
      ))}
    </div>
  )
}

// Unused export kept for completeness
export { MULTI_TOOLS }
