import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { getProjects, createProject, deleteProject, type Project } from '../services/projectsService'
import { api } from '../services/api'
import { PlusIcon, Bars3Icon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../context/ThemeContext'
import { useIsMobile } from '../hooks/useIsMobile'

import Sidebar        from '../components/Dashboard/Sidebar'
import DashboardHeader from '../components/Dashboard/Header'
import StatsCards     from '../components/Dashboard/StatsCards'
import ProjectGrid    from '../components/Dashboard/ProjectGrid'
import EmptyState     from '../components/Dashboard/EmptyState'
import ProjectCard    from '../components/Dashboard/ProjectCard'

// Video de inicio (VdoCipher). El reproductor se carga con un OTP que pide el
// backend (/api/video-otp); la portada es la imagen de /public.
const VIDEO_POSTER = '/portada-video.png'

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

// ─── Glitch hook ──────────────────────────────────────────────────────────────
function useGlitch() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async function loop() {
      while (alive) {
        await new Promise(r => setTimeout(r, 4000 + Math.random() * 5000))
        if (!alive) break
        setOn(true)
        await new Promise(r => setTimeout(r, 70 + Math.random() * 90))
        if (!alive) break
        setOn(false)
      }
    })()
    return () => { alive = false }
  }, [])
  return on
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCounter(target: number) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true
        const start = Date.now(), dur = 1400
        const tick = () => {
          const p = Math.min(1, (Date.now() - start) / dur)
          setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])
  return { val, ref }
}

// ─── Particle canvas ──────────────────────────────────────────────────────────
interface CanvasState { mx: number; my: number; scrollY: number; scrollVel: number }

function ParticleCanvas({ state }: { state: React.MutableRefObject<CanvasState> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!; const ctx = canvas.getContext('2d')!
    let raf: number
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)

    type RGB = [number, number, number]
    const C: RGB[] = [[131, 87, 246], [131, 87, 246], [196, 157, 255], [236, 72, 153], [196, 157, 255]]

    interface P { x: number; y: number; vx: number; vy: number; r: number; opacity: number; color: RGB; phase: number; freq: number; trail: { x: number; y: number }[] }
    const particles: P[] = Array.from({ length: 55 }, (_, i) => {
      const x = Math.random() * window.innerWidth, y = Math.random() * window.innerHeight
      const r = i < 25 ? Math.random() * 1 + 0.4 : i < 45 ? Math.random() * 2 + 1.5 : Math.random() * 2.5 + 3.5
      return { x, y, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .25, r, opacity: Math.random() * .3 + .06, color: C[Math.floor(Math.random() * C.length)], phase: Math.random() * Math.PI * 2, freq: Math.random() * .006 + .002, trail: [] }
    })

    let t = 0
    const draw = () => {
      t++
      const { mx, my, scrollVel } = state.current
      const motionBlur = Math.min(1, Math.abs(scrollVel) * 5)
      ctx.fillStyle = `rgba(10,10,15,${lerp(.88, .18, motionBlur)})`
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const mxPx = mx * canvas.width, myPx = my * canvas.height
      for (const p of particles) {
        const dx = mxPx - p.x, dy = myPx - p.y, dist = Math.sqrt(dx * dx + dy * dy) + .001
        const a = Math.max(0, 1 - dist / 320) ** 2 * 1.6
        p.vx += (dx / dist) * a * 2.2 + (-dy / dist) * a * .3 + Math.sin(t * p.freq + p.phase) * .016
        p.vy += (dy / dist) * a * 2.2 + (dx / dist) * a * .3 + Math.cos(t * p.freq * 1.4 + p.phase) * .012
        const damp = a > .1 ? .8 : .93; p.vx *= damp; p.vy *= damp
        p.x += p.vx; p.y += p.vy
        if (p.x < -20) p.x = canvas.width + 20; if (p.x > canvas.width + 20) p.x = -20
        if (p.y < -20) p.y = canvas.height + 20; if (p.y > canvas.height + 20) p.y = -20
        p.trail.push({ x: p.x, y: p.y })
        const maxT = a > .3 ? 18 : 8; if (p.trail.length > maxT) p.trail.shift()
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        const tOp = Math.min(1, spd * .5) * (0.12 + a * .5)
        if (p.trail.length > 2 && tOp > .02) {
          ctx.beginPath(); ctx.moveTo(p.trail[0].x, p.trail[0].y)
          for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
          const [r, g, b] = p.color
          ctx.strokeStyle = `rgba(${r},${g},${b},${tOp})`; ctx.lineWidth = p.r * .7; ctx.lineCap = 'round'; ctx.stroke()
        }
        const [r, g, b] = p.color; const boost = 1 + a * 2.5
        const hr = p.r * (6 + a * 7); const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr)
        halo.addColorStop(0, `rgba(${r},${g},${b},${Math.min(.9, p.opacity * boost)})`); halo.addColorStop(.3, `rgba(${r},${g},${b},${Math.min(.3, p.opacity * .2 * boost)})`); halo.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath(); ctx.arc(p.x, p.y, hr, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + a * .8), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, p.opacity * 3 + a * 2)})`; ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [state])
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, width: '100%', height: '100%' }} />
}

// ─── Morphing layer ────────────────────────────────────────────────────────────
const MORPHS = [
  ['60% 40% 30% 70%/60% 30% 70% 40%', '30% 60% 70% 40%/50% 60% 30% 60%', '50% 40% 60% 50%/40% 50% 60% 50%', '60% 40% 30% 70%/60% 30% 70% 40%'],
  ['40% 60% 70% 30%/40% 50% 60% 50%', '60% 40% 30% 70%/60% 30% 70% 40%', '30% 60% 70% 40%/50% 60% 30% 60%', '40% 60% 70% 30%/40% 50% 60% 50%'],
  ['50% 50% 50% 50%/50% 50% 50% 50%', '60% 40% 30% 70%/60% 30% 70% 40%', '30% 70% 60% 40%/40% 60% 70% 30%', '50% 50% 50% 50%/50% 50% 50% 50%'],
  ['70% 30% 30% 70%/70% 70% 30% 30%', '30% 70% 70% 30%/30% 30% 70% 70%', '50% 50% 50% 50%/50% 50% 50% 50%', '70% 30% 30% 70%/70% 70% 30% 30%'],
]
function MorphingLayer({ scrollY }: { scrollY: number }) {
  const defs = [
    { size: 500, left: '-8%',  top: '-12%', color: '131,87,246',   op: .12, delay: 0,   dur: 9,  m: 0 },
    { size: 560, left: '65%',  top: '30%',  color: '196,157,255',  op: .10, delay: 2.5, dur: 11, m: 1 },
    { size: 360, left: '18%',  top: '60%',  color: '236,72,153',  op: .08, delay: 5,   dur: 8,  m: 2 },
    { size: 280, left: '80%',  top: '5%',   color: '131,87,246',   op: .07, delay: 3.5, dur: 10, m: 3 },
  ]
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1, transform: `translateY(${scrollY * .15}px)` }}>
      {defs.map((s, i) => (
        <motion.div key={i} style={{ position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size, background: `radial-gradient(circle, rgba(${s.color},${s.op}) 0%, transparent 70%)`, filter: 'blur(65px)' }}
          animate={{ borderRadius: MORPHS[s.m], rotate: [0, 360] }}
          transition={{ borderRadius: { duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: s.dur * 3.5, repeat: Infinity, ease: 'linear' } }} />
      ))}
    </div>
  )
}

function GlowOrbs({ scrollY }: { scrollY: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1, transform: `translateY(${scrollY * .25}px)` }}>
      {[
        { w: 450, l: '3%',   t: '8%',  c: '131,87,246',   dur: 5, d: 0   },
        { w: 520, l: 'auto', t: '15%', c: '196,157,255', r: '3%', dur: 7, d: 1.5 },
        { w: 300, l: '40%',  t: '50%', c: '236,72,153',  dur: 6, d: 3   },
      ].map((o, i) => (
        <motion.div key={i} style={{ position: 'absolute', width: o.w, height: o.w, left: o.l, top: o.t, right: (o as any).r, background: `radial-gradient(circle, rgba(${o.c},.09) 0%, transparent 65%)`, filter: 'blur(45px)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [.55, .9, .55] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut', delay: o.d }} />
      ))}
    </div>
  )
}

function CursorGlow({ mx, my }: { mx: number; my: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }}>
      <div style={{ position: 'absolute', left: `${mx * 100}%`, top: `${my * 100}%`, transform: 'translate(-50%,-50%)', width: 280, height: 280, background: 'radial-gradient(circle, rgba(131,87,246,.07) 0%, transparent 60%)', filter: 'blur(20px)', transition: 'left .08s ease-out, top .08s ease-out' }} />
    </div>
  )
}

// ─── Scroll color helper ───────────────────────────────────────────────────────
function scrollColor(sp: number) {
  if (sp < .5) return `rgba(${lerp(0, 139, sp * 2).toFixed(0)},${lerp(217, 92, sp * 2).toFixed(0)},${lerp(255, 246, sp * 2).toFixed(0)},1)`
  const t = (sp - .5) * 2
  return `rgba(${lerp(139, 236, t).toFixed(0)},${lerp(92, 72, t).toFixed(0)},${lerp(246, 153, t).toFixed(0)},1)`
}

function NewProjectCard({ onClick, col, isDark }: { onClick: () => void; col: string; isDark: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .5, ease: [.25, .46, .45, .94] }} whileHover={{ y: -8, scale: 1.03 }} onClick={onClick} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      className="rounded-2xl flex flex-col items-center justify-center gap-4 min-h-52 cursor-pointer"
      style={{ background: hovered ? (isDark ? 'rgba(131,87,246,.09)' : 'rgba(131,87,246,.07)') : 'var(--card-bg)', border: `2px dashed ${hovered ? col : 'var(--border)'}`, boxShadow: hovered ? `0 20px 50px var(--shadow),0 0 30px rgba(131,87,246,.1)` : 'none', transition: 'all .3s ease' }}>
      <motion.div animate={{ scale: hovered ? [1, 1.1, 1] : 1, rotate: hovered ? [0, 180, 360] : 0 }} transition={{ duration: .5 }} className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(131,87,246,.15),rgba(196,157,255,.15))', border: '1px solid rgba(131,87,246,.2)' }}>
        <PlusIcon className="w-7 h-7" style={{ color: 'var(--accent)' }} />
      </motion.div>
      <div className="text-center px-4">
        <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Crear nuevo proyecto</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Comienza una nueva agencia de IA</p>
      </div>
    </motion.div>
  )
}

// ─── New project modal ────────────────────────────────────────────────────────
function NewProjectModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (n: string, d: string) => void }) {
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [loading, setLoading] = useState(false)
  const handle = async () => {
    if (!name.trim()) { toast.error('Escribe un nombre'); return }
    setLoading(true)
    try { await onCreate(name, desc); setName(''); setDesc('') } finally { setLoading(false) }
  }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div key="modal" initial={{ opacity: 0, scale: .88, filter: 'blur(15px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: .88 }} transition={{ duration: .35, ease: [.34, 1.56, .64, 1] }} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: 'var(--surface-s)', border: '1px solid rgba(131,87,246,.25)', boxShadow: '0 40px 100px rgba(0,0,0,.7)' }}>
              <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,#8357F6,rgba(196,157,255,.8),transparent)' }} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black gradient-text">Nuevo Proyecto</h2>
                  <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--card-bg)', color: 'var(--text-2)' }}>✕</button>
                </div>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-[.2em] uppercase mb-1.5 block" style={{ color: 'rgba(131,87,246,.5)' }}>Nombre del proyecto</label>
                    <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="Ej: Clínica Estética Premium" autoFocus className="input-form rounded-xl w-full" style={{ padding: '13px 16px', fontSize: 14, borderRadius: 12 }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-[.2em] uppercase mb-1.5 block" style={{ color: 'rgba(131,87,246,.5)' }}>Descripción (opcional)</label>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Describe el negocio..." className="input-form rounded-xl w-full" style={{ padding: '13px 16px', fontSize: 14, borderRadius: 12, resize: 'none' }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <button onClick={onClose} className="btn-secondary flex-1 py-3 rounded-xl text-sm font-medium">Cancelar</button>
                    <motion.button onClick={handle} disabled={loading} whileHover={{ y: -2, boxShadow: '0 10px 30px rgba(131,87,246,.4)' }} whileTap={{ scale: .97 }} className="btn-primary flex-1 py-3 rounded-xl text-sm disabled:opacity-50">
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto block" /> : 'CREAR →'}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const glitch = useGlitch()
  const { isDark, toggleTheme } = useTheme()

  const [projects, setProjects]             = useState<Project[]>([])
  const [loading, setLoading]               = useState(true)
  const [showModal, setShowModal]           = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen]   = useState(false)
  const isMobile = useIsMobile()
  const [scrollY, setScrollY]               = useState(0)
  const [mousePos, setMousePos]             = useState({ x: .5, y: .5 })
  const [headerSolid, setHeaderSolid]       = useState(false)
  // Vista central: 'inicio' (video) por defecto | 'acelerador' (proyectos)
  const [view, setView]                     = useState<'inicio' | 'acelerador'>('inicio')
  const [playing, setPlaying]               = useState(false)
  const [posterOk, setPosterOk]             = useState(true)
  const [videoSrc, setVideoSrc]             = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo]     = useState(false)
  const playVideo = async () => {
    if (videoSrc) { setPlaying(true); return }
    if (loadingVideo) return
    setLoadingVideo(true)
    try {
      const { data } = await api.get('/video-otp')
      if (!data?.otp || !data?.playbackInfo) throw new Error('sin OTP')
      setVideoSrc(`https://player.vdocipher.com/v2/?otp=${encodeURIComponent(data.otp)}&playbackInfo=${encodeURIComponent(data.playbackInfo)}`)
      setPlaying(true)
    } catch {
      toast.error('No se pudo cargar el video. Intenta de nuevo.')
    } finally {
      setLoadingVideo(false)
    }
  }

  const canvasState  = useRef<CanvasState>({ mx: .5, my: .5, scrollY: 0, scrollVel: 0 })
  const lastScrollY  = useRef(0), lastScrollTime = useRef(Date.now())
  const mainRef      = useRef<HTMLDivElement>(null)

  // Scroll tracking (right panel)
  useEffect(() => {
    const el = mainRef.current; if (!el) return
    const onScroll = () => {
      const now = Date.now(), dt = Math.max(1, now - lastScrollTime.current)
      const vel = (el.scrollTop - lastScrollY.current) / dt
      lastScrollY.current = el.scrollTop; lastScrollTime.current = now
      canvasState.current.scrollY = el.scrollTop; canvasState.current.scrollVel = vel
      setScrollY(el.scrollTop); setHeaderSolid(el.scrollTop > 40)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Mouse tracking
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight
      canvasState.current.mx = nx; canvasState.current.my = ny
      setMousePos({ x: nx, y: ny })
    }
    window.addEventListener('mousemove', onMouse)
    return () => window.removeEventListener('mousemove', onMouse)
  }, [])

  useEffect(() => { fetchProjects() }, [])

  const fetchProjects = async () => {
    setLoading(true)
    try { setProjects(await getProjects()) } catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : 'desconocido'}`) }
    finally { setLoading(false) }
  }

  const handleCreate = async (name: string, desc: string) => {
    try {
      const p = await createProject(name, desc)
      setShowModal(false); toast.success('¡Proyecto creado!')
      navigate(`/proyecto/${p.id}/questions`)
    } catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : 'desconocido'}`) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    try { await deleteProject(id); setProjects(p => p.filter(pr => pr.id !== id)); toast.success('Eliminado') }
    catch (e: unknown) { toast.error(`Error: ${e instanceof Error ? e.message : 'desconocido'}`) }
  }

  const maxScroll = (mainRef.current?.scrollHeight ?? 0) - window.innerHeight
  const sp  = maxScroll > 0 ? Math.min(1, scrollY / maxScroll) : 0
  const col = scrollColor(sp)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Fixed BG effects (dark only) ── */}
      {isDark && <ParticleCanvas state={canvasState} />}
      {isDark && <MorphingLayer scrollY={scrollY} />}
      {isDark && <GlowOrbs scrollY={scrollY} />}
      {isDark && <CursorGlow mx={mousePos.x} my={mousePos.y} />}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none opacity-[.022]" style={{ zIndex: 1, backgroundImage: 'linear-gradient(rgba(131,87,246,1) 1px,transparent 1px),linear-gradient(90deg,rgba(131,87,246,1) 1px,transparent 1px)', backgroundSize: '55px 55px' }} />
      )}
      {isDark && glitch && (
        <motion.div className="fixed inset-0 pointer-events-none" style={{ zIndex: 25 }} initial={{ opacity: 0 }} animate={{ opacity: [0, .8, 0, .5, 0], x: [-2, 3, -1, 2, 0] }} transition={{ duration: .1 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(131,87,246,.03)', mixBlendMode: 'screen' }} />
        </motion.div>
      )}

      {/* ── Scroll progress bar ── */}
      <div className="fixed top-0 left-0 h-[2px] pointer-events-none" style={{ zIndex: 100, width: `${sp * 100}%`, background: `linear-gradient(90deg,#8357F6,${col},#AF8AE6)`, boxShadow: `0 0 10px ${col}`, transition: 'width .1s ease-out' }} />

      {/* ── Sidebar ── */}
      <Sidebar
        mode="dashboard"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onAcelerador={() => setView('acelerador')}
        aceleradorActive={view === 'acelerador'}
        onHome={() => setView('inicio')}
        user={user}
        onLogout={async () => { await logout(); navigate('/login') }}
      />

      {/* ── Right panel ── */}
      <div ref={mainRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', position: 'relative', zIndex: 10, minWidth: 0 }}>

        {/* Header */}
        <DashboardHeader
          breadcrumb={[{ label: 'Dashboard' }]}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          scrolled={headerSolid}
          left={isMobile ? (
            <button onClick={() => setMobileNavOpen(true)} className="btn-icon" style={{ width: 36, height: 36, flexShrink: 0 }} title="Menú" aria-label="Abrir menú">
              <Bars3Icon style={{ width: 20, height: 20 }} />
            </button>
          ) : undefined}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: `linear-gradient(135deg,${col},#C49DFF)`, boxShadow: `0 0 10px ${col}60` }}>
                  {(user?.user_metadata?.name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2" style={{ background: '#10B981', borderColor: 'var(--bg)' }} />
              </div>
              <span className="text-sm font-medium hidden md:block" style={{ color: 'var(--text-2)' }}>
                {user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0]}
              </span>
            </div>
          }
        />

        {/* Main content */}
        <main role="main" style={{ flex: 1, padding: 'var(--sp-xl) var(--sp-lg)', maxWidth: 1200, width: '100%', margin: '0 auto', paddingBottom: 'var(--sp-2xl)' }}>

          {/* Welcome */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }} style={{ marginBottom: 'var(--sp-xl)' }}>
            <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 'var(--sp-sm)' }}>
              {view === 'inicio' ? 'Inicio' : 'Acelerador'}
            </p>
            <h1 style={{ color: 'var(--text)', marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-2xl)' }}>
              Bienvenido,{' '}
              <span className="gradient-text">
                {user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0]}
              </span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-base)' }}>
              {view === 'inicio' ? 'Mira cómo funciona y entra al Acelerador cuando quieras.' : 'Gestiona tus agencias de IA en un solo lugar.'}
            </p>
          </motion.div>

          {view === 'inicio' ? (
            <>
              {/* Video de inicio (incrustado) */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, delay: .05 }} style={{ marginBottom: 'var(--sp-lg)' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 960, margin: '0 auto', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card-bg)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                  {playing && videoSrc ? (
                    <iframe
                      src={videoSrc}
                      title="Cómo funciona el Acelerador"
                      allow="encrypted-media; fullscreen; autoplay"
                      allowFullScreen
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    />
                  ) : posterOk ? (
                    <button onClick={playVideo} disabled={loadingVideo} aria-label="Reproducir video: ¿Cómo funciona el Acelerador?"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, background: 'none', cursor: loadingVideo ? 'wait' : 'pointer', display: 'block' }}>
                      <img src={VIDEO_POSTER} alt="¿Cómo funciona el Acelerador? Dale Play" onError={() => setPosterOk(false)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {loadingVideo && (
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,11,48,0.5)', color: '#fff', fontSize: 14, fontWeight: 600 }}>Cargando video…</span>
                      )}
                    </button>
                  ) : (
                    <button onClick={playVideo} disabled={loadingVideo} aria-label="Reproducir video"
                      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-3)', background: 'none', border: 0, cursor: loadingVideo ? 'wait' : 'pointer', width: '100%' }}>
                      <PlayCircleIcon style={{ width: 64, height: 64, color: 'var(--accent)' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>{loadingVideo ? 'Cargando video…' : '¿Cómo funciona el Acelerador? — Dale Play'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          ) : (
            <>
              {/* Stats */}
              <div style={{ marginBottom: 'var(--sp-xl)' }}>
                <StatsCards
                  total={projects.length}
                  active={projects.filter(p => p.status !== 'completed').length}
                  completed={projects.filter(p => p.status === 'completed').length}
                />
              </div>

              {/* Divider + crear */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: col }}>Proyectos</span>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                <button className="btn-primary" onClick={() => setShowModal(true)} style={{ fontSize: 12, padding: '8px 16px' }}>
                  <PlusIcon style={{ width: 15, height: 15 }} /> Nuevo proyecto
                </button>
              </div>

              {/* Project grid */}
              <ProjectGrid
                projects={projects}
                loading={loading}
                renderEmpty={() => <EmptyState onNew={() => setShowModal(true)} />}
                renderNewCard={() => (
                  <NewProjectCard onClick={() => setShowModal(true)} col={col} isDark={isDark} />
                )}
                renderCard={(project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={{ ...project }}
                    index={index}
                    col={col}
                    isDark={isDark}
                    onContinue={() => {
                      const step = project.current_step ?? 1
                      if (step <= 1) navigate(`/proyecto/${project.id}/questions`)
                      else if (step === 2) navigate(`/proyecto/${project.id}/review-niche`)
                      else navigate(`/proyecto/${project.id}/tools`)
                    }}
                    onDelete={() => handleDelete(project.id, project.name)}
                  />
                )}
              />
            </>
          )}
        </main>
      </div>

      {/* Modal */}
      <NewProjectModal open={showModal} onClose={() => setShowModal(false)} onCreate={handleCreate} />
    </div>
  )
}
