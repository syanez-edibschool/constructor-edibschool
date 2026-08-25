import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Tab3D from '../components/ui/Tab3D'
import Button3D from '../components/ui/Button3D'
import LoadingSpinner3D from '../components/ui/LoadingSpinner3D'
import { api } from '../services/api'
import { supabase } from '../services/supabase'
import SemaforoNicho, { type Veredicto } from '../components/ui/SemaforoNicho'
import { updateProject } from '../services/projectsService'
import { toText } from '../lib/aiText'
import { UserIcon } from '@heroicons/react/24/outline'

interface NichoData {
  sector: string
  micronicho: string
  tam: string
  ticket: string
  trend: string
  momento: string
  razon: string
}

interface AvatarData {
  name: string
  age: string
  position: string
  experience: string
  income: string
  narrative: string
  goals: string[]
  pains: string[]
}

interface CompetenciaData {
  competitors: Array<{ name: string; price: string; strengths: string[]; weaknesses: string[]; gap: string }>
  positioning: string
  opportunity: string
}

type TabId = 'nicho' | 'avatar' | 'competencia'

const TABS = [
  { id: 'nicho' as TabId, label: 'Nicho Identificado' },
  { id: 'avatar' as TabId, label: 'Avatar Vívido' },
  { id: 'competencia' as TabId, label: 'Competencia' },
]

// Convierte cualquier error a TEXTO. Evita pasar un objeto (ej. el {code,message}
// que devuelve Vercel ante un 500) a toast/React, que crashearía la pantalla.
function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as { message?: unknown; error?: unknown }
    if (typeof o.message === 'string') return o.message
    if (typeof o.error === 'string') return o.error
    try { return JSON.stringify(v) } catch { return 'Error inesperado' }
  }
  return String(v ?? 'Error inesperado')
}

// El análisis lo escribe la IA: si algún campo llega como objeto en vez de texto,
// React tumba la pantalla al pintarlo (#31). Se normaliza al entrar en el estado.
const txtList = (v: unknown): string[] => (Array.isArray(v) ? v.map(toText) : [])

function normNicho(raw: unknown): NichoData {
  const n = (raw ?? {}) as Record<string, unknown>
  return {
    sector: toText(n.sector), micronicho: toText(n.micronicho), tam: toText(n.tam),
    ticket: toText(n.ticket), trend: toText(n.trend), momento: toText(n.momento),
    razon: toText(n.razon),
  }
}

function normAvatar(raw: unknown): AvatarData {
  const a = (raw ?? {}) as Record<string, unknown>
  return {
    name: toText(a.name), age: toText(a.age), position: toText(a.position),
    experience: toText(a.experience), income: toText(a.income), narrative: toText(a.narrative),
    goals: txtList(a.goals), pains: txtList(a.pains),
  }
}

function normCompetencia(raw: unknown): CompetenciaData {
  const c = (raw ?? {}) as Record<string, unknown>
  return {
    competitors: (Array.isArray(c.competitors) ? c.competitors : []).map((x: Record<string, unknown>) => ({
      name: toText(x?.name), price: toText(x?.price),
      strengths: txtList(x?.strengths), weaknesses: txtList(x?.weaknesses),
      gap: toText(x?.gap),
    })),
    positioning: toText(c.positioning), opportunity: toText(c.opportunity),
  }
}

export default function ReviewNiche() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('nicho')
  const [nicho, setNicho] = useState<NichoData | null>(null)
  const [avatar, setAvatar] = useState<AvatarData | null>(null)
  const [competencia, setCompetencia] = useState<CompetenciaData | null>(null)
  // Veredicto que ya se calculó en el cuestionario: se recuerda aquí, no se recalcula.
  const [veredicto, setVeredicto] = useState<Veredicto | null>(null)
  const [approvals, setApprovals] = useState({ nicho: false, avatar: false, competencia: false })
  const [editMode, setEditMode] = useState({ nicho: false, avatar: false, competencia: false })
  const [editText, setEditText] = useState({ nicho: '', avatar: '', competencia: '' })
  const [updating, setUpdating] = useState({ nicho: false, avatar: false, competencia: false })

  // Carga lo YA generado antes de decidir. Antes esto llamaba a generate() sin
  // mirar nada, así que CADA visita regeneraba con IA: pisaba el análisis ya
  // revisado (y las correcciones hechas a mano) y costaba una llamada por visita.
  // Ahora solo genera si el proyecto no tiene nada guardado.
  useEffect(() => {
    let cancelado = false
    const leerJson = (v: unknown): unknown => {
      if (!v) return null
      if (typeof v !== 'string') return v
      try {
        return JSON.parse(v)
      } catch {
        return null
      }
    }

    const cargarOGenerar = async () => {
      if (!id) return
      const [n, a, c, q] = await Promise.all([
        supabase.from('project_nicho').select('data_json').eq('project_id', id).maybeSingle(),
        supabase.from('project_avatar').select('data_json').eq('project_id', id).maybeSingle(),
        supabase.from('project_competencia').select('data_json').eq('project_id', id).maybeSingle(),
        supabase.from('project_questions').select('answers_json').eq('project_id', id).maybeSingle(),
      ])
      if (cancelado) return

      const respuestas = q.data?.answers_json as Record<string, unknown> | null
      const guardadoVeredicto = leerJson(respuestas?.nicho_veredicto)
      if (guardadoVeredicto) setVeredicto(guardadoVeredicto as Veredicto)
      const nichoGuardado = leerJson(n.data?.data_json)
      if (!nichoGuardado) {
        generate()
        return
      }
      setNicho(normNicho(nichoGuardado))
      setAvatar(normAvatar(leerJson(a.data?.data_json)))
      setCompetencia(normCompetencia(leerJson(c.data?.data_json)))
      setLoading(false)
    }

    cargarOGenerar().catch(() => {
      if (!cancelado) generate()
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const generate = async () => {
    setLoading(true)
    setLoadingProgress(0)
    const interval = setInterval(() => {
      setLoadingProgress((p) => Math.min(p + 2, 90))
    }, 500)
    try {
      const { data } = await api.post(`/projects/${id}/generate-nicho-avatar-competencia`)
      if (data.error) {
        const detailStr = Array.isArray(data.details) ? data.details.map(asText).join('; ') : (data.details ? asText(data.details) : '')
        const errorMsg = detailStr ? `${asText(data.error)}: ${detailStr}` : asText(data.error)
        console.error('[generate] API error:', errorMsg)
        toast.error(errorMsg)
        return
      }
      setNicho(normNicho(data.nicho))
      setAvatar(normAvatar(data.avatar))
      setCompetencia(normCompetencia(data.competencia))
      setLoadingProgress(100)
    } catch (err: any) {
      const errorMsg = asText(err.response?.data?.error ?? err.message ?? 'Error al generar análisis')
      const details = err.response?.data?.details
      console.error('[generate] Exception:', { error: errorMsg, details })
      if (details) {
        const detailStr = Array.isArray(details) ? details.map(asText).join('; ') : asText(details)
        toast.error(`${errorMsg}: ${detailStr}`)
      } else {
        toast.error(errorMsg)
      }
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  const handleApprove = (section: TabId) => {
    setApprovals((prev) => ({ ...prev, [section]: true }))
    setEditMode((prev) => ({ ...prev, [section]: false }))
    const next = section === 'nicho' ? 'avatar' : section === 'avatar' ? 'competencia' : null
    if (next) {
      setTimeout(() => setActiveTab(next), 400)
      toast.success(`${section === 'nicho' ? 'Nicho' : section === 'avatar' ? 'Avatar' : 'Competencia'} aprobado ✓`)
    }
  }

  const handleUpdate = async (section: TabId) => {
    if (!editText[section].trim()) return
    setUpdating((prev) => ({ ...prev, [section]: true }))
    try {
      const { data } = await api.put(`/projects/${id}/update-${section}`, { feedback: editText[section] })
      if (section === 'nicho') setNicho(normNicho(data.nicho))
      if (section === 'avatar') setAvatar(normAvatar(data.avatar))
      if (section === 'competencia') setCompetencia(normCompetencia(data.competencia))
      setEditMode((prev) => ({ ...prev, [section]: false }))
      setEditText((prev) => ({ ...prev, [section]: '' }))
      toast.success('Actualizado con tu feedback')
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setUpdating((prev) => ({ ...prev, [section]: false }))
    }
  }

  const allApproved = approvals.nicho && approvals.avatar && approvals.competencia

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-8" style={{ minHeight: '100vh', background: '#0E0B30', color: '#fff' }}>
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(131,87,246,0.05) 0%, transparent 70%)' }} />
        <LoadingSpinner3D size="lg" label="Generando análisis de nicho, avatar y competencia..." />
        <div className="w-72">
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full progress-bar"
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-center text-xs text-white/30 mt-2">{loadingProgress}%</p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-white/40 text-center">
          <p>Analizando tu nicho con Claude...</p>
          <p>Construyendo avatar con Claude...</p>
          <p>Mapeando competencia...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0B30', color: '#fff' }}>
      <div className="fixed top-0 left-0 w-full h-64 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(196,157,255,0.08) 0%, transparent 100%)' }} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/6"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-white/40 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          <div className="flex items-center gap-2">
            {(['nicho', 'avatar', 'competencia'] as TabId[]).map((s) => (
              <div key={s} className={`w-2 h-2 rounded-full transition-colors ${approvals[s] ? 'bg-cyan' : 'bg-white/20'}`} />
            ))}
            <span className="text-xs text-white/40 ml-2">
              {Object.values(approvals).filter(Boolean).length}/3 aprobados
            </span>
            <button
              onClick={() => {
                if (confirm('Se generará un análisis nuevo y se reemplazará el actual. ¿Seguimos?')) generate()
              }}
              className="text-xs text-white/40 hover:text-white ml-3 transition-colors"
              title="Vuelve a generar nicho, avatar y competencia desde tus respuestas"
            >
              ↻ Volver a generar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Análisis <span className="gradient-text">Generado</span></h1>
          <p className="text-white/50 mb-8">Revisa y aprueba cada sección antes de continuar.</p>

          <Tab3D tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

          {activeTab === 'nicho' && <SemaforoNicho veredicto={veredicto} compacto />}

          <div className="mt-8">
            {/* NICHO TAB */}
            {activeTab === 'nicho' && nicho && (
              <motion.div key="nicho" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Sector', value: nicho.sector },
                    { label: 'Micronicho', value: nicho.micronicho },
                    { label: 'TAM (clientes)', value: nicho.tam },
                    { label: 'Ticket ideal', value: nicho.ticket },
                    { label: 'Crecimiento anual', value: nicho.trend },
                    { label: 'Momento ideal', value: nicho.momento },
                  ].map((item) => (
                    <div key={item.label} className="glass-dark rounded-xl p-4">
                      <p className="text-xs text-white/40 mb-1">{item.label}</p>
                      <p className="font-semibold text-white text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="glass-dark rounded-xl p-5 mb-6">
                  <p className="text-xs text-white/40 mb-2">Por qué este nicho es ideal ahora</p>
                  <p className="text-white/80 text-sm leading-relaxed">{nicho.razon}</p>
                </div>
                <ApprovalBlock
                  approved={approvals.nicho}
                  editMode={editMode.nicho}
                  editText={editText.nicho}
                  updating={updating.nicho}
                  onApprove={() => handleApprove('nicho')}
                  onEdit={() => setEditMode((p) => ({ ...p, nicho: true }))}
                  onEditChange={(t) => setEditText((p) => ({ ...p, nicho: t }))}
                  onUpdate={() => handleUpdate('nicho')}
                />
              </motion.div>
            )}

            {/* AVATAR TAB */}
            {activeTab === 'avatar' && avatar && (
              <motion.div key="avatar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="glass-dark rounded-2xl p-6 mb-6">
                  <div className="flex items-start gap-5 mb-5">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(131,87,246,0.15), rgba(196,157,255,0.15))' }}>
                      <UserIcon style={{ width: 32, height: 32, color: 'rgba(131,87,246,0.8)' }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{avatar.name}</h3>
                      <p className="text-white/50 text-sm">{avatar.position} · {avatar.age}</p>
                      <p className="text-cyan text-sm font-medium">{avatar.income}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <p className="text-xs text-white/40 mb-2">Objetivos principales</p>
                      {avatar.goals?.map((g, i) => (
                        <p key={i} className="text-sm text-white/70 flex items-start gap-1.5 mb-1">
                          <span className="text-cyan mt-0.5">✓</span>{g}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-white/40 mb-2">Dolores principales</p>
                      {avatar.pains?.map((p, i) => (
                        <p key={i} className="text-sm text-white/70 flex items-start gap-1.5 mb-1">
                          <span className="text-red-400 mt-0.5">✗</span>{p}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-white/8 pt-5">
                    <p className="text-xs text-white/40 mb-3">Narrativa del avatar</p>
                    <p className="text-white/70 text-sm leading-relaxed italic">"{avatar.narrative}"</p>
                  </div>
                </div>
                <ApprovalBlock
                  approved={approvals.avatar}
                  editMode={editMode.avatar}
                  editText={editText.avatar}
                  updating={updating.avatar}
                  onApprove={() => handleApprove('avatar')}
                  onEdit={() => setEditMode((p) => ({ ...p, avatar: true }))}
                  onEditChange={(t) => setEditText((p) => ({ ...p, avatar: t }))}
                  onUpdate={() => handleUpdate('avatar')}
                />
              </motion.div>
            )}

            {/* COMPETENCIA TAB */}
            {activeTab === 'competencia' && competencia && (
              <motion.div key="competencia" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex flex-col gap-4 mb-6">
                  {competencia.competitors?.map((c, i) => (
                    <div key={i} className="glass-dark rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-white">{c.name}</h4>
                        <span className="text-xs text-cyan font-mono bg-cyan/10 px-3 py-1 rounded-full">{c.price}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-green-400 mb-1">Fortalezas</p>
                          {c.strengths?.map((s, j) => <p key={j} className="text-xs text-white/60">• {s}</p>)}
                        </div>
                        <div>
                          <p className="text-xs text-red-400 mb-1">Debilidades</p>
                          {c.weaknesses?.map((w, j) => <p key={j} className="text-xs text-white/60">• {w}</p>)}
                        </div>
                      </div>
                      <div className="bg-cyan/5 border border-cyan/20 rounded-lg p-3">
                        <p className="text-xs text-cyan mb-1">Tu oportunidad vs este competidor</p>
                        <p className="text-xs text-white/70">{c.gap}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="glass-dark rounded-xl p-5 mb-6">
                  <p className="text-xs text-white/40 mb-2">Posicionamiento recomendado para ti</p>
                  <p className="text-white/80 text-sm leading-relaxed font-medium">{competencia.positioning}</p>
                </div>
                <ApprovalBlock
                  approved={approvals.competencia}
                  editMode={editMode.competencia}
                  editText={editText.competencia}
                  updating={updating.competencia}
                  onApprove={() => handleApprove('competencia')}
                  onEdit={() => setEditMode((p) => ({ ...p, competencia: true }))}
                  onEditChange={(t) => setEditText((p) => ({ ...p, competencia: t }))}
                  onUpdate={() => handleUpdate('competencia')}
                />
              </motion.div>
            )}
          </div>

          {/* Continue button */}
          {allApproved && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 text-center"
            >
              <p className="text-green-400 mb-4 font-medium">✓ Todo aprobado. ¡Listo para generar tus herramientas!</p>
              <Button3D size="lg" onClick={async () => {
                try {
                  await updateProject(id!, { current_step: 3, progress: 60, status: 'in_progress' })
                } catch {
                  // non-blocking — navigate anyway
                }
                navigate(`/proyecto/${id}/tools`)
              }}>
                IR AL MENÚ DE HERRAMIENTAS →
              </Button3D>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  )
}

function ApprovalBlock({
  approved, editMode, editText, updating,
  onApprove, onEdit, onEditChange, onUpdate,
}: {
  approved: boolean
  editMode: boolean
  editText: string
  updating: boolean
  onApprove: () => void
  onEdit: () => void
  onEditChange: (t: string) => void
  onUpdate: () => void
}) {
  if (approved) {
    return (
      <div className="flex items-center gap-3 text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
        <span className="text-xl">✓</span>
        <span className="font-medium">Aprobado</span>
      </div>
    )
  }

  return (
    <div className="glass-dark rounded-xl p-5">
      <p className="text-sm font-medium text-white/80 mb-4">¿Está bien esto?</p>
      {!editMode ? (
        <div className="flex gap-3">
          <Button3D onClick={onApprove} variant="primary" size="sm">
            ✓ Sí, está perfecto
          </Button3D>
          <Button3D onClick={onEdit} variant="secondary" size="sm">
            ✎ Hay que modificar
          </Button3D>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            placeholder="Describe qué cambios necesitas..."
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            rows={3}
            className="input-3d rounded-xl px-4 py-3 text-sm resize-none w-full"
          />
          <div className="flex gap-3">
            <Button3D onClick={onUpdate} loading={updating} size="sm">
              Actualizar con feedback
            </Button3D>
          </div>
        </div>
      )}
    </div>
  )
}
