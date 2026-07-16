import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  PlayCircleIcon, ArrowRightIcon, ArrowLeftOnRectangleIcon, SunIcon, MoonIcon,
} from '@heroicons/react/24/outline'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../hooks/useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — Actualiza el video cuando lo tengas.
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_EMBED_URL: string = '' // ej. 'https://www.youtube.com/embed/XXXX' o Vimeo — vacío = aún sin video
const VIDEO_POSTER = '/portada-video.png' // imagen portada (con botón de play); en /public

export default function Portal() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [playing, setPlaying] = useState(false)
  const [posterOk, setPosterOk] = useState(true)

  const logoSrc = isDark ? '/logo_blanco.png' : '/logo_negro.png'
  const firstName = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  const playVideo = () => {
    if (VIDEO_EMBED_URL) setPlaying(true)
    else toast('El video estará disponible muy pronto', { icon: '🎬' })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <img src={logoSrc} alt="MKT Hackers" style={{ height: isDark ? 30 : 46, width: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleTheme} className="btn-icon" style={{ width: 38, height: 38 }} title="Cambiar tema">
            {isDark ? <SunIcon style={{ width: 18, height: 18 }} /> : <MoonIcon style={{ width: 18, height: 18 }} />}
          </button>
          <button onClick={async () => { await logout(); navigate('/login') }} className="btn-icon" style={{ width: 38, height: 38 }} title="Cerrar sesión">
            <ArrowLeftOnRectangleIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {/* Main centrado: video + Comenzar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1000, margin: '0 auto', padding: '32px 20px 56px' }}>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
          Bienvenido{firstName ? ', ' : ''}<span className="gradient-text">{firstName}</span>
        </motion.h1>
        <p style={{ color: 'var(--text-2)', textAlign: 'center', marginBottom: 28, fontSize: 'var(--fs-base)' }}>
          Mira cómo funciona y empieza cuando quieras.
        </p>

        {/* Video */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} style={{ width: '100%' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card-bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
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
        </motion.div>

        {/* Comenzar */}
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
          onClick={() => navigate('/dashboard')} className="btn-primary"
          style={{ marginTop: 28, fontSize: 15, padding: '14px 44px' }}>
          Comenzar <ArrowRightIcon style={{ width: 18, height: 18 }} />
        </motion.button>
      </div>
    </div>
  )
}
