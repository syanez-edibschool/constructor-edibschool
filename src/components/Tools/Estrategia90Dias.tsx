import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TrophyIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../services/supabase'

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Task { id: string; task: string; hours: number; category: string }
interface Phase { key: string; name: string; range: string; color: string; tasks: Task[] }

const PHASES: Phase[] = [
  {
    key: 'foundation',
    name: 'Foundation',
    range: 'Sem 1–2',
    color: '#00D9FF',
    tasks: [
      { id: 'f1', task: 'Analizar 10 competidores del nicho',              hours: 3,  category: 'research'  },
      { id: 'f2', task: 'Definir propuesta de valor única (PUV)',           hours: 2,  category: 'strategy'  },
      { id: 'f3', task: 'Crear 3 perfiles de cliente ideal (avatar)',       hours: 3,  category: 'research'  },
      { id: 'f4', task: 'Setup herramientas: email, CRM, Calendly',         hours: 2,  category: 'ops'       },
      { id: 'f5', task: 'Validar pricing con 5 conversaciones de mercado',  hours: 3,  category: 'sales'     },
      { id: 'f6', task: 'Registrar marca / dominio / redes sociales',       hours: 1,  category: 'ops'       },
    ],
  },
  {
    key: 'content',
    name: 'Content',
    range: 'Sem 3–4',
    color: '#8B5CF6',
    tasks: [
      { id: 'c1', task: 'Generar calendario de contenido (4 semanas)',      hours: 2,  category: 'content'   },
      { id: 'c2', task: 'Grabar y editar 4 reels de lanzamiento',           hours: 8,  category: 'content'   },
      { id: 'c3', task: 'Escribir 8 copys para posts y ads',                hours: 4,  category: 'content'   },
      { id: 'c4', task: 'Diseñar 3 carruseles informativos',                hours: 5,  category: 'content'   },
      { id: 'c5', task: 'Crear lead magnet (PDF o mini-curso)',              hours: 4,  category: 'content'   },
      { id: 'c6', task: 'Publicar contenido primero (3x/semana)',           hours: 6,  category: 'content'   },
    ],
  },
  {
    key: 'launch',
    name: 'Launch',
    range: 'Sem 5–6',
    color: '#EC4899',
    tasks: [
      { id: 'l1', task: 'Crear landing page de captación de leads',         hours: 5,  category: 'tech'      },
      { id: 'l2', task: 'Configurar secuencia de email (3–5 emails)',        hours: 4,  category: 'ops'       },
      { id: 'l3', task: 'Integrar email con CRM (HubSpot / Notion)',        hours: 2,  category: 'tech'      },
      { id: 'l4', task: 'Activar lead magnet y formulario de captura',      hours: 2,  category: 'tech'      },
      { id: 'l5', task: 'Enviar a 50 contactos del nicho (outreach cálido)', hours: 4, category: 'sales'     },
    ],
  },
  {
    key: 'sales',
    name: 'Sales',
    range: 'Sem 7–8',
    color: '#F59E0B',
    tasks: [
      { id: 's1', task: 'Crear propuesta comercial PDF profesional',        hours: 3,  category: 'sales'     },
      { id: 's2', task: 'Grabar VSL de 3–5 minutos',                       hours: 5,  category: 'content'   },
      { id: 's3', task: 'Crear página de servicios y precios',              hours: 3,  category: 'tech'      },
      { id: 's4', task: 'Hacer 10 calls de discovery con prospectos',       hours: 5,  category: 'sales'     },
      { id: 's5', task: 'Optimizar pitch según feedback de calls',          hours: 2,  category: 'strategy'  },
      { id: 's6', task: 'Enviar 3 propuestas formales',                     hours: 3,  category: 'sales'     },
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    range: 'Sem 9–12',
    color: '#10B981',
    tasks: [
      { id: 'g1', task: 'Publicar contenido constante (8 posts/semana)',    hours: 20, category: 'content'   },
      { id: 'g2', task: 'Outreach diario: 5–10 personas/día en nicho',      hours: 10, category: 'sales'     },
      { id: 'g3', task: 'Iterar oferta según feedback del mercado',         hours: 3,  category: 'strategy'  },
      { id: 'g4', task: 'Cerrar primeros 2–3 clientes',                    hours: 5,  category: 'sales'     },
      { id: 'g5', task: 'Documentar proceso de onboarding de cliente',      hours: 2,  category: 'ops'       },
      { id: 'g6', task: 'Medir KPIs semanales y ajustar estrategia',        hours: 4,  category: 'strategy'  },
    ],
  },
]

const CATEGORIES: Record<string, { label: string; color: string }> = {
  all:      { label: 'Todas',     color: 'var(--accent)' },
  research: { label: 'Research',  color: '#00D9FF'       },
  strategy: { label: 'Estrategia',color: '#8B5CF6'       },
  content:  { label: 'Contenido', color: '#EC4899'       },
  sales:    { label: 'Ventas',    color: '#F59E0B'       },
  ops:      { label: 'Ops',       color: '#6B7280'       },
  tech:     { label: 'Tech',      color: '#10B981'       },
}

const SUMMARY_STATS = [
  { label: 'Total horas',      value: '104h',  color: '#00D9FF' },
  { label: 'Duración',         value: '90 días', color: '#8B5CF6' },
  { label: 'Leads esperados',  value: '12–20', color: '#EC4899' },
  { label: 'Clientes meta',    value: '2–3',   color: '#10B981' },
]

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { projectId: string }

export default function Estrategia90Dias({ projectId }: Props) {
  const [activePhase, setActivePhase]       = useState<string>('foundation')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [completed, setCompleted]           = useState<Set<string>>(new Set())
  const [saving, setSaving]                 = useState(false)

  // Load saved checkboxes from project_tools
  useEffect(() => {
    supabase
      .from('project_tools')
      .select('result_json')
      .eq('project_id', projectId)
      .eq('tool_id', 'estrategia')
      .maybeSingle()
      .then(({ data }) => {
        const saved = data?.result_json as { completedTasks?: string[] } | null
        if (saved?.completedTasks) {
          setCompleted(new Set(saved.completedTasks))
        }
      })
  }, [projectId])

  const saveCompleted = useCallback(async (next: Set<string>) => {
    setSaving(true)
    await supabase
      .from('project_tools')
      .upsert({
        project_id: projectId,
        tool_id: 'estrategia',
        result_json: { completedTasks: Array.from(next) },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,tool_id' })
    setSaving(false)
  }, [projectId])

  const toggleTask = (taskId: string) => {
    setCompleted(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      saveCompleted(next)
      return next
    })
  }

  const phase = PHASES.find(p => p.key === activePhase)!
  const allTasks = PHASES.flatMap(p => p.tasks)
  const completedCount = allTasks.filter(t => completed.has(t.id)).length
  const totalCount = allTasks.length
  const progressPct = Math.round((completedCount / totalCount) * 100)

  const filteredTasks = phase.tasks.filter(
    t => categoryFilter === 'all' || t.category === categoryFilter
  )

  return (
    <div>
      {/* Title + Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Estrategia 90 Días</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {completedCount}/{totalCount} tareas · {progressPct}% completado
              {saving && <span style={{ marginLeft: 8, color: 'var(--accent)' }}>Guardando…</span>}
            </p>
          </div>
        </div>
        {/* Overall progress bar */}
        <div style={{ height: 5, borderRadius: 999, background: 'var(--card-bg)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
            style={{ height: '100%', background: 'linear-gradient(90deg, #00D9FF, #8B5CF6, #10B981)', borderRadius: 999 }}
          />
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {SUMMARY_STATS.map(s => (
          <div key={s.label} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Phase tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {PHASES.map(p => {
          const pTasks = p.tasks
          const pDone = pTasks.filter(t => completed.has(t.id)).length
          const isActive = activePhase === p.key
          return (
            <button
              key={p.key}
              onClick={() => setActivePhase(p.key)}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${isActive ? p.color + '60' : 'var(--border)'}`,
                background: isActive ? p.color + '18' : 'var(--surface)',
                color: isActive ? p.color : 'var(--text-2)',
                transition: 'all .15s',
              }}
            >
              {p.name}
              <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>{p.range}</span>
              <span style={{ fontSize: 9, marginLeft: 6, fontWeight: 600, color: pDone === pTasks.length ? '#10B981' : 'var(--text-3)' }}>
                {pDone}/{pTasks.length}
              </span>
            </button>
          )
        })}
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', alignSelf: 'center', marginRight: 4 }}>Filtrar:</span>
        {Object.entries(CATEGORIES).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${categoryFilter === key ? cfg.color + '60' : 'var(--border)'}`,
              background: categoryFilter === key ? cfg.color + '18' : 'transparent',
              color: categoryFilter === key ? cfg.color : 'var(--text-3)',
              transition: 'all .12s',
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredTasks.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '32px 0' }}>
            No hay tareas en esta categoría para esta fase.
          </p>
        )}
        {filteredTasks.map((task, i) => {
          const isDone = completed.has(task.id)
          const catCfg = CATEGORIES[task.category] || CATEGORIES.ops
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => toggleTask(task.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 12, cursor: 'pointer',
                background: isDone ? 'var(--card-bg)' : 'var(--surface)',
                border: `1px solid ${isDone ? 'var(--border)' : phase.color + '20'}`,
                opacity: isDone ? 0.6 : 1,
                transition: 'all .15s',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: isDone ? '#10B981' : 'transparent',
                border: `2px solid ${isDone ? '#10B981' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}>
                {isDone && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>

              {/* Task info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: isDone ? 400 : 600, color: isDone ? 'var(--text-3)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3 }}>
                  {task.task}
                </p>
              </div>

              {/* Category badge */}
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: catCfg.color + '18', color: catCfg.color, border: `1px solid ${catCfg.color}30`, fontWeight: 700, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {catCfg.label}
              </span>

              {/* Hours */}
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'monospace' }}>
                {task.hours}h
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* Phase completion message */}
      {phase.tasks.every(t => completed.has(t.id)) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12, background: '#10B98115', border: '1px solid #10B98130', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <TrophyIcon style={{ width: 20, height: 20, color: '#10B981', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>Fase {phase.name} completada</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {activePhase === 'growth' ? '¡Estrategia de 90 días completada!' : `Pasa a la siguiente fase: ${PHASES[PHASES.findIndex(p => p.key === activePhase) + 1]?.name}`}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
