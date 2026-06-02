import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeftIcon, ArrowDownTrayIcon, ArrowPathIcon, DocumentTextIcon,
  GlobeAltIcon, DevicePhoneMobileIcon, FunnelIcon, CpuChipIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../services/api'
import { exportToPDF, exportToWord } from '../../services/exportContent'
import toast from 'react-hot-toast'

type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>

// ─── Service types ──────────────────────────────────────────────────────────────
const SERVICE_TYPES: { id: string; label: string; Icon: IconComp; color: string; range: string; desc: string }[] = [
  {
    id: 'sitios-web',
    label: 'Sitios Web',
    Icon: GlobeAltIcon,
    color: '#00D9FF',
    range: '€800–2.000',
    desc: 'Diseño y desarrollo de landing pages, portfolios y webs corporativas con IA',
  },
  {
    id: 'agencia-contenido',
    label: 'Agencia de Contenido',
    Icon: DevicePhoneMobileIcon,
    color: '#EC4899',
    range: '€400–600/mes',
    desc: 'Gestión mensual de redes sociales, creación de contenido y estrategia editorial',
  },
  {
    id: 'sistema-adquisicion',
    label: 'Sistema de Adquisición',
    Icon: FunnelIcon,
    color: '#F59E0B',
    range: '€800–2.000 + recurrencia',
    desc: 'Embudo completo de captación de clientes: ads, automatización y seguimiento',
  },
  {
    id: 'agentes-ia',
    label: 'Agentes IA',
    Icon: CpuChipIcon,
    color: '#8B5CF6',
    range: '€1.000–5.000',
    desc: 'Implementación de agentes de IA para ventas, soporte y operaciones internas',
  },
]

const QUESTIONS = [
  { id: 'problema',  label: '¿Qué problema específico resuelves para este cliente?', type: 'textarea' as const, placeholder: 'Ej: pierde leads porque no responde a tiempo, no tiene presencia digital...' },
  { id: 'objetivo',  label: '¿Qué resultado concreto espera el cliente?',           type: 'textarea' as const, placeholder: 'Ej: conseguir 5 clientes nuevos al mes, tener web profesional en 2 semanas...' },
  { id: 'timeline',  label: '¿Cuándo quiere resultados?',                           type: 'text'     as const, placeholder: 'Ej: en 30 días, antes del lanzamiento del 15 de junio...' },
  { id: 'adicional', label: '¿Algo especial sobre este cliente o propuesta?',        type: 'textarea' as const, placeholder: 'Ej: ya tuvimos reunión, tiene presupuesto limitado, es urgente...' },
]

type Step = 'loading' | 'select-service' | 'questions' | 'generating' | 'done'

function copy(text: string) { navigator.clipboard.writeText(text); toast.success('Copiado al portapapeles') }
function download(content: string) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })),
    download: 'propuesta-comercial.txt',
  })
  a.click()
}

export default function PropuestaComercial({ projectId }: { projectId: string }) {
  const [step, setStep]           = useState<Step>('loading')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [content, setContent]     = useState<string>('')
  const [savedAt, setSavedAt]     = useState<string | undefined>()
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({})

  const suggest = async (q: { id: string; label: string; type: string }) => {
    if (suggesting[q.id]) return
    setSuggesting(p => ({ ...p, [q.id]: true }))
    try {
      const { data } = await api.post('/suggest-answer', {
        projectId,
        toolId: 'propuesta',
        questionId: q.id,
        questionLabel: q.label,
        questionType: q.type,
        existingAnswers: { serviceId, serviceName: service?.label, ...answers },
      })
      if (data?.suggestion) setAnswers(p => ({ ...p, [q.id]: data.suggestion }))
    } catch {
      toast.error('No se pudo generar la sugerencia')
    } finally {
      setSuggesting(p => ({ ...p, [q.id]: false }))
    }
  }

  useEffect(() => {
    api.get(`/projects/${projectId}/tools/propuesta`)
      .then(({ data }) => {
        const result = data.result ?? data
        if (data.exists && result?.content) {
          setContent(result.content)
          setServiceId(result.serviceId || null)
          setSavedAt(data.updated_at)
          setStep('done')
        } else {
          setStep('select-service')
        }
      })
      .catch(() => setStep('select-service'))
  }, [projectId])

  const service = SERVICE_TYPES.find(s => s.id === serviceId)
  const allFilled = QUESTIONS.every(q => answers[q.id]?.trim())

  const generate = async () => {
    if (!serviceId) return
    setStep('generating')
    try {
      const { data } = await api.post(`/projects/${projectId}/tools/propuesta`, {
        toolAnswers: { serviceId, serviceName: service?.label, ...answers },
      })
      setContent((data.result ?? data)?.content || '')
      setSavedAt(new Date().toISOString())
      setStep('done')
    } catch {
      toast.error('Error al generar. Inténtalo de nuevo.')
      setStep('questions')
    }
  }

  const regenerate = () => {
    setStep('select-service')
    setServiceId(null)
    setAnswers({})
    setContent('')
  }

  // ── Loading ──
  if (step === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Cargando propuesta...</p>
      </div>
    )
  }

  // ── Select service ──
  if (step === 'select-service') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DocumentTextIcon style={{ width: 26, height: 26, color: 'var(--accent)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Propuesta Comercial</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Genera una propuesta profesional lista para enviar. Elige el tipo de servicio que ofreces.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Tipo de servicio
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {SERVICE_TYPES.map(s => (
            <motion.button
              key={s.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: .98 }}
              onClick={() => { setServiceId(s.id); setStep('questions') }}
              style={{
                textAlign: 'left', padding: '18px 20px', borderRadius: 14,
                background: 'var(--card-bg)', border: `1px solid ${s.color}30`,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'all .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <s.Icon style={{ width: 22, height: 22, color: s.color }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 1 }}>{s.label}</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.range}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{s.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    )
  }

  // ── Questions ──
  if (step === 'questions') {
    return (
      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => { setStep('select-service'); setServiceId(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
          >
            <ArrowLeftIcon style={{ width: 13 }} /> Atrás
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {service && <service.Icon style={{ width: 18, height: 18, color: service.color }} />}
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.2 }}>{service?.label}</p>
              <p style={{ fontSize: 11, color: service ? service.color : 'var(--accent)' }}>{service?.range}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {QUESTIONS.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flex: 1 }}>
                  <span style={{ color: 'var(--accent)', fontFamily: 'monospace', marginRight: 6, fontSize: 11, fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span>
                  {q.label}
                </label>
                <button
                  type="button"
                  onClick={() => suggest(q)}
                  disabled={!!suggesting[q.id]}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
                    background: 'linear-gradient(135deg, rgba(0,217,255,0.15), rgba(139,92,246,0.15))',
                    border: '1px solid var(--border-h)', color: 'var(--accent)', fontSize: 11, fontWeight: 600,
                    cursor: suggesting[q.id] ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {suggesting[q.id]
                    ? <span style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    : <SparklesIcon style={{ width: 12, height: 12 }} />}
                  {suggesting[q.id] ? 'Generando…' : 'Generar con IA'}
                </button>
              </div>
              {q.type === 'textarea' ? (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={3}
                  className="input-form"
                  style={{ resize: 'none', padding: '9px 12px', fontSize: 13 }}
                />
              ) : (
                <input
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  className="input-form"
                  style={{ padding: '9px 12px', fontSize: 13 }}
                />
              )}
            </motion.div>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={!allFilled}
          className="btn-primary"
          style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 14, fontWeight: 600 }}
        >
          {allFilled ? 'Generar propuesta' : `Completa las ${QUESTIONS.filter(q => !answers[q.id]?.trim()).length} preguntas restantes`}
        </button>
      </motion.div>
    )
  }

  // ── Generating ──
  if (step === 'generating') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {service
              ? <service.Icon style={{ width: 20, height: 20, color: service.color }} />
              : <DocumentTextIcon style={{ width: 20, height: 20, color: 'var(--accent)' }} />
            }
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Generando propuesta...</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Redactando documento profesional personalizado</p>
        </div>
      </div>
    )
  }

  // ── Done ──
  if (step === 'done') {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {service
                ? <service.Icon style={{ width: 22, height: 22, color: service.color }} />
                : <DocumentTextIcon style={{ width: 22, height: 22, color: 'var(--text-3)' }} />
              }
              <div>
                <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  Propuesta — {service?.label || 'Comercial'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {savedAt && `Generada ${new Date(savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => copy(content)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
              >
                Copiar
              </button>
              <button
                onClick={() => download(content)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
              >
                <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> TXT
              </button>
              <button
                onClick={() => exportToPDF('Propuesta Comercial', content)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
              >
                <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> PDF
              </button>
              <button
                onClick={() => exportToWord('Propuesta Comercial', content)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
              >
                <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> Word
              </button>
              <button
                onClick={regenerate}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
              >
                <ArrowPathIcon style={{ width: 15, height: 15 }} /> Nueva propuesta
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <pre style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {content}
              </pre>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return null
}
