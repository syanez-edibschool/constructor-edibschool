import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon,
  CalendarDaysIcon, DocumentArrowDownIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '../../services/supabase'
import { api } from '../../services/api'
import LoadingTrivia from '../ui/LoadingTrivia'
import { exportToPDF, exportToWord } from '../../services/exportContent'

// ─── Tipos del checklist (contenido FIJO, igual para todos los usuarios) ─────────
interface Item { task: string; bullets?: string[] }
interface Section { id: string; title: string; ai?: boolean; aiTool?: string; items: Item[]; entregable?: { intro: string; bullets: string[] } }
interface Phase { id: string; title: string; color: string; sections: Section[] }

// Convierte cualquier valor a texto (la IA o un error pueden venir como objeto).
function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { content?: unknown }
    if (typeof o.content === 'string') return o.content
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

const CHECKLIST: Phase[] = [
  {
    id: 'f2', title: 'FASE 2 — Construcción de Oferta', color: '#8357F6',
    sections: [
      {
        id: '2.1', title: '2.1 Definir tu Propuesta Única de Valor (PUV)', ai: true, aiTool: 'puv',
        items: [
          { task: 'Completar la fórmula: "Ayudo a [micronicho] a [resultado] mediante [solución IA], sin [objeción principal]."' },
          { task: 'Crear 3 versiones diferentes de tu propuesta.' },
          { task: 'Elegir la propuesta más clara y fácil de entender.' },
          { task: 'Compartirla con compañeros o mentor para recibir feedback.' },
          { task: 'Ajustarla hasta que comunique claramente el resultado que obtendrá el cliente.' },
        ],
        entregable: { intro: 'Tener una Propuesta Única de Valor final que utilizarás en:', bullets: ['Instagram', 'Página web', 'Presentaciones', 'DMs', 'Llamadas comerciales'] },
      },
      {
        id: '2.2', title: '2.2 Crear una Oferta Irresistible', ai: true, aiTool: 'oferta',
        items: [
          { task: 'Elegir una forma de reducir el riesgo para el cliente:', bullets: ['Auditoría gratuita', 'Demo personalizada', 'Prueba gratuita', 'Instalación inicial sin coste'] },
          { task: 'Definir exactamente qué recibirá el prospecto.' },
          { task: 'Explicar claramente qué resultado podrá experimentar.' },
          { task: 'Crear una explicación corta de la oferta para usar en DMs y llamadas.' },
        ],
      },
      {
        id: '2.3', title: '2.3 Crear un Lead Magnet', ai: true, aiTool: 'leadmagnet',
        items: [
          { task: 'Identificar el principal dolor de tu nicho.' },
          { task: 'Elegir el formato:', bullets: ['Checklist', 'PDF', 'Mini auditoría', 'Vídeo personalizado'] },
          { task: 'Crear un título atractivo.' },
          { task: 'Crear el contenido.' },
          { task: 'Preparar un formulario para entregarlo automáticamente.' },
        ],
      },
    ],
  },
  {
    id: 'f3', title: 'FASE 3 — Infraestructura Digital', color: '#C49DFF',
    sections: [
      {
        id: '3.1', title: '3.1 Crear tu Funnel o Sitio Web',
        items: [
          { task: 'Crear una página explicando:', bullets: ['Qué problema resuelves', 'Cómo lo solucionas', 'Qué beneficios obtiene el cliente'] },
          { task: 'Añadir una demostración o ejemplo.' },
          { task: 'Añadir un formulario o calendario para reservar una llamada.' },
          { task: 'Revisar que todo funcione correctamente.' },
        ],
      },
      {
        id: '3.2', title: '3.2 Configurar el Calendario',
        items: [
          { task: 'Crear tu calendario en GHL o Calendly.' },
          { task: 'Configurar horarios disponibles.' },
          { task: 'Activar confirmaciones automáticas.' },
          { task: 'Activar recordatorios de la reunión.' },
          { task: 'Realizar una reserva de prueba.' },
        ],
      },
      {
        id: '3.3', title: '3.3 Automatizaciones Básicas',
        items: [
          { task: 'Configurar email o mensaje de bienvenida.' },
          { task: 'Configurar recordatorios automáticos.' },
          { task: 'Configurar seguimiento para quienes no asistan.' },
          { task: 'Verificar que las automatizaciones funcionen correctamente.' },
        ],
      },
      {
        id: '3.4', title: '3.4 Automatización para Instagram',
        items: [
          { task: 'Configurar respuesta automática a comentarios.' },
          { task: 'Configurar mensaje privado automático.' },
          { task: 'Configurar el agente IA para responder preguntas frecuentes.' },
          { task: 'Probar todo el flujo completo.' },
        ],
      },
      {
        id: '3.5', title: '3.5 Crear tu Propuesta Comercial',
        items: [
          { task: 'Crear una plantilla profesional en Gamma.' },
          { task: 'Explicar el problema detectado.' },
          { task: 'Explicar la solución que propones.' },
          { task: 'Incluir precio y mantenimiento mensual.' },
          { task: 'Exportar la propuesta en PDF.' },
        ],
      },
    ],
  },
  {
    id: 'f4', title: 'FASE 4 — Instagram Estratégico', color: '#AF8AE6',
    sections: [
      {
        id: '4.1', title: '4.1 Optimizar el Perfil',
        items: [
          { task: 'Crear una foto profesional.' },
          { task: 'Optimizar nombre y bio.' },
          { task: 'Añadir CTA clara.' },
          { task: 'Conectar WhatsApp, calendario o funnel.' },
        ],
      },
      {
        id: '4.2', title: '4.2 Publicar Contenido Inicial',
        items: [
          { task: 'Subir entre 9 y 12 publicaciones antes de prospectar. Temas recomendados:', bullets: ['Qué problema resuelves', 'Qué es un agente IA', 'Errores comunes del sector', 'Beneficios económicos', 'Quién eres', 'Cómo trabajas'] },
        ],
      },
      {
        id: '4.3', title: '4.3 Crear Contenido Semanal',
        items: [
          { task: 'Publicar mínimo 3 veces por semana.' },
          { task: 'Crear carruseles educativos.' },
          { task: 'Crear reels explicativos.' },
          { task: 'Incluir llamadas a la acción.' },
        ],
      },
      {
        id: '4.4', title: '4.4 Movimiento Orgánico',
        items: [
          { task: 'Seguir entre 30 y 50 cuentas de tu nicho por día.' },
          { task: 'Interactuar con sus publicaciones.' },
          { task: 'Iniciar conversaciones por DM.' },
          { task: 'Registrar posibles prospectos.' },
        ],
      },
    ],
  },
  {
    id: 'f5', title: 'FASE 5 — Prospección Activa', color: '#F59E0B',
    sections: [
      {
        id: '5', title: 'Prospección diaria',
        items: [
          { task: 'Contactar 30 nuevos prospectos diarios.' },
          { task: 'Utilizar los scripts proporcionados.' },
          { task: 'Registrar todo en Excel.' },
          { task: 'Hacer seguimiento cada 48-72 horas.' },
          { task: 'Intentar llevar la conversación a una llamada.' },
        ],
      },
    ],
  },
  {
    id: 'f6', title: 'FASE 6 — Publicidad', color: '#10B981',
    sections: [
      {
        id: '6', title: 'Campañas',
        items: [
          { task: 'Validar primero la oferta mediante prospección orgánica.' },
          { task: 'Crear campañas de captación.' },
          { task: 'Crear campañas de retargeting.' },
          { task: 'Medir resultados semanalmente.' },
          { task: 'Escalar únicamente los anuncios rentables.' },
        ],
      },
    ],
  },
  {
    id: 'fh', title: 'Hábitos Obligatorios', color: '#6B7280',
    sections: [
      {
        id: 'hd', title: 'Todos los días',
        items: [
          { task: '30 nuevos contactos.' },
          { task: 'Seguimiento de conversaciones abiertas.' },
          { task: 'Responder mensajes.' },
          { task: 'Estudiar 30-60 minutos.' },
        ],
      },
      {
        id: 'hs', title: 'Todas las semanas',
        items: [
          { task: 'Publicar mínimo 3 contenidos.' },
          { task: 'Mejorar guiones de venta.' },
          { task: 'Hacer networking.' },
          { task: 'Revisar métricas y resultados.' },
        ],
      },
    ],
  },
]

const ALL_TASK_IDS: string[] = CHECKLIST.flatMap(p => p.sections.flatMap(s => s.items.map((_, i) => `${s.id}-${i}`)))
const TOTAL_TASKS = ALL_TASK_IDS.length

function checklistToText(checked: Set<string>): string {
  const out: string[] = ['# ESTRATEGIA 90 DÍAS', '']
  CHECKLIST.forEach(p => {
    out.push(`## ${p.title}`)
    p.sections.forEach(s => {
      out.push('', s.title)
      s.items.forEach((it, i) => {
        out.push(`- [${checked.has(`${s.id}-${i}`) ? 'x' : ' '}] ${it.task}`)
        it.bullets?.forEach(b => out.push(`    · ${b}`))
      })
      if (s.entregable) {
        out.push(`  📌 ${s.entregable.intro}`)
        s.entregable.bullets.forEach(b => out.push(`    · ${b}`))
      }
    })
    out.push('')
  })
  return out.join('\n')
}

const Spinner = () => (
  <span style={{ width: 12, height: 12, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
)

// ─── Sección (acordeón) ──────────────────────────────────────────────────────
function SectionCard({ section, color, checked, onToggle, onAI, aiText, aiBusy, aiErr }: {
  section: Section; color: string; checked: Set<string>; onToggle: (id: string) => void
  onAI: () => void; aiText?: string; aiBusy?: boolean; aiErr?: string
}) {
  const [open, setOpen] = useState(true)
  const done = section.items.filter((_, i) => checked.has(`${section.id}-${i}`)).length
  const pct = Math.round((done / section.items.length) * 100)

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${color}25`, overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', background: 'var(--card-bg)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{section.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {section.ai && (
            <span
              onClick={(e) => { e.stopPropagation(); if (!aiBusy) onAI() }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'linear-gradient(135deg,rgba(131,87,246,.15),rgba(196,157,255,.15))', border: '1px solid var(--border-h)', color: 'var(--accent)', cursor: aiBusy ? 'wait' : 'pointer' }}
            >
              {aiBusy ? <Spinner /> : <SparklesIcon style={{ width: 11, height: 11 }} />}
              {aiBusy ? 'Generando…' : 'Generar con IA'}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#10B981' : 'var(--text-3)' }}>{done}/{section.items.length}</span>
          {open ? <ChevronUpIcon style={{ width: 15, height: 15, color: 'var(--text-3)' }} /> : <ChevronDownIcon style={{ width: 15, height: 15, color: 'var(--text-3)' }} />}
        </div>
      </button>
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .4s ease' }} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              {section.items.map((it, i) => {
                const tid = `${section.id}-${i}`
                const isDone = checked.has(tid)
                return (
                  <div key={tid} style={{ marginBottom: 8 }}>
                    <div onClick={() => onToggle(tid)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `2px solid ${isDone ? '#10B981' : 'var(--border-h)'}`, background: isDone ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isDone && <CheckCircleIcon style={{ width: 12, height: 12, color: '#fff' }} />}
                      </div>
                      <p style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: isDone ? 'var(--text-3)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>{it.task}</p>
                    </div>
                    {it.bullets && (
                      <ul style={{ margin: '4px 0 0 30px', padding: 0, listStyle: 'none' }}>
                        {it.bullets.map((b, j) => (
                          <li key={j} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>· {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              {section.entregable && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(131,87,246,.06)', border: '1px solid rgba(131,87,246,.2)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>📌 {section.entregable.intro}</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {section.entregable.bullets.map((b, j) => (
                      <li key={j} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Resultado generado con IA (inline) */}
              {(aiErr || aiText) && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'rgba(196,157,255,.07)', border: '1px solid rgba(196,157,255,.28)' }}>
                  {aiErr ? (
                    <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{aiErr} <button onClick={onAI} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>Reintentar</button></p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em' }}>✨ Generado con IA</span>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button onClick={() => { navigator.clipboard.writeText(aiText || ''); toast.success('Copiado') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Copiar</button>
                          <button onClick={onAI} disabled={aiBusy} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: aiBusy ? 'wait' : 'pointer', fontSize: 11, fontWeight: 600 }}>Regenerar</button>
                        </div>
                      </div>
                      <pre style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{aiText}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Estrategia90D({ projectId }: { projectId: string }) {
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [aiText, setAiText] = useState<Record<string, string>>({})
  const [aiBusy, setAiBusy] = useState<Record<string, boolean>>({})
  const [aiErr, setAiErr] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancel = false
    async function load() {
      const { data } = await supabase
        .from('project_tools')
        .select('result_json')
        .eq('project_id', projectId)
        .eq('tool_id', 'estrategia90d')
        .maybeSingle()
      if (cancel) return
      const r = data?.result_json as { generated?: boolean; checked?: string[]; ai?: Record<string, string> } | null
      if (r?.generated) {
        setGenerated(true)
        setChecked(new Set(r.checked || []))
        if (r.ai) setAiText(r.ai)
      }
      setLoaded(true)
    }
    load()
    return () => { cancel = true }
  }, [projectId])

  const persist = async (gen: boolean, checkedSet: Set<string>, ai: Record<string, string>) => {
    await supabase.from('project_tools').upsert(
      { project_id: projectId, tool_id: 'estrategia90d', result_json: { generated: gen, checked: [...checkedSet], ai } as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'project_id,tool_id' },
    )
  }

  // "Generar": da la impresión de generar (loading breve) y muestra el checklist.
  const generate = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setGenerated(true)
      void persist(true, checked, aiText)
    }, 2200)
  }

  const toggle = (tid: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid); else next.add(tid)
      void persist(true, next, aiText)
      return next
    })
  }

  // Genera el contenido del bloque (PUV / oferta / lead magnet) INLINE con IA.
  const generateAI = async (s: Section) => {
    if (!s.aiTool || aiBusy[s.id]) return
    setAiBusy(p => ({ ...p, [s.id]: true }))
    setAiErr(p => ({ ...p, [s.id]: '' }))
    try {
      const { data } = await api.post(`/projects/${projectId}/tools/${s.aiTool}`)
      const content = asText(data?.result?.content ?? data?.result ?? data?.content)
      const nextAi = { ...aiText, [s.id]: content }
      setAiText(nextAi)
      void persist(true, checked, nextAi)
    } catch (e) {
      const err = e as { code?: string; response?: { data?: { error?: unknown } } }
      const apiMsg = typeof err?.response?.data?.error === 'string' ? err.response.data.error : null
      setAiErr(p => ({ ...p, [s.id]: err?.code === 'ECONNABORTED' ? 'Tardó demasiado. Reinténtalo.' : (apiMsg || 'No se pudo generar. Reinténtalo.') }))
    } finally {
      setAiBusy(p => ({ ...p, [s.id]: false }))
    }
  }

  const done = [...checked].filter(id => ALL_TASK_IDS.includes(id)).length
  const globalPct = TOTAL_TASKS > 0 ? Math.round((done / TOTAL_TASKS) * 100) : 0

  if (loading) {
    return <div style={{ padding: '40px 24px' }}><LoadingTrivia /></div>
  }

  if (!generated) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,rgba(131,87,246,.15),rgba(196,157,255,.15))', border: '1px solid rgba(131,87,246,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CalendarDaysIcon style={{ width: 30, height: 30, color: 'var(--accent)' }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Estrategia 90 Días</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto 24px' }}>
          Tu plan de acción completo para lanzar y escalar tu agencia de IA en 90 días: un checklist guiado por fases que puedes ir marcando.
        </p>
        <button onClick={generate} disabled={!loaded} style={{ padding: '14px 28px', borderRadius: 12, background: 'var(--accent)', color: '#000', border: 'none', fontSize: 15, fontWeight: 700, cursor: loaded ? 'pointer' : 'wait', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <SparklesIcon style={{ width: 18, height: 18 }} /> Generar plan 90 días
        </button>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Estrategia 90 Días</h2>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{done}/{TOTAL_TASKS} tareas · {globalPct}% completado</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportToPDF('Estrategia 90 Días', checklistToText(checked))} title="Descargar PDF" style={{ height: 34, padding: '0 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              <DocumentArrowDownIcon style={{ width: 15, height: 15 }} /> PDF
            </button>
            <button onClick={() => exportToWord('Estrategia 90 Días', checklistToText(checked))} title="Descargar Word" style={{ height: 34, padding: '0 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              <DocumentArrowDownIcon style={{ width: 15, height: 15 }} /> Word
            </button>
            <button onClick={() => { setChecked(new Set()); void persist(true, new Set(), aiText) }} title="Reiniciar marcas" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowPathIcon style={{ width: 15, height: 15, color: 'var(--text-2)' }} />
            </button>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${globalPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', background: 'linear-gradient(90deg,#8357F6,#C49DFF)', borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {CHECKLIST.map(phase => (
          <div key={phase.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: phase.color }} />
              <h3 style={{ fontSize: 13, fontWeight: 800, color: phase.color, letterSpacing: '0.02em' }}>{phase.title}</h3>
            </div>
            {phase.sections.map(s => (
              <SectionCard
                key={s.id} section={s} color={phase.color} checked={checked} onToggle={toggle}
                onAI={() => generateAI(s)} aiText={aiText[s.id]} aiBusy={aiBusy[s.id]} aiErr={aiErr[s.id]}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
