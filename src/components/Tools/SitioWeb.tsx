import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, ArrowDownTrayIcon, CheckIcon, ChevronLeftIcon,
  DocumentTextIcon, ShoppingCartIcon, MagnifyingGlassIcon,
  BriefcaseIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../services/api'
import { exportToPDF, exportToWord } from '../../services/exportContent'

// ─── Site type definitions ────────────────────────────────────────────────────
interface SiteTypeConfig {
  name: string
  description: string
  sections: string[]
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
}

const SITE_TYPES: Record<string, SiteTypeConfig> = {
  'landing-leads': {
    name: 'Landing · Captación de Leads',
    description: 'Copy completo para generar leads con WhatsApp/Calendly. Incluye PUV, dolores, deseos y proceso.',
    sections: ['PUV + CTA WhatsApp', 'Dolores del Avatar', 'Deseos y Aspiraciones', '¿Por qué yo?', 'Proceso de Trabajo', 'CTA Final'],
    icon: DocumentTextIcon,
    color: '#00D9FF',
  },
  'landing-venta': {
    name: 'Landing · Venta Directa',
    description: 'Sales page para vender un servicio o producto con pricing, testimonios y risk reversal.',
    sections: ['Hero + USP', 'Problema + Solución', 'Beneficios (no features)', 'Autoridad', 'Pricing (3 paquetes)', 'Testimonios', 'CTA + Garantía'],
    icon: ShoppingCartIcon,
    color: '#EC4899',
  },
  'blog-seo': {
    name: 'Blog · Estrategia SEO',
    description: 'Plan completo de keywords, pillar page, clusters y calendario de publicación orgánico.',
    sections: ['Keywords TOFU/MOFU/BOFU', 'Pillar Page (outline 2500+)', '7 Cluster Articles', 'Calendario 12 semanas', 'Link Building'],
    icon: MagnifyingGlassIcon,
    color: '#10B981',
  },
  'portfolio': {
    name: 'Portfolio · Casos de Éxito',
    description: 'Showcase de proyectos con metodología, métricas clave y formulario de contacto.',
    sections: ['Hero + Posicionamiento', '5 Proyectos (antes/después)', 'Metodología en pasos', 'Métricas Clave', 'Testimonios', 'CTA Contacto'],
    icon: BriefcaseIcon,
    color: '#8B5CF6',
  },
  'community': {
    name: 'Comunidad · Membership',
    description: 'Sales page para vender acceso a comunidad privada con beneficios, miembros y pricing.',
    sections: ['Hero (qué es, para quién)', 'El Problema', 'Beneficios Reales', 'Para Quién ES / NO ES', 'Testimonios de Miembros', 'Pricing + Garantía'],
    icon: UserGroupIcon,
    color: '#F59E0B',
  },
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SitioWebProps { projectId: string }

type Step = 'loading' | 'select' | 'questions' | 'generating' | 'done'

interface SiteResult { siteType: string; content: string }

// ─── Main component ───────────────────────────────────────────────────────────
export default function SitioWeb({ projectId }: SitioWebProps) {
  const [step, setStep]               = useState<Step>('loading')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [colors, setColors]           = useState('')
  const [additional, setAdditional]   = useState('')
  const [result, setResult]           = useState<SiteResult | null>(null)
  const [savedAt, setSavedAt]         = useState<string | undefined>()

  // Load existing data on mount
  useEffect(() => {
    api.get(`/projects/${projectId}/tools/website`)
      .then(({ data }) => {
        if (data.exists && data.result?.content) {
          setResult(data.result as SiteResult)
          setSelectedType(data.result.siteType || null)
          setSavedAt(data.updated_at)
          setStep('done')
        } else {
          setStep('select')
        }
      })
      .catch(() => setStep('select'))
  }, [projectId])

  const handleGenerate = async () => {
    if (!selectedType || !colors.trim()) return
    setStep('generating')
    try {
      const { data } = await api.post(`/projects/${projectId}/tools/website`, {
        toolAnswers: { siteType: selectedType, colors, additional },
      })
      // Vercel function returns { success, content }; Express returns { result: { siteType, content } }
      const siteResult: SiteResult = data.result ?? { siteType: selectedType!, content: data.content ?? '' }
      setResult(siteResult)
      setSavedAt(new Date().toISOString())
      setStep('done')
    } catch {
      toast.error('Error al generar. Inténtalo de nuevo.')
      setStep('questions')
    }
  }

  function download() {
    if (!result) return
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([result.content], { type: 'text/plain' })),
      download: `sitio-web-${selectedType}.txt`,
    })
    a.click()
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // ── Step 1: Select type ───────────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Sitio Web con IA</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Elige el tipo de sitio y genera el copy completo listo para usar</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {Object.entries(SITE_TYPES).map(([key, cfg], i) => (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => { setSelectedType(key); setStep('questions') }}
              style={{
                textAlign: 'left', padding: 20, borderRadius: 14, cursor: 'pointer',
                background: 'var(--surface)', border: '1px solid var(--border)',
                transition: 'all .2s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = cfg.color + '60'
                el.style.background = cfg.color + '08'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--surface)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.color + '18', border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <cfg.icon style={{ width: 18, height: 18, color: cfg.color }} />
                </div>
                <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', lineHeight: 1.3 }}>{cfg.name}</p>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 12 }}>{cfg.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cfg.sections.slice(0, 3).map(s => (
                  <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: cfg.color + '15', color: cfg.color, border: `1px solid ${cfg.color}25`, fontWeight: 600 }}>
                    {s}
                  </span>
                ))}
                {cfg.sections.length > 3 && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'var(--card-bg)', color: 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 600 }}>
                    +{cfg.sections.length - 3}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 2: Questions ─────────────────────────────────────────────────────────
  if (step === 'questions' && selectedType) {
    const cfg = SITE_TYPES[selectedType]
    return (
      <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
        {/* Back + header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => setStep('select')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            <ChevronLeftIcon style={{ width: 14 }} /> Volver
          </button>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.color + '18', border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <cfg.icon style={{ width: 18, height: 18, color: cfg.color }} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{cfg.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{cfg.sections.length} secciones · Solo 2 preguntas</p>
          </div>
        </div>

        {/* Sections preview */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          {cfg.sections.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: cfg.color + '20', color: cfg.color, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              {s}
            </div>
          ))}
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'monospace', marginRight: 8, fontSize: 11, fontWeight: 700 }}>01</span>
              ¿Paleta de colores? (ej: Azul + Blanco, Negro + Cyan)
            </label>
            <input
              value={colors}
              onChange={e => setColors(e.target.value)}
              placeholder="Ej: Azul oscuro + Blanco, o Rojo + Gris"
              className="input-form"
              style={{ padding: '10px 14px' }}
            />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'monospace', marginRight: 8, fontSize: 11, fontWeight: 700 }}>02</span>
              ¿Algo adicional? (garantía, testimonios con video, secciones extra…)
            </label>
            <textarea
              value={additional}
              onChange={e => setAdditional(e.target.value)}
              placeholder="Ej: Incluir garantía de 30 días, sección de FAQ, 3 testimonios con nombre real"
              rows={3}
              className="input-form"
              style={{ resize: 'none', padding: '10px 14px' }}
            />
          </div>
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={handleGenerate}
          disabled={!colors.trim()}
          className="btn-primary"
          style={{ width: '100%', marginTop: 16, padding: '12px 0', fontSize: 13, letterSpacing: '0.04em' }}
        >
          Generar {cfg.name}
        </motion.button>
      </motion.div>
    )
  }

  // ── Step 3: Generating ────────────────────────────────────────────────────────
  if (step === 'generating') {
    const cfg = selectedType ? SITE_TYPES[selectedType] : null
    return (
      <div style={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: cfg?.color || 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          {cfg && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <cfg.icon style={{ width: 22, height: 22, color: cfg.color }} />
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Generando {cfg?.name}…</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Claude está escribiendo el copy de tu sitio web personalizado</p>
        </div>
      </div>
    )
  }

  // ── Step 4: Done ─────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    const cfg = selectedType ? SITE_TYPES[selectedType] : null
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {cfg && (
              <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.color + '18', border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <cfg.icon style={{ width: 20, height: 20, color: cfg.color }} />
              </div>
            )}
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{cfg?.name || 'Sitio Web'}</p>
              <p style={{ fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckIcon style={{ width: 12 }} /> Guardado
                {savedAt && ` · ${new Date(savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(result.content); toast.success('Copiado') }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
            >
              <CheckIcon style={{ width: 14 }} /> Copiar
            </button>
            <button
              onClick={download}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
            >
              <ArrowDownTrayIcon style={{ width: 14 }} /> TXT
            </button>
            <button
              onClick={() => exportToPDF(`Sitio Web ${selectedType || ''}`.trim(), result.content)}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
            >
              <ArrowDownTrayIcon style={{ width: 14 }} /> PDF
            </button>
            <button
              onClick={() => exportToWord(`Sitio Web ${selectedType || ''}`.trim(), result.content)}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
            >
              <ArrowDownTrayIcon style={{ width: 14 }} /> Word
            </button>
            <button
              onClick={() => { setStep('select'); setSelectedType(null); setColors(''); setAdditional('') }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
            >
              <ArrowPathIcon style={{ width: 14 }} /> Nuevo tipo
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '20px 24px' }}>
            <pre style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {result.content}
            </pre>
          </div>
        </div>

        {/* Tips */}
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'var(--accent-d)', border: '1px solid var(--border-h)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Próximos pasos</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Pega este copy en tu builder favorito (Webflow, Carrd, Wix). Combina con tu Propuesta y VSL para máxima coherencia.
          </p>
        </div>
      </motion.div>
    )
  }

  return null
}
