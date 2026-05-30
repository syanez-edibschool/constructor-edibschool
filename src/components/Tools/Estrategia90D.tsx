import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircleIcon, ChevronDownIcon, ChevronUpIcon,
  ArrowPathIcon, ArrowDownTrayIcon, SparklesIcon,
  CalendarDaysIcon, ListBulletIcon, TrophyIcon,
  DocumentArrowDownIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../services/api'
import { supabase } from '../../services/supabase'
import LoadingTrivia from '../ui/LoadingTrivia'
import { exportToPDF, exportToWord } from '../../services/exportContent'

// Detecta si una tarea es de contenido y a qué herramienta enlaza.
// Devuelve el toolId o null si no es tarea de contenido.
function contentToolFor(text: string): { toolId: string; label: string; color: string } | null {
  const t = text.toLowerCase()
  if (t.includes('reel')) return { toolId: 'reels', label: 'Reels', color: '#EC4899' }
  if (t.includes('carrusel') || t.includes('carousel')) return { toolId: 'carruseles', label: 'Carruseles', color: '#8B5CF6' }
  if (t.includes('story') || t.includes('stories') || t.includes('historia')) return { toolId: 'story', label: 'Story', color: '#00D9FF' }
  if (t.includes('post') || t.includes('publicaci')) return { toolId: 'carruseles', label: 'Carruseles', color: '#8B5CF6' }
  return null
}

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Task {
  id: string
  task: string
  completed: boolean
  week: number
  day: number | null
  priority: 'alta' | 'media' | 'baja'
  source: 'clone_ganador' | 'plan_agencia' | 'habito'
}

interface Phase {
  id: string
  phase: number
  title: string
  color: string
  week_start: number
  week_end: number
  tasks: Task[]
}

interface Day {
  day: number
  label: string
  tasks: string[]
}

interface Week {
  week: number
  label: string
  is_launch?: boolean
  days: Day[]
}

interface Plan {
  phases: Phase[]
  weeks: Week[]
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PHASE_COLORS: Record<number, string> = {
  2: '#00D9FF',
  3: '#8B5CF6',
  4: '#EC4899',
  5: '#F59E0B',
  6: '#10B981',
}

const SOURCE_COLORS: Record<string, string> = {
  clone_ganador: '#00D9FF',
  plan_agencia: '#8B5CF6',
  habito: '#6B7280',
}

const PRIORITY_COLORS: Record<string, string> = {
  alta: '#EF4444',
  media: '#F59E0B',
  baja: '#6B7280',
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ─── Task item ───────────────────────────────────────────────────────────────
function TaskItem({
  task,
  onToggle,
}: {
  task: Task
  onToggle: (id: string) => void
}) {
  return (
    <div
      onClick={() => onToggle(task.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
        background: task.completed ? 'rgba(16,185,129,0.05)' : 'transparent',
        border: `1px solid ${task.completed ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
        marginBottom: 6, transition: 'all .15s',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
        border: `2px solid ${task.completed ? '#10B981' : 'var(--border-h)'}`,
        background: task.completed ? '#10B981' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
      }}>
        {task.completed && <CheckCircleIcon style={{ width: 12, height: 12, color: '#fff' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, lineHeight: 1.5,
          color: task.completed ? 'var(--text-3)' : 'var(--text)',
          textDecoration: task.completed ? 'line-through' : 'none',
        }}>
          {task.task}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
            background: `${SOURCE_COLORS[task.source]}15`,
            color: SOURCE_COLORS[task.source],
            border: `1px solid ${SOURCE_COLORS[task.source]}30`,
          }}>
            {task.source === 'clone_ganador' ? 'Clone Ganador' : task.source === 'habito' ? 'Hábito' : 'Plan Agencia'}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
            background: `${PRIORITY_COLORS[task.priority]}15`,
            color: PRIORITY_COLORS[task.priority],
          }}>
            {task.priority}
          </span>
          {task.day && (
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
              Sem {task.week} · {DAY_LABELS[(task.day - 1) % 7]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Phase accordion ─────────────────────────────────────────────────────────
function PhaseAccordion({
  phase,
  filter,
  onToggleTask,
}: {
  phase: Phase
  filter: string
  onToggleTask: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  const visibleTasks = phase.tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'clone_ganador') return t.source === 'clone_ganador'
    if (filter === 'habito') return t.source === 'habito'
    return `fase-${phase.phase}` === filter
  })

  if (visibleTasks.length === 0) return null

  const done = visibleTasks.filter(t => t.completed).length
  const pct = Math.round((done / visibleTasks.length) * 100)

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${phase.color}30`, overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'var(--card-bg)', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: phase.color }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: phase.color }}>
            FASE {phase.phase} — {phase.title}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
            Sem {phase.week_start}-{phase.week_end}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#10B981' : 'var(--text-2)' }}>
            {done}/{visibleTasks.length} ({pct}%)
          </span>
          {open
            ? <ChevronUpIcon style={{ width: 16, height: 16, color: 'var(--text-3)' }} />
            : <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-3)' }} />}
        </div>
      </button>

      {/* progress bar */}
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: phase.color, transition: 'width .4s ease' }} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              {visibleTasks.map(task => (
                <TaskItem key={task.id} task={task} onToggle={onToggleTask} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Calendar week view ──────────────────────────────────────────────────────
function WeekView({
  week,
  plan,
  onToggleTask,
  onOpenTool,
}: {
  week: Week
  plan: Plan
  onToggleTask: (id: string) => void
  onOpenTool: (toolId: string, topic: string) => void
}) {
  const taskMap: Record<string, Task> = {}
  plan.phases.forEach(ph => ph.tasks.forEach(t => { taskMap[t.id] = t }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Semana {week.week}
        </h3>
        {week.is_launch && (
          <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#EF444420', color: '#EF4444', border: '1px solid #EF444430', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Lanzamiento
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{week.label}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 470, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {week.days.map(d => (
          <div key={d.day} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textAlign: 'center' }}>
                {DAY_LABELS[d.day - 1] || `D${d.day}`}
              </p>
            </div>
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 80 }}>
              {d.tasks.map(taskId => {
                const t = taskMap[taskId]
                if (!t) return null
                const ph = plan.phases.find(p => p.tasks.some(pt => pt.id === taskId))
                const color = ph ? (PHASE_COLORS[ph.phase] || ph.color) : '#6B7280'
                const content = contentToolFor(t.task)
                return (
                  <div
                    key={taskId}
                    style={{
                      padding: '4px 6px', borderRadius: 5, fontSize: 10, lineHeight: 1.3,
                      background: t.completed ? 'rgba(16,185,129,0.1)' : `${color}15`,
                      border: `1px solid ${t.completed ? 'rgba(16,185,129,0.3)' : `${color}30`}`,
                      borderLeft: content ? `3px solid ${content.color}` : undefined,
                      color: t.completed ? '#10B981' : color,
                      textDecoration: t.completed ? 'line-through' : 'none',
                    }}
                  >
                    <div
                      onClick={() => onToggleTask(taskId)}
                      title={t.task}
                      style={{
                        cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      } as React.CSSProperties}
                    >
                      {t.task}
                    </div>
                    {content && !t.completed && (
                      <button
                        onClick={() => onOpenTool(content.toolId, t.task)}
                        style={{
                          marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 2,
                          padding: '1px 5px', borderRadius: 999, fontSize: 8.5, fontWeight: 700,
                          background: `${content.color}20`, color: content.color,
                          border: `1px solid ${content.color}40`, cursor: 'pointer',
                        }}
                      >
                        {content.label} <ArrowRightIcon style={{ width: 8, height: 8 }} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

// ─── Month view ───────────────────────────────────────────────────────────────
function MonthView({ plan, month, onToggleTask }: { plan: Plan; month: 1 | 2 | 3; onToggleTask: (id: string) => void }) {
  const startWeek = (month - 1) * 4 + 1
  const endWeek = Math.min(startWeek + 3, 13)
  const weeks = (plan.weeks || []).filter(w => w.week >= startWeek && w.week <= endWeek)

  const taskMap: Record<string, Task> = {}
  plan.phases.forEach(ph => ph.tasks.forEach(t => { taskMap[t.id] = t }))

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Mes {month}</h3>
      {weeks.map(w => {
        const totalTasks = w.days.reduce((sum, d) => sum + d.tasks.length, 0)
        const doneTasks = w.days.reduce((sum, d) => sum + d.tasks.filter(id => taskMap[id]?.completed).length, 0)
        const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
        return (
          <div key={w.week} style={{ marginBottom: 10, borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Semana {w.week}</span>
                {w.is_launch && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999, background: '#EF444420', color: '#EF4444', border: '1px solid #EF444430' }}>
                    LANZAMIENTO
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: pct === 100 ? '#10B981' : 'var(--text-3)' }}>{doneTasks}/{totalTasks} ({pct}%)</span>
            </div>
            <div style={{ height: 3, background: 'var(--border)' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10B981' : 'var(--accent)', transition: 'width .4s ease' }} />
            </div>
            <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {w.days.slice(0, 5).map(d => (
                d.tasks.map(taskId => {
                  const t = taskMap[taskId]
                  if (!t) return null
                  const ph = plan.phases.find(p => p.tasks.some(pt => pt.id === taskId))
                  const color = ph ? (PHASE_COLORS[ph.phase] || ph.color) : '#6B7280'
                  return (
                    <span key={taskId} title={t.task} style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 999,
                      background: t.completed ? 'rgba(16,185,129,0.1)' : `${color}15`,
                      color: t.completed ? '#10B981' : color,
                      border: `1px solid ${t.completed ? 'rgba(16,185,129,0.3)' : `${color}30`}`,
                      maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.task}
                    </span>
                  )
                })
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Estrategia90D({ projectId }: { projectId: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { id: routeProjectId } = useParams<{ id: string }>()
  const cloneGanadorData = (location.state as any)?.cloneGanadorData ?? null

  const openTool = (toolId: string, topic: string) => {
    const pid = routeProjectId || projectId
    navigate(`/proyecto/${pid}/tools/${toolId}`, { state: { topic, hook: topic, fromCalendar: true } })
  }

  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [calView, setCalView] = useState<'month' | 'week'>('month')
  const [activeWeek, setActiveWeek] = useState(1)
  const [activeTab, setActiveTab] = useState<'checklist' | 'calendar'>('checklist')

  useEffect(() => {
    loadSaved()
  }, [projectId])

  const loadSaved = async () => {
    try {
      const { data } = await supabase
        .from('project_tools')
        .select('result_json')
        .eq('project_id', projectId)
        .eq('tool_id', 'estrategia90d')
        .single()

      if (data?.result_json) {
        setPlan(data.result_json as Plan)
      }
    } catch {
      // no saved plan yet
    }
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post(`/projects/${projectId}/tools/estrategia90d`, {
        projectId,
        cloneGanadorData,
      })

      if (!data.success) throw new Error(data.error || 'Error generando plan')

      let parsed: Plan
      try {
        parsed = JSON.parse(data.content)
      } catch {
        throw new Error('La respuesta de IA fue truncada. Intenta de nuevo (puede tardar hasta 3 minutos).')
      }

      if (!parsed.phases || parsed.phases.length === 0) {
        throw new Error('El plan generado está vacío. Intenta de nuevo.')
      }

      // Normalise weeks to always be an array
      if (!parsed.weeks) parsed.weeks = []

      setPlan(parsed)

      await supabase.from('project_tools').upsert({
        project_id: projectId,
        tool_id: 'estrategia90d',
        result_json: parsed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,tool_id' })
    } catch (err: any) {
      setError(err.message || 'Error generando el plan. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const toggleTask = async (taskId: string) => {
    if (!plan) return
    const updated: Plan = {
      ...plan,
      phases: plan.phases.map(ph => ({
        ...ph,
        tasks: ph.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t),
      })),
    }
    setPlan(updated)
    await supabase.from('project_tools').upsert({
      project_id: projectId,
      tool_id: 'estrategia90d',
      result_json: updated,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,tool_id' })
  }

  const exportCSV = () => {
    if (!plan) return
    const rows = [['Fase', 'Tarea', 'Semana', 'Día', 'Prioridad', 'Fuente', 'Completado']]
    plan.phases.forEach(ph => {
      ph.tasks.forEach(t => {
        rows.push([`Fase ${ph.phase} - ${ph.title}`, t.task, String(t.week), String(t.day || ''), t.priority, t.source, t.completed ? 'Sí' : 'No'])
      })
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'estrategia-90d.csv' }).click()
  }

  const planToText = (): string => {
    if (!plan) return ''
    const out: string[] = ['## Estrategia 90 Días', '']
    plan.phases.forEach(ph => {
      out.push(`## Fase ${ph.phase} — ${ph.title} (Semanas ${ph.week_start}-${ph.week_end})`)
      ph.tasks.forEach(t => {
        out.push(`- [${t.completed ? 'x' : ' '}] Sem ${t.week}${t.day ? ` D${t.day}` : ''} · ${t.task} (${t.priority})`)
      })
      out.push('')
    })
    return out.join('\n')
  }

  const exportPDF = () => exportToPDF('Estrategia 90 Dias', planToText())
  const exportWord = () => exportToWord('Estrategia 90 Dias', planToText())

  const allTasks = plan ? plan.phases.flatMap(ph => ph.tasks) : []
  const done = allTasks.filter(t => t.completed).length
  const total = allTasks.length
  const globalPct = total > 0 ? Math.round((done / total) * 100) : 0

  // ── Empty state ──
  if (!plan && !loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,rgba(0,217,255,.15),rgba(139,92,246,.15))', border: '1px solid rgba(0,217,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CalendarDaysIcon style={{ width: 30, height: 30, color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Estrategia 90 Días</h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto 24px' }}>
            Plan de acción completo para lanzar y escalar tu agencia de IA en 90 días. Checklist combinado con calendario visual.
          </p>

          {cloneGanadorData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)', marginBottom: 20, justifyContent: 'center' }}>
              <TrophyIcon style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                Usando insights de Clone Ganador: {cloneGanadorData.handle}
              </p>
            </div>
          )}

          <button
            onClick={generate}
            style={{ padding: '14px 28px', borderRadius: 12, background: 'var(--accent)', color: '#000', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <SparklesIcon style={{ width: 18, height: 18 }} />
            Generar plan 90 días
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <LoadingTrivia />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 600, marginBottom: 4 }}>Error al generar el plan</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{error}</p>
        </div>
        <button onClick={generate} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--accent)', color: '#000', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Intentar de nuevo
        </button>
      </div>
    )
  }

  if (!plan) return null

  // ── Success ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Estrategia 90 Días</h2>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{done}/{total} tareas · {globalPct}% completado</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={generate} title="Regenerar" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowPathIcon style={{ width: 15, height: 15, color: 'var(--text-2)' }} />
            </button>
            <button onClick={exportCSV} title="Exportar CSV" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownTrayIcon style={{ width: 15, height: 15, color: 'var(--text-2)' }} />
            </button>
            <button onClick={exportPDF} title="Descargar PDF" style={{ height: 34, padding: '0 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              <DocumentArrowDownIcon style={{ width: 15, height: 15 }} /> PDF
            </button>
            <button onClick={exportWord} title="Descargar Word" style={{ height: 34, padding: '0 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              <DocumentArrowDownIcon style={{ width: 15, height: 15 }} /> Word
            </button>
          </div>
        </div>

        {/* Global progress */}
        <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: 12 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${globalPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ height: '100%', background: 'linear-gradient(90deg,#00D9FF,#8B5CF6)', borderRadius: 999 }}
          />
        </div>

        {/* Clone Ganador banner */}
        {cloneGanadorData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,217,255,0.06)', border: '1px solid rgba(0,217,255,0.15)', marginBottom: 10 }}>
            <TrophyIcon style={{ width: 14, height: 14, color: '#F59E0B', flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
              Usando insights de Clone Ganador: {cloneGanadorData.handle}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([['checklist', ListBulletIcon, 'Checklist'], ['calendar', CalendarDaysIcon, 'Calendario']] as const).map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', transition: 'all .15s',
                background: activeTab === tab ? 'var(--accent-d)' : 'transparent',
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-3)',
                borderColor: activeTab === tab ? 'var(--border-h)' : 'transparent',
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* ── CHECKLIST ── */}
        {activeTab === 'checklist' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'clone_ganador', label: 'Clone Ganador' },
                { id: 'fase-2', label: 'Fase 2 · Oferta' },
                { id: 'fase-3', label: 'Fase 3 · Infra' },
                { id: 'fase-4', label: 'Fase 4 · Instagram' },
                { id: 'fase-5', label: 'Fase 5 · Prospección' },
                { id: 'fase-6', label: 'Fase 6 · Publicidad' },
                { id: 'habito', label: 'Hábitos' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', transition: 'all .15s',
                    background: activeFilter === f.id ? 'var(--accent)' : 'var(--surface)',
                    color: activeFilter === f.id ? '#000' : 'var(--text-2)',
                    borderColor: activeFilter === f.id ? 'transparent' : 'var(--border)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {plan.phases.map(phase => (
              <PhaseAccordion
                key={phase.id}
                phase={phase}
                filter={activeFilter}
                onToggleTask={toggleTask}
              />
            ))}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {activeTab === 'calendar' && (
          <div>
            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['month', 'week'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: calView === v ? 'var(--accent-d)' : 'transparent',
                    color: calView === v ? 'var(--accent)' : 'var(--text-3)',
                    border: `1px solid ${calView === v ? 'var(--border-h)' : 'transparent'}`,
                  }}
                >
                  {v === 'month' ? 'Por Mes' : 'Por Semana'}
                </button>
              ))}
            </div>

            {calView === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
                {([1, 2, 3] as const).map(m => (
                  <MonthView key={m} plan={plan} month={m} onToggleTask={toggleTask} />
                ))}
              </div>
            )}

            {calView === 'week' && (
              <div>
                {/* Week selector */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                  {(plan.weeks || []).map(w => (
                    <button
                      key={w.week}
                      onClick={() => setActiveWeek(w.week)}
                      style={{
                        width: 36, height: 36, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: activeWeek === w.week ? 'var(--accent)' : w.is_launch ? 'rgba(239,68,68,0.1)' : 'var(--surface)',
                        color: activeWeek === w.week ? '#000' : w.is_launch ? '#EF4444' : 'var(--text-2)',
                        border: `1px solid ${activeWeek === w.week ? 'transparent' : w.is_launch ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                      }}
                    >
                      {w.week}
                    </button>
                  ))}
                </div>

                {(plan.weeks || [])
                  .filter(w => w.week === activeWeek)
                  .map(w => (
                    <WeekView key={w.week} week={w} plan={plan} onToggleTask={toggleTask} onOpenTool={openTool} />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
