import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ComponentType, SVGProps } from 'react'
import {
  RocketLaunchIcon, AcademicCapIcon, ClipboardDocumentCheckIcon, BriefcaseIcon,
  PlayCircleIcon, ArrowRightIcon, ArrowTopRightOnSquareIcon, LockClosedIcon,
  ArrowLeftOnRectangleIcon, SunIcon, MoonIcon,
} from '@heroicons/react/24/outline'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../hooks/useAuth'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — Actualiza aquí los dominios reales y el video cuando los tengas.
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_EMBED_URL = '' // ej. 'https://www.youtube.com/embed/XXXX' — vacío = placeholder

interface Platform {
  id: string; name: string; desc: string
  Icon: IconComp; accent: string
  url: string; internal?: boolean; enabled: boolean; badge?: string
}

const PLATFORMS: Platform[] = [
  {
    id: 'acelerador', name: 'Acelerador', desc: 'Construye tu agencia de IA paso a paso con las herramientas.',
    Icon: RocketLaunchIcon, accent: '#8357F6',
    url: '/dashboard', internal: true, enabled: true,
  },
  {
    id: 'mentores', name: 'Mentores', desc: 'Agenda tu tutoría 1 a 1 con un mentor del equipo.',
    Icon: AcademicCapIcon, accent: '#C49DFF',
    url: 'https://mentores.marketinghackers.com', enabled: true,
  },
  {
    id: 'seguimientos', name: 'Seguimientos', desc: 'Tu progreso, entregas y evaluaciones del programa.',
    Icon: ClipboardDocumentCheckIcon, accent: '#10B981',
    url: 'https://seguimientos.marketinghackers.com', enabled: true,
  },
  {
    id: 'oportunidades', name: 'Oportunidades', desc: 'Conecta con oportunidades de negocio y colaboración.',
    Icon: BriefcaseIcon, accent: '#F59E0B',
    url: '#', enabled: false, badge: 'Muy pronto',
  },
]

export default function Portal() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const logoSrc = isDark ? '/logo_blanco.png' : '/logo_negro.png'
  const firstName = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  const go = (p: Platform) => {
    if (!p.enabled) return
    if (p.internal) navigate(p.url)
    else window.open(p.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <img src={logoSrc} alt="MKT Hackers" style={{ height: isDark ? 30 : 46, width: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleTheme} className="btn-icon" style={{ width: 38, height: 38 }} title="Cambiar tema">
            {isDark ? <SunIcon style={{ width: 18, height: 18 }} /> : <MoonIcon style={{ width: 18, height: 18 }} />}
          </button>
          <button onClick={async () => { await logout(); navigate('/login') }} className="btn-icon" style={{ width: 38, height: 38 }} title="Cerrar sesión">
            <ArrowLeftOnRectangleIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, width: '100%', maxWidth: 1080, margin: '0 auto', padding: '40px 24px 64px' }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 8 }}>
            Bienvenido{firstName ? `, ` : ''}<span className="gradient-text">{firstName}</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-base)', marginBottom: 32 }}>
            Elige una plataforma para empezar. Mira el video para entender cómo funciona todo.
          </p>
        </motion.div>

        {/* Video */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
          style={{ marginBottom: 40 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
            {VIDEO_EMBED_URL ? (
              <iframe
                src={VIDEO_EMBED_URL}
                title="Cómo funcionan las plataformas"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-3)' }}>
                <PlayCircleIcon style={{ width: 56, height: 56, color: 'var(--accent)' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>Video explicativo — próximamente</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Platforms */}
        <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>Plataformas</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--sp-md)' }}>
          {PLATFORMS.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              onClick={() => go(p)}
              disabled={!p.enabled}
              title={p.enabled ? p.name : 'Muy pronto'}
              style={{
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10,
                padding: 'var(--sp-lg)', borderRadius: 'var(--radius-md)',
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                cursor: p.enabled ? 'pointer' : 'not-allowed', opacity: p.enabled ? 1 : 0.55,
                transition: 'border-color 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { if (p.enabled) { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-h)'; el.style.transform = 'translateY(-3px)' } }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${p.accent}22`, border: `1px solid ${p.accent}44` }}>
                  <p.Icon style={{ width: 24, height: 24, color: p.accent }} />
                </div>
                {p.enabled
                  ? (p.internal
                      ? <ArrowRightIcon style={{ width: 18, height: 18, color: 'var(--text-3)' }} />
                      : <ArrowTopRightOnSquareIcon style={{ width: 18, height: 18, color: 'var(--text-3)' }} />)
                  : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.accent, background: `${p.accent}22`, borderRadius: 999, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><LockClosedIcon style={{ width: 11, height: 11 }} />{p.badge}</span>}
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{p.name}</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{p.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
