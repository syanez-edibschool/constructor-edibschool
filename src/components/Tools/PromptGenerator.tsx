import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChatBubbleLeftRightIcon, MicrophoneIcon, SparklesIcon,
  ClipboardDocumentIcon, ArrowDownTrayIcon, ArrowPathIcon,
  CheckCircleIcon, CpuChipIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../services/api'
import { toText } from '../../lib/aiText'

// ─── Types ────────────────────────────────────────────────────────────────────
type Platform = 'ghl' | 'manychat' | 'whatsapp' | 'voiceflow' | 'botpress' | 'chatgpt' | 'elevenlabs' | 'otro'
type Interaction = 'texto' | 'voz'

interface AgentData {
  agentName: string
  businessType: string
  targetAudience: string
  mainObjective: string
  personality: string
  objections: string
  additionalInfo: string
}

// ─── Platform data ─────────────────────────────────────────────────────────────
const PLATFORMS: { id: Platform; label: string; abbr: string; color: string }[] = [
  { id: 'ghl',        label: 'Go High Level',   abbr: 'GHL',  color: '#8357F6' },
  { id: 'manychat',   label: 'ManyChat',         abbr: 'MC',   color: '#C49DFF' },
  { id: 'whatsapp',   label: 'WhatsApp',         abbr: 'WA',   color: '#25D366' },
  { id: 'voiceflow',  label: 'Voiceflow',        abbr: 'VF',   color: '#4F46E5' },
  { id: 'botpress',   label: 'Botpress',         abbr: 'BP',   color: '#AF8AE6' },
  { id: 'chatgpt',    label: 'ChatGPT / GPT',    abbr: 'GPT',  color: '#10B981' },
  { id: 'elevenlabs', label: 'ElevenLabs',       abbr: 'EL',   color: '#F97316' },
  { id: 'otro',       label: 'Otra plataforma',  abbr: '...',  color: '#6B7280' },
]

// ─── Input styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      style={inputStyle}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(131,87,246,0.4)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(131,87,246,0.4)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    />
  )
}

// ─── Field row with AI suggest button ────────────────────────────────────────
function FieldRow({
  n, label, optional, fieldKey, value, onChange, placeholder, rows = 3,
  projectId, agentData, platform, interaction,
}: {
  n: number; label: string; optional?: boolean
  fieldKey: keyof AgentData; value: string; onChange: (v: string) => void
  placeholder: string; rows?: number
  projectId: string; agentData: AgentData
  platform: Platform | null; interaction: Interaction | null
}) {
  const [busy, setBusy] = useState(false)

  const suggest = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/suggest-answer', {
        projectId,
        toolId: 'prompt-generator',
        questionId: fieldKey,
        questionLabel: label,
        questionType: 'textarea',
        existingAnswers: {
          ...agentData,
          platform: platform ?? '',
          interactionType: interaction ?? '',
        },
      })
      if (data?.suggestion) onChange(toText(data.suggestion))
    } catch { /* silently ignore */ }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)', opacity: 0.7 }}>
            {String(n).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
          {optional && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>
              opcional
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={suggest}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 999,
            background: busy ? 'var(--surface)' : 'linear-gradient(135deg,rgba(131,87,246,.15),rgba(196,157,255,.15))',
            border: '1px solid var(--border-h)',
            color: 'var(--accent)', fontSize: 11, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer', flexShrink: 0, transition: 'all .2s',
          }}
        >
          {busy
            ? <span style={{ width: 12, height: 12, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            : <SparklesIcon style={{ width: 12, height: 12 }} />}
          {busy ? 'Generando…' : 'Generar con IA'}
        </button>
      </div>
      <Textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
    </div>
  )
}

function FieldLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)', opacity: 0.7 }}>
        {String(n).padStart(2, '0')}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PromptGenerator({ projectId }: { projectId: string }) {
  const [platform, setPlatform]       = useState<Platform | null>(null)
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [agentData, setAgentData]     = useState<AgentData>({
    agentName: '', businessType: '', targetAudience: '',
    mainObjective: '', personality: '', objections: '', additionalInfo: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  const set = (key: keyof AgentData) => (v: string) => setAgentData(p => ({ ...p, [key]: v }))

  const isGhlText   = platform === 'ghl' && interaction === 'texto'
  const showQ8      = !isGhlText
  const formatBadge = isGhlText ? 'Formato GHL' : 'Formato Profesional'

  const canSubmit = Boolean(
    platform && interaction &&
    agentData.agentName.trim() &&
    agentData.businessType.trim() &&
    agentData.targetAudience.trim() &&
    agentData.mainObjective.trim() &&
    agentData.personality.trim() &&
    agentData.additionalInfo.trim()
  )

  const generate = async () => {
    if (!canSubmit || !platform || !interaction) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data } = await api.post(`/projects/${projectId}/tools/prompt-generator`, {
        platform,
        interactionType: interaction,
        agentData,
      })
      if (!data.success) throw new Error(data.error || 'Error generando prompt')
      setResult(toText(data.content))
    } catch (err: any) {
      // El mensaje del backend PRIMERO: `err.message` de axios es siempre
      // "Request failed with status code 500", que no dice nada ni al alumno ni a
      // soporte. El resto de herramientas ya lee response.data.error.
      const delBackend = typeof err?.response?.data?.error === 'string' ? err.response.data.error : null
      setError(toText(delBackend || err?.message || 'Error al generar. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  const copyPrompt = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadPrompt = () => {
    if (!result) return
    const name = agentData.agentName.replace(/\s+/g, '-').toLowerCase() || 'agente'
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([result], { type: 'text/plain;charset=utf-8' })),
      download: `prompt-${name}.txt`,
    })
    a.click()
  }

  // Shared props for FieldRow
  const fieldProps = { projectId, agentData, platform, interaction }

  // ── Result view ──
  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CpuChipIcon style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>Prompt generado</p>
              <p style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircleIcon style={{ width: 12, height: 12 }} /> Listo para usar
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: isGhlText ? 'rgba(131,87,246,0.12)' : 'rgba(196,157,255,0.12)',
              color: isGhlText ? '#8357F6' : '#C49DFF',
              border: `1px solid ${isGhlText ? 'rgba(131,87,246,0.25)' : 'rgba(196,157,255,0.25)'}`,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {formatBadge}
            </span>
            <button
              onClick={() => { setResult(null); setError(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}
            >
              <ArrowPathIcon style={{ width: 13, height: 13 }} /> Regenerar
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '10px 14px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Prompt del sistema</span>
          </div>
          <textarea
            readOnly value={result}
            style={{ width: '100%', minHeight: 420, padding: '16px 18px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, lineHeight: 1.75, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyPrompt} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: copied ? 'rgba(16,185,129,0.15)' : 'var(--accent-d)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border-h)'}`, color: copied ? '#10B981' : 'var(--accent)', transition: 'all .2s' }}>
            {copied ? <><CheckCircleIcon style={{ width: 16, height: 16 }} /> Copiado</> : <><ClipboardDocumentIcon style={{ width: 16, height: 16 }} /> Copiar prompt</>}
          </button>
          <button onClick={downloadPrompt} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <ArrowDownTrayIcon style={{ width: 16, height: 16 }} /> Descargar .txt
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Form view ──
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CpuChipIcon style={{ width: 26, height: 26, color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Generador de Prompts para Agentes IA</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Genera el prompt de sistema profesional para tu agente conversacional, adaptado a la plataforma y formato correcto.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Q1: Platform */}
        <div>
          <FieldLabel n={1} label="¿En qué plataforma va el agente?" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                style={{
                  padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${platform === p.id ? p.color : 'var(--border)'}`,
                  background: platform === p.id ? `${p.color}15` : 'var(--surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (platform !== p.id) (e.currentTarget as HTMLElement).style.borderColor = `${p.color}50` }}
                onMouseLeave={e => { if (platform !== p.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: platform === p.id ? p.color : 'var(--text-3)' }}>
                  {p.abbr}
                </span>
                <span style={{ fontSize: 10, fontWeight: 500, color: platform === p.id ? p.color : 'var(--text-3)', textAlign: 'center', lineHeight: 1.3 }}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Interaction type */}
        <div>
          <FieldLabel n={2} label="¿El agente interactúa por texto o por voz?" />
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { id: 'texto' as Interaction, label: 'Texto', Icon: ChatBubbleLeftRightIcon, color: '#8357F6' },
              { id: 'voz'   as Interaction, label: 'Voz',   Icon: MicrophoneIcon,          color: '#C49DFF' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setInteraction(opt.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px 20px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${interaction === opt.id ? opt.color : 'var(--border)'}`,
                  background: interaction === opt.id ? `${opt.color}12` : 'var(--surface)',
                  transition: 'all .15s',
                }}
              >
                <opt.Icon style={{ width: 20, height: 20, color: interaction === opt.id ? opt.color : 'var(--text-3)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: interaction === opt.id ? opt.color : 'var(--text-2)' }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
          {platform && interaction && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: isGhlText ? 'rgba(131,87,246,0.06)' : 'rgba(196,157,255,0.06)', border: `1px solid ${isGhlText ? 'rgba(131,87,246,0.2)' : 'rgba(196,157,255,0.2)'}`, fontSize: 11, color: isGhlText ? '#8357F6' : '#C49DFF' }}
            >
              {isGhlText ? 'Formato GHL: 3 secciones (PERSONALIDAD · OBJETIVO · INFORMACIÓN ADICIONAL)' : 'Formato Profesional: 8 secciones completas'}
            </motion.div>
          )}
        </div>

        {/* Questions 3-9 */}
        <AnimatePresence>
          {platform && interaction && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Q3 — text input, no AI suggest */}
              <div>
                <FieldLabel n={3} label="Nombre del agente" />
                <Input value={agentData.agentName} onChange={set('agentName')} placeholder="Ej: Sofia, Asistente Virtual de Bienes Raíces" />
              </div>

              {/* Q4 — text input, no AI suggest */}
              <div>
                <FieldLabel n={4} label="¿Qué tipo de negocio lo usará?" />
                <Input value={agentData.businessType} onChange={set('businessType')} placeholder="Ej: Inmobiliaria de lujo en Madrid" />
              </div>

              {/* Q5 */}
              <FieldRow n={5} label="¿Quién es el cliente ideal que hablará con el agente?"
                fieldKey="targetAudience" value={agentData.targetAudience} onChange={set('targetAudience')}
                placeholder="Ej: Inversores entre 40-60 años buscando propiedades +500k€"
                {...fieldProps}
              />

              {/* Q6 */}
              <FieldRow n={6} label="¿Cuál es el objetivo principal del agente?"
                fieldKey="mainObjective" value={agentData.mainObjective} onChange={set('mainObjective')}
                placeholder="Ej: Calificar prospectos y agendar visitas presenciales"
                {...fieldProps}
              />

              {/* Q7 */}
              <FieldRow n={7} label="¿Cómo debe ser la personalidad del agente?"
                fieldKey="personality" value={agentData.personality} onChange={set('personality')}
                placeholder="Ej: Profesional pero cercano, usa lenguaje formal, genera confianza"
                {...fieldProps}
              />

              {/* Q8 — conditional */}
              {showQ8 && (
                <FieldRow n={8} label="¿Hay objeciones comunes que debe manejar?" optional
                  fieldKey="objections" value={agentData.objections} onChange={set('objections')}
                  placeholder="Ej: Es muy caro, no tengo tiempo, déjame pensarlo"
                  {...fieldProps}
                />
              )}

              {/* Q9 */}
              <FieldRow n={showQ8 ? 9 : 8} label="Flujo o información adicional"
                fieldKey="additionalInfo" value={agentData.additionalInfo} onChange={set('additionalInfo')}
                placeholder="Ej: Primero preguntar nombre → luego presupuesto → luego zona → ofrecer llamada"
                rows={4} {...fieldProps}
              />

              {error && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ fontSize: 12, color: '#EF4444' }}>{error}</p>
                </div>
              )}

              <button
                onClick={generate} disabled={!canSubmit || loading}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12,
                  background: canSubmit && !loading ? 'var(--accent)' : 'var(--surface)',
                  color: canSubmit && !loading ? '#000' : 'var(--text-3)',
                  border: `1px solid ${canSubmit && !loading ? 'transparent' : 'var(--border)'}`,
                  cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all .15s',
                }}
              >
                {loading ? (
                  <><span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Generando prompt...</>
                ) : (
                  <><SparklesIcon style={{ width: 18, height: 18 }} /> Generar Prompt Profesional</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
