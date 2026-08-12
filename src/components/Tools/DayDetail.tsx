import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XMarkIcon, TrashIcon, CheckIcon,
  ViewColumnsIcon, FilmIcon, DevicePhoneMobileIcon, PhotoIcon,
  VideoCameraIcon, EnvelopeIcon, SignalIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { toText } from '../../lib/aiText'

export interface CalendarDay {
  day: string
  type: string
  content: string
  timing: string
  platform?: string
  description?: string
  cta?: string
}

interface DayDetailProps {
  day: CalendarDay | null
  weekIndex: number
  dayIndex: number
  onClose: () => void
  onSave: (weekIndex: number, dayIndex: number, updates: Partial<CalendarDay>) => Promise<void>
  onDelete: (weekIndex: number, dayIndex: number) => Promise<void>
}

type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>
const TYPE_ICON_MAP: Record<string, IconComp> = {
  Carrusel: ViewColumnsIcon,
  Reel:     FilmIcon,
  Story:    DevicePhoneMobileIcon,
  Post:     PhotoIcon,
  Video:    VideoCameraIcon,
  Email:    EnvelopeIcon,
  Live:     SignalIcon,
}
function TypeIcon({ type, style }: { type: string; style?: React.CSSProperties }) {
  const Icon = TYPE_ICON_MAP[type] || DocumentTextIcon
  return <Icon style={style} />
}

const TYPE_COLORS: Record<string, string> = {
  Carrusel: '#C49DFF', Reel: '#AF8AE6', Story: '#F59E0B', Post: '#10B981', Video: '#3B82F6', Email: '#0891b2', Live: '#EF4444',
}

export default function DayDetail({ day, weekIndex, dayIndex, onClose, onSave, onDelete }: DayDetailProps) {
  const [form, setForm]     = useState<CalendarDay | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [deleting, setDeleting] = useState(false)

  // El día viene de la IA: se normaliza a texto al entrar en el formulario, así
  // ni los inputs controlados ni el JSX reciben nunca un objeto (React #31).
  useEffect(() => {
    if (day) setForm({
      ...day,
      day: toText(day.day),
      type: toText(day.type),
      content: toText(day.content),
      timing: toText(day.timing),
      platform: day.platform != null ? toText(day.platform) : undefined,
      description: day.description != null ? toText(day.description) : undefined,
      cta: day.cta != null ? toText(day.cta) : undefined,
    })
    setSaved(false)
  }, [day])

  if (!day || !form) return null

  const set = (key: keyof CalendarDay, val: string) => { setForm(p => p ? { ...p, [key]: val } : p); setSaved(false) }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await onSave(weekIndex, dayIndex, form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el post del ${toText(day.day)}?`)) return
    setDeleting(true)
    try {
      await onDelete(weekIndex, dayIndex)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const color = TYPE_COLORS[form.type] || 'var(--accent)'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: .92, y: 12 }}
          animate={{ opacity: 1, scale: 1,   y: 0  }}
          exit={{   opacity: 0, scale: .92, y: 12  }}
          transition={{ duration: .25, ease: [.34, 1.2, .64, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 460,
            background: 'var(--surface-s)',
            border: `1px solid ${color}40`,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,.6)',
          }}
        >
          {/* Color bar */}
          <div style={{ height: 3, background: `linear-gradient(90deg,${color},transparent)` }} />

          <div style={{ padding: '20px 20px 20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TypeIcon type={form.type} style={{ width: 24, height: 24, color }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1.2 }}>{form.day}</p>
                  <p style={{ fontSize: 12, color, fontWeight: 600 }}>{form.type}</p>
                </div>
              </div>
              <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
                <XMarkIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Type selector */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Tipo</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="input-form" style={{ padding: '8px 12px', fontSize: 13 }}>
                  {Object.keys(TYPE_ICON_MAP).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Timing */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Hora</label>
                <input value={form.timing} onChange={e => set('timing', e.target.value)} className="input-form" style={{ padding: '8px 12px', fontSize: 13 }} placeholder="18:00h" />
              </div>

              {/* Platform */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Plataforma</label>
                <select value={form.platform || 'Instagram'} onChange={e => set('platform', e.target.value)} className="input-form" style={{ padding: '8px 12px', fontSize: 13 }}>
                  {['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'Twitter/X'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Content */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Tema / Descripción</label>
                <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={3} className="input-form" style={{ padding: '8px 12px', fontSize: 13, resize: 'none' }} placeholder="Descripción del contenido..." />
              </div>

              {/* CTA */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>CTA</label>
                <input value={form.cta || ''} onChange={e => set('cta', e.target.value)} className="input-form" style={{ padding: '8px 12px', fontSize: 13 }} placeholder="Ej: Link en bio, Comentar INFO..." />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <TrashIcon style={{ width: 16, height: 16 }} />
              </button>

              <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '9px 0', fontSize: 13, borderRadius: 10 }}>
                Cerrar
              </button>

              <motion.button
                onClick={handleSave}
                disabled={saving}
                whileHover={{ y: -1 }}
                whileTap={{ scale: .97 }}
                className="btn-primary"
                style={{ flex: 1, padding: '9px 0', fontSize: 13, borderRadius: 10 }}
              >
                {saving ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Guardando...
                  </span>
                ) : saved ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#10B981' }}>
                    <CheckIcon style={{ width: 14, height: 14 }} /> Guardado
                  </span>
                ) : 'Guardar cambios'}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
