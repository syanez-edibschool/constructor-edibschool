import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import toast from 'react-hot-toast'
import {
  RocketLaunchIcon, AcademicCapIcon, ClipboardDocumentCheckIcon, BriefcaseIcon,
  PlayCircleIcon, LockClosedIcon, ArrowLeftOnRectangleIcon, SunIcon, MoonIcon,
} from '@heroicons/react/24/outline'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../hooks/useAuth'
import { useSeguimientoStatus } from '../hooks/useSeguimientoStatus'
import { useIsMobile } from '../hooks/useIsMobile'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — Actualiza aquí los dominios reales y el video cuando los tengas.
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_EMBED_URL: string = '' // ej. 'https://www.youtube.com/embed/XXXX' o Vimeo — vacío = aún sin video
const VIDEO_POSTER = '/portada-video.png' // imagen portada (con botón de play); en /public

interface Platform {
  id: string; name: string; desc: string
  Icon: IconComp; accent: string
  url: string; internal?: boolean; enabled: boolean; badge?: string
  requiresSeguimiento?: boolean // Mentores se desbloquea al completar Seguimiento
}

const PLATFORMS: Platform[] = [
  {
    id: 'acelerador', name: 'Acelerador', desc: 'Construye tu agencia de IA paso a paso.',
    Icon: RocketLaunchIcon, accent: '#8357F6',
    url: '/dashboard', internal: true, enabled: true,
  },
  {
    id: 'seguimientos', name: 'Seguimiento', desc: 'Tu progreso, entregas y evaluaciones.',
    Icon: ClipboardDocumentCheckIcon, accent: '#10B981',
    url: 'https://seguimientos.marketinghackers.com', enabled: true,
  },
  {
    id: 'mentores', name: 'Mentores', desc: 'Tu tutoría 1 a 1 con un mentor.',
    Icon: AcademicCapIcon, accent: '#C49DFF',
    url: 'https://mentores.marketinghackers.com', enabled: true, requiresSeguimiento: true,
  },
  {
    id: 'oportunidades', name: 'Oportunidades', desc: 'Oportunidades de negocio y colaboración.',
    Icon: BriefcaseIcon, accent: '#F59E0B',
    url: '#', enabled: false, badge: 'Muy pronto',
  },
]

export default function Portal() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const { seguimientoCompleto } = useSeguimientoStatus()
  const isMobile = useIsMobile()
  const [playing, setPlaying] = useState(false)
  const [posterOk, setPosterOk] = useState(true)

  const logoSrc = isDark ? '/logo_blanco.png' : '/logo_negro.png'
  const firstName = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const userInitial = (user?.user_metadata?.name || user?.email || 'U')[0].toUpperCase()

  const isUnlocked = (p: Platform) => p.enabled && (!p.requiresSeguimiento || seguimientoCompleto)

  const go = (p: Platform) => {
    if (!isUnlocked(p)) return
    if (p.internal) navigate(p.url)
    else window.open(p.url, '_blank', 'noopener,noreferrer')
  }

  const playVideo = () => {
    if (VIDEO_EMBED_URL) setPlaying(true)
    else toast('El video estará disponible muy pronto', { icon: '🎬' })
  }

  // Fila de plataforma (se usa en sidebar y en móvil)
  const PlatformRow = (p: Platform) => {
    const unlocked = isUnlocked(p)
    const lockLabel = !p.enabled ? (p.badge || 'Muy pronto') : 'Completa Seguimiento para desbloquear'
    return (
      <button
        key={p.id}
        onClick={() => go(p)}
        disabled={!unlocked}
        title={unlocked ? p.name : lockLabel}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 10, marginBottom: 4,
          cursor: unlocked ? 'pointer' : 'not-allowed', textAlign: 'left',
          border: '1px solid transparent', background: 'transparent',
          color: unlocked ? 'var(--text)' : 'var(--text-3)', opacity: unlocked ? 1 : 0.6,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (unlocked) (e.currentTarget as HTMLElement).style.background = 'var(--accent-d)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${p.accent}22`, border: `1px solid ${p.accent}44` }}>
          <p.Icon style={{ width: 18, height: 18, color: unlocked ? p.accent : 'var(--text-3)' }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.desc}</span>
        </span>
        {!unlocked && <LockClosedIcon style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--text-3)' }} />}
      </button>
    )
  }

  const themeBtn = (
    <button onClick={toggleTheme} className="btn-icon" style={{ width: 38, height: 38 }} title="Cambiar tema">
      {isDark ? <SunIcon style={{ width: 18, height: 18 }} /> : <MoonIcon style={{ width: 18, height: 18 }} />}
    </button>
  )
  const logoutBtn = (
    <button onClick={async () => { await logout(); navigate('/login') }} className="btn-icon" style={{ width: 38, height: 38 }} title="Cerrar sesión">
      <ArrowLeftOnRectangleIcon style={{ width: 18, height: 18 }} />
    </button>
  )

  const videoBlock = (
    <div style={{ position: 'relative', width: '100%', maxWidth: 1100, aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card-bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
      {playing && VIDEO_EMBED_URL ? (
        <iframe
          src={`${VIDEO_EMBED_URL}${VIDEO_EMBED_URL.includes('?') ? '&' : '?'}autoplay=1`}
          title="Cómo funciona el Acelerador"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      ) : posterOk ? (
        <button onClick={playVideo} aria-label="Reproducir video: ¿Cómo funciona el Acelerador?"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer', display: 'block' }}>
          <img src={VIDEO_POSTER} alt="¿Cómo funciona el Acelerador? Dale Play" onError={() => setPosterOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>
      ) : (
        <button onClick={playVideo} aria-label="Reproducir video"
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-3)', background: 'none', border: 0, cursor: 'pointer', width: '100%' }}>
          <PlayCircleIcon style={{ width: 64, height: 64, color: 'var(--accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>¿Cómo funciona el Acelerador? — Dale Play</span>
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>

      {/* ── Sidebar (desktop) ── */}
      {!isMobile && (
        <aside style={{ width: 300, flexShrink: 0, height: '100vh', background: 'var(--sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', minHeight: 64, display: 'flex', alignItems: 'center' }}>
            <img src={logoSrc} alt="MKT Hackers" style={{ height: isDark ? 30 : 46, width: 'auto', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '4px 10px 8px', opacity: 0.7 }}>Plataformas</p>
            {PLATFORMS.map(PlatformRow)}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#8357F6,#C49DFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{userInitial}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{firstName || 'Usuario'}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{user?.email}</p>
            </div>
            {logoutBtn}
          </div>
        </aside>
      )}

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && <img src={logoSrc} alt="MKT Hackers" style={{ height: isDark ? 26 : 40, width: 'auto', objectFit: 'contain' }} />}
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Inicio</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {themeBtn}
            {isMobile && logoutBtn}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: isMobile ? '20px 16px 40px' : '32px 40px' }}>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 6 }}>
            Bienvenido{firstName ? ', ' : ''}<span className="gradient-text">{firstName}</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-base)', marginBottom: 24 }}>
            Elige una plataforma{isMobile ? ' abajo' : ' a la izquierda'} y mira el video para entender cómo funciona todo.
          </p>

          {/* Plataformas en móvil (arriba del video) */}
          {isMobile && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>Plataformas</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 8, background: 'var(--card-bg)' }}>
                {PLATFORMS.map(PlatformRow)}
              </div>
            </div>
          )}

          {/* Video ocupa el espacio principal */}
          <div style={{ flex: 1, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center' }}>
            {videoBlock}
          </div>
        </div>
      </div>
    </div>
  )
}
