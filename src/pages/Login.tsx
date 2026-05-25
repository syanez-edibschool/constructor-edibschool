import { useState, useEffect, useRef, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

// ─────────────────────────────────────────────────────────────────────────────
// Hook: glitch effect (random, every 3-5s)
// ─────────────────────────────────────────────────────────────────────────────
function useGlitch() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async function loop() {
      while (alive) {
        await new Promise(r => setTimeout(r, 3200 + Math.random() * 4000))
        if (!alive) break
        setActive(true)
        await new Promise(r => setTimeout(r, 80 + Math.random() * 100))
        if (!alive) break
        setActive(false)
      }
    })()
    return () => { alive = false }
  }, [])
  return active
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas: particles + mouse attraction + trails + distortion waves
// ─────────────────────────────────────────────────────────────────────────────
interface CanvasRefs { scrollProgress: number; scrollVel: number; mx: number; my: number }

function ParticleCanvas({ refs }: { refs: React.MutableRefObject<CanvasRefs> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf: number

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    type RGB = [number, number, number]
    const C: RGB[] = [[0,217,255],[0,217,255],[139,92,246],[236,72,153],[139,92,246]]

    interface P {
      x: number; y: number; vx: number; vy: number
      r: number; opacity: number; color: RGB
      phase: number; freq: number; trail: { x: number; y: number }[]
    }

    const particles: P[] = Array.from({ length: 68 }, (_, i) => {
      const x = Math.random() * window.innerWidth
      const y = Math.random() * window.innerHeight
      // Mix of tiny (0.5-1.5), medium (1.5-4), large (4-7) particles
      const sizeClass = i < 30 ? Math.random()*1+0.5 : i < 55 ? Math.random()*2.5+1.5 : Math.random()*3+4
      return { x, y, vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.3,
        r: sizeClass, opacity: Math.random()*0.4+0.08,
        color: C[Math.floor(Math.random()*C.length)],
        phase: Math.random()*Math.PI*2, freq: Math.random()*0.007+0.002, trail: [] }
    })

    let t = 0
    const draw = () => {
      t++
      const { scrollProgress: sp, scrollVel: sv, mx, my } = refs.current
      const intensity = sp < 0.5 ? sp * 2 : 2 - sp * 2   // 0→1→0 bell
      const speedMult = 1 + intensity * 3.5
      const motionBlur = Math.min(1, Math.abs(sv) * 6)

      // Trail / motion-blur clear
      const clearA = lerp(0.88, 0.2, motionBlur)
      ctx.fillStyle = `rgba(10,10,15,${clearA})`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Distortion waves (visible at climax)
      if (intensity > 0.08) {
        for (let i = 0; i < 6; i++) {
          const baseY = (canvas.height / 7) * (i + 0.5) + Math.sin(t * 0.018 + i) * 25
          ctx.beginPath()
          for (let x = 0; x <= canvas.width; x += 18) {
            const y = baseY + Math.sin(x * 0.008 + t * 0.025 + i * 1.7) * 18 * intensity
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.strokeStyle = `rgba(0,217,255,${0.025 * intensity})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Mouse pixel position
      const mxPx = mx * canvas.width
      const myPx = my * canvas.height

      for (const p of particles) {
        const dx = mxPx - p.x, dy = myPx - p.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.001
        // Tractor beam: strong pull inside 350px, fades at edges
        const attractRadius = 350
        const attractStrength = Math.max(0, 1 - dist / attractRadius)
        // Squared falloff so close ones accelerate much harder
        const force = attractStrength * attractStrength * 1.8

        // Radial (toward cursor) — fast snap
        p.vx += (dx / dist) * force * 2.4
        p.vy += (dy / dist) * force * 2.4

        // Tangential (vortex swirl) — perpendicular force, weaker
        const perpX = -dy / dist, perpY = dx / dist
        p.vx += perpX * force * 0.35
        p.vy += perpY * force * 0.35

        // Ambient float (always present, gentle)
        p.vx += Math.sin(t * p.freq + p.phase) * 0.018
        p.vy += Math.cos(t * p.freq * 1.4 + p.phase) * 0.013

        // Damping: higher friction so velocity doesn't explode
        const damp = attractStrength > 0.1 ? 0.78 : 0.93
        p.vx *= damp; p.vy *= damp

        // Scroll intensity multiplies movement
        p.x += p.vx * speedMult; p.y += p.vy * speedMult

        // Wrap
        if (p.x < -25) p.x = canvas.width + 25
        if (p.x > canvas.width + 25) p.x = -25
        if (p.y < -25) p.y = canvas.height + 25
        if (p.y > canvas.height + 25) p.y = -25

        // Trail — always visible when moving fast, longer near cursor
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy)
        p.trail.push({ x: p.x, y: p.y })
        const maxTrail = attractStrength > 0.3 ? 22 : 10
        if (p.trail.length > maxTrail) p.trail.shift()

        // Draw meteor trail (always, based on speed)
        const trailOpacity = Math.min(1, speed * 0.4) * (0.15 + attractStrength * 0.5)
        if (p.trail.length > 2 && trailOpacity > 0.02) {
          ctx.beginPath()
          ctx.moveTo(p.trail[0].x, p.trail[0].y)
          for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
          const [r,g,b] = p.color
          ctx.strokeStyle = `rgba(${r},${g},${b},${trailOpacity})`
          ctx.lineWidth = p.r * (0.6 + attractStrength * 0.8)
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Halo + core — glow intensifies near cursor
        const [r,g,b] = p.color
        const glowBoost = 1 + intensity * 0.6 + attractStrength * 2.5
        const haloRadius = p.r * (6 + attractStrength * 8)
        const halo = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y, haloRadius)
        halo.addColorStop(0, `rgba(${r},${g},${b},${Math.min(0.95, p.opacity * glowBoost)})`)
        halo.addColorStop(0.3, `rgba(${r},${g},${b},${Math.min(0.4, p.opacity * glowBoost * 0.25)})`)
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath(); ctx.arc(p.x, p.y, haloRadius, 0, Math.PI*2)
        ctx.fillStyle = halo; ctx.fill()

        // Core dot — brighter near cursor
        const coreAlpha = Math.min(1, p.opacity * 3 + attractStrength * 2)
        const coreR = p.r * (1 + attractStrength * 0.8)
        ctx.beginPath(); ctx.arc(p.x, p.y, coreR, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${r},${g},${b},${coreAlpha})`
        ctx.fill()

        // Extra bloom ring for large particles near cursor
        if (p.r > 3 && attractStrength > 0.2) {
          ctx.beginPath(); ctx.arc(p.x, p.y, coreR * 2.5, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(${r},${g},${b},${attractStrength * 0.3})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [refs])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" style={{ width:'100%', height:'100%' }} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Morphing shapes (5 shapes, scroll-reactive speed + size)
// ─────────────────────────────────────────────────────────────────────────────
const MORPHS = [
  ['60% 40% 30% 70%/60% 30% 70% 40%','30% 60% 70% 40%/50% 60% 30% 60%','50% 40% 60% 50%/40% 50% 60% 50%','40% 60% 30% 70%/60% 40% 70% 30%','60% 40% 30% 70%/60% 30% 70% 40%'],
  ['40% 60% 70% 30%/40% 50% 60% 50%','60% 40% 30% 70%/60% 30% 70% 40%','30% 60% 70% 40%/50% 60% 30% 60%','70% 30% 50% 50%/50% 70% 30% 60%','40% 60% 70% 30%/40% 50% 60% 50%'],
  ['50% 50% 50% 50%/50% 50% 50% 50%','60% 40% 30% 70%/60% 30% 70% 40%','30% 70% 60% 40%/40% 60% 70% 30%','70% 30% 40% 60%/30% 70% 40% 60%','50% 50% 50% 50%/50% 50% 50% 50%'],
  ['70% 30% 30% 70%/70% 70% 30% 30%','30% 70% 70% 30%/30% 30% 70% 70%','50% 50% 50% 50%/50% 50% 50% 50%','60% 40% 60% 40%/40% 60% 40% 60%','70% 30% 30% 70%/70% 70% 30% 30%'],
  ['45% 55% 65% 35%/35% 45% 55% 65%','55% 45% 35% 65%/65% 55% 45% 35%','50% 50% 50% 50%/50% 50% 50% 50%','40% 60% 55% 45%/60% 40% 45% 55%','45% 55% 65% 35%/35% 45% 55% 65%'],
]

const SHAPE_DEFS = [
  { size: 520, x: '-10%', y: '-18%', color: '0,217,255', op: 0.14, delay: 0, dur: 9, morph: 0 },
  { size: 580, x: '62%',  y: '45%',  color: '139,92,246', op: 0.12, delay: 2.5, dur: 11, morph: 1 },
  { size: 380, x: '20%',  y: '62%',  color: '236,72,153', op: 0.09, delay: 5, dur: 8, morph: 2 },
  { size: 300, x: '78%',  y: '-6%',  color: '0,217,255', op: 0.08, delay: 3.5, dur: 10, morph: 3 },
  { size: 250, x: '42%',  y: '82%',  color: '139,92,246', op: 0.07, delay: 1, dur: 7, morph: 4 },
]

function MorphingLayer({ intensity, offset }: { intensity: number; offset: number }) {
  const sf = 1 + intensity * 1.8  // speed factor at climax
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ transform: `translateY(${offset}px)` }}>
      {SHAPE_DEFS.map((s, i) => (
        <motion.div key={i} style={{
          position: 'absolute', left: s.x, top: s.y,
          width: s.size * (1 + intensity * 0.25),
          height: s.size * (1 + intensity * 0.25),
          background: `radial-gradient(circle, rgba(${s.color},${s.op + intensity * 0.08}) 0%, transparent 70%)`,
          filter: `blur(${58 + intensity * 25}px)`,
        }}
          animate={{ borderRadius: MORPHS[s.morph], rotate: [0, 360] }}
          transition={{
            borderRadius: { duration: s.dur / sf, delay: s.delay, repeat: Infinity, ease: 'easeInOut' },
            rotate: { duration: s.dur * 3.5 / sf, repeat: Infinity, ease: 'linear' },
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Glow orbs (3, parallax)
// ─────────────────────────────────────────────────────────────────────────────
function GlowOrbs({ intensity, offset }: { intensity: number; offset: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ transform: `translateY(${offset}px)` }}>
      {[
        { w: 480+intensity*200, x: '4%', y: `${4 - intensity*12}%`, color:'0,217,255', dur: 5, delay: 0 },
        { w: 560+intensity*160, x: 'auto', y: `${4 - intensity*10}%`, color:'139,92,246', dur: 7, delay: 1.5, right:'4%' },
        { w: 320+intensity*100, x: '38%', y: `${38 + intensity*8}%`, color:'236,72,153', dur: 6, delay: 3 },
      ].map((o, i) => (
        <motion.div key={i} style={{
          position: 'absolute',
          width: o.w, height: o.w,
          left: o.x, top: o.y, right: (o as any).right,
          background: `radial-gradient(circle, rgba(${o.color},${0.09 + intensity * 0.13}) 0%, transparent 65%)`,
          filter: `blur(${38 + intensity * 22}px)`,
        }}
          animate={{ scale: [1, 1 + 0.12 + intensity*0.1, 1], opacity: [0.55+intensity*0.2, 0.9+intensity*0.1, 0.55+intensity*0.2] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut', delay: o.delay }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cursor glow
// ─────────────────────────────────────────────────────────────────────────────
function CursorGlow({ mx, my }: { mx: number; my: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10" aria-hidden>
      <div style={{
        position: 'absolute',
        left: `${mx * 100}%`, top: `${my * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(0,217,255,0.09) 0%, transparent 60%)',
        filter: 'blur(18px)',
        transition: 'left 0.08s ease-out, top 0.08s ease-out',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Glitch overlay
// ─────────────────────────────────────────────────────────────────────────────
function GlitchOverlay() {
  return (
    <motion.div
      className="absolute inset-0 z-30 pointer-events-none"
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: [0, 0.9, 0, 0.6, 0, 0.8, 0], x: [-3, 3, -2, 4, 0, -1, 0], skewX: [0, 1, -1, 0] }}
      transition={{ duration: 0.12, ease: 'linear' }}
      style={{ background: 'linear-gradient(135deg, rgba(0,217,255,0.04), rgba(236,72,153,0.04))', mixBlendMode: 'screen' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Neon input
// ─────────────────────────────────────────────────────────────────────────────
function NeonInput({ label, type, placeholder, value, onChange, autoComplete }: {
  label: string; type: string; placeholder: string
  value: string; onChange: (v: string) => void; autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(0,217,255,0.5)' }}>{label}</label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} autoComplete={autoComplete}
        className="input-login rounded-xl"
        style={{ width: '100%', padding: '13px 16px', fontSize: 14 }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Button with ripple + particle explosion
// ─────────────────────────────────────────────────────────────────────────────
type Spark = { id: number; x: number; y: number; vx: number; vy: number; color: string }
type Ripple = { id: number; x: number; y: number }

function GradientButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  const [sparks, setSparks] = useState<Spark[]>([])
  const [ripples, setRipples] = useState<Ripple[]>([])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    const rid = Date.now()
    setRipples(r => [...r, { id: rid, x: cx, y: cy }])
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== rid)), 700)

    const COLS = ['#00D9FF','#8B5CF6','#EC4899','#ffffff','#00D9FF']
    const ns: Spark[] = Array.from({ length: 18 }, (_, i) => ({
      id: rid + i, x: cx, y: cy,
      vx: (Math.random()-0.5)*9, vy: (Math.random()-0.5)*9,
      color: COLS[Math.floor(Math.random()*COLS.length)],
    }))
    setSparks(s => [...s, ...ns])
    setTimeout(() => setSparks(s => s.filter(sp => !ns.find(n => n.id === sp.id))), 900)
  }

  return (
    <motion.button
      type="submit" disabled={loading} onClick={handleClick}
      whileHover={{ y: -4, boxShadow: '0 20px 60px rgba(0,217,255,0.5), 0 8px 30px rgba(139,92,246,0.4)' }}
      whileTap={{ y: -1, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 280, damping: 18 }}
      className="relative w-full overflow-hidden rounded-xl py-[15px] text-sm font-black tracking-[0.18em] uppercase text-white disabled:opacity-50"
      style={{ background: 'linear-gradient(135deg, #00D9FF 0%, #8B5CF6 55%, #EC4899 100%)' }}
    >
      {/* Shimmer sweep */}
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.28) 50%, transparent 65%)', backgroundSize: '200% 100%' }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      />
      {/* Ripples */}
      {ripples.map(rp => (
        <motion.span key={rp.id} className="absolute rounded-full bg-white/25 pointer-events-none"
          style={{ left: rp.x-12, top: rp.y-12, width: 24, height: 24 }}
          initial={{ scale: 0, opacity: 0.8 }} animate={{ scale: 15, opacity: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        />
      ))}
      {/* Sparks */}
      {sparks.map(sp => (
        <motion.div key={sp.id} className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{ left: sp.x, top: sp.y, background: sp.color }}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ x: sp.vx * 22, y: sp.vy * 22, opacity: 0, scale: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      ))}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Entrando...</> : children}
      </span>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll indicator
// ─────────────────────────────────────────────────────────────────────────────
function ScrollHint() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
    >
      <p className="text-[10px] tracking-[0.25em] uppercase text-white/25">Scroll para explorar</p>
      <motion.div
        className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5"
        style={{ border: '1px solid rgba(0,217,255,0.25)' }}
      >
        <motion.div className="w-1 h-2 rounded-full"
          style={{ background: '#00D9FF' }}
          animate={{ y: [0, 10, 0], opacity: [1, 0, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Color based on scroll (cyan → purple → pink → cyan)
// ─────────────────────────────────────────────────────────────────────────────
function scrollColor(sp: number): string {
  if (sp < 0.33) return `rgba(${lerp(0,139,sp/0.33).toFixed(0)},${lerp(217,92,sp/0.33).toFixed(0)},${lerp(255,246,sp/0.33).toFixed(0)},1)`
  if (sp < 0.66) { const t=(sp-0.33)/0.33; return `rgba(${lerp(139,236,t).toFixed(0)},${lerp(92,72,t).toFixed(0)},${lerp(246,153,t).toFixed(0)},1)` }
  const t=(sp-0.66)/0.34; return `rgba(${lerp(236,0,t).toFixed(0)},${lerp(72,217,t).toFixed(0)},${lerp(153,255,t).toFixed(0)},1)`
}

function cardScale(sp: number): number {
  if (sp < 0.42) return lerp(0.82, 1.0, sp / 0.42)
  if (sp < 0.68) return lerp(1.0, 1.15, (sp - 0.42) / 0.26)
  return lerp(1.15, 0.4, (sp - 0.68) / 0.32)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sp, setSp] = useState(0)     // scroll progress 0-1
  const glitching = useGlitch()

  const containerRef = useRef<HTMLDivElement>(null)
  const lastScrollTop = useRef(0)
  const lastScrollTime = useRef(Date.now())
  const canvasRefs = useRef<CanvasRefs>({ scrollProgress: 0, scrollVel: 0, mx: 0.5, my: 0.5 })

  // Mouse → Framer Motion springs for card tilt
  const rawMX = useMotionValue(0)
  const rawMY = useMotionValue(0)
  const smMX = useSpring(rawMX, { stiffness: 55, damping: 14 })
  const smMY = useSpring(rawMY, { stiffness: 55, damping: 14 })
  const rotateY = useTransform(smMX, [-1, 1], [-13, 13])
  const rotateX = useTransform(smMY, [-1, 1], [9, -9])

  // Mouse raw state for cursor glow
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  // Scroll handler
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    const newSp = maxScroll > 0 ? el.scrollTop / maxScroll : 0
    const now = Date.now()
    const dt = Math.max(1, now - lastScrollTime.current)
    const vel = (el.scrollTop - lastScrollTop.current) / dt
    lastScrollTop.current = el.scrollTop
    lastScrollTime.current = now
    canvasRefs.current.scrollProgress = newSp
    canvasRefs.current.scrollVel = vel
    setSp(newSp)
  }

  // Mouse handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const nx = e.clientX / window.innerWidth
    const ny = e.clientY / window.innerHeight
    rawMX.set(nx * 2 - 1)
    rawMY.set(ny * 2 - 1)
    setMousePos({ x: nx, y: ny })
    canvasRefs.current.mx = nx
    canvasRefs.current.my = ny
  }

  // Derived values
  const intensity = sp < 0.5 ? sp * 2 : 2 - sp * 2
  const scale = cardScale(sp)
  const glowCol = scrollColor(sp)
  const scrollRotX = Math.sin(sp * Math.PI * 2) * 5
  const scrollRotZ = Math.sin(sp * Math.PI * 1.8) * 2
  const cardBlur = sp > 0.8 ? (sp - 0.8) / 0.2 * 4 : 0  // blurs out on exit

  // Parallax offsets (layers 2-4)
  const shapeOffset = sp * 60     // 40% of max ≈ 60px at full
  const orbOffset   = sp * 90     // 60%
  const cardOffset  = sp * 30     // 80% (subtle)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Completa todos los campos'); return }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onMouseMove={handleMouseMove}
      style={{ height: '100vh', overflowY: 'scroll', scrollBehavior: 'smooth' }}
    >
      {/* Tall scroll track */}
      <div style={{ height: '300vh' }}>
        {/* Sticky viewport */}
        <div style={{
          position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
          background: '#0a0a0f',
        }}>

          {/* ── Layer 1: Particle canvas (parallax internal) ── */}
          <ParticleCanvas refs={canvasRefs} />

          {/* ── Layer 2: Morphing shapes (40% speed) ── */}
          <MorphingLayer intensity={intensity} offset={shapeOffset} />

          {/* ── Layer 3: Glow orbs (60% speed) ── */}
          <GlowOrbs intensity={intensity} offset={orbOffset} />

          {/* Grid texture */}
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(0,217,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,255,1) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }} />

          {/* Cursor glow */}
          <CursorGlow mx={mousePos.x} my={mousePos.y} />

          {/* Glitch overlay */}
          {glitching && <GlitchOverlay />}

          {/* ── Layer 4+5: Card (80% speed + scale + rotation) ── */}
          <div className="absolute inset-0 flex items-center justify-center z-20"
            style={{ transform: `translateY(${cardOffset}px)` }}>

            {/* Scroll-based 3D rotation wrapper */}
            <div style={{
              perspective: 1200,
              transform: `rotateX(${scrollRotX}deg) rotateZ(${scrollRotZ}deg) scale(${scale})`,
              transition: 'transform 0.12s ease-out',
            }}>
              {/* Mouse tilt (Framer Motion springs) */}
              <motion.div
                style={{ rotateY, rotateX, filter: cardBlur > 0 ? `blur(${cardBlur}px)` : 'none' }}
                initial={{ opacity: 0, scale: 0.85, filter: 'blur(20px)' }}
                animate={{ opacity: 1, scale: 1, filter: cardBlur > 0 ? `blur(${cardBlur}px)` : 'blur(0px)' }}
                transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
                className="w-[420px] max-w-[calc(100vw-32px)]"
              >
                {/* Animated border glow */}
                <motion.div
                  className="absolute -inset-[1.5px] rounded-3xl pointer-events-none"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  style={{
                    background: `linear-gradient(135deg, ${glowCol}, rgba(139,92,246,0.6), rgba(236,72,153,0.4))`,
                    filter: `blur(1px)`,
                    borderRadius: 28,
                  }}
                />

                {/* Card body */}
                <div className="relative rounded-[26px] overflow-hidden" style={{
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                  border: `1px solid rgba(0,217,255,${0.15 + intensity * 0.25})`,
                  boxShadow: `0 40px 100px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 ${60 + intensity*60}px rgba(0,217,255,${0.05 + intensity*0.1})`,
                }}>
                  {/* Top line */}
                  <div className="h-[1.5px]" style={{ background: `linear-gradient(90deg, transparent, ${glowCol}, rgba(139,92,246,0.9), transparent)` }} />

                  <div className="px-8 pt-9 pb-8">
                    {/* Logo */}
                    <div className="text-center mb-7">
                      <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <motion.span
                          className="text-[36px] font-black"
                          style={{
                            background: `linear-gradient(135deg, ${glowCol} 0%, #8B5CF6 50%, #EC4899 100%)`,
                            backgroundSize: '300% 100%',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                          }}
                          animate={{ backgroundPosition: ['0% 0','100% 0','0% 0'] }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                        >
                          ◆ Constructor
                        </motion.span>
                      </motion.div>
                      <motion.p
                        className="text-[10px] tracking-[0.3em] uppercase mt-1.5"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        Crea tu Agencia de IA
                      </motion.p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                      <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                        <NeonInput label="Email" type="email" placeholder="tu@email.com"
                          value={email} onChange={setEmail} autoComplete="email" />
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.42 }}>
                        <NeonInput label="Contraseña" type="password" placeholder="••••••••"
                          value={password} onChange={setPassword} autoComplete="current-password" />
                      </motion.div>

                      <motion.div className="flex items-center justify-between text-[11px]"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}>
                        <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <div className="w-3.5 h-3.5 rounded border" style={{ borderColor: 'rgba(0,217,255,0.25)', background: 'rgba(0,217,255,0.05)' }} />
                          Recordarme
                        </label>
                        <button type="button" className="transition-colors" style={{ color: 'rgba(0,217,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#00D9FF')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(0,217,255,0.7)')}>
                          ¿Olvidaste tu contraseña?
                        </button>
                      </motion.div>

                      <motion.div className="mt-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
                        <GradientButton loading={loading}>ENTRAR →</GradientButton>
                      </motion.div>
                    </form>

                    {/* Divider */}
                    <motion.div className="flex items-center gap-3 my-5"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08))' }} />
                      <span className="text-[10px] tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.2)' }}>O CONTINÚA CON</span>
                      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)' }} />
                    </motion.div>

                    {/* Social */}
                    <motion.div className="flex gap-3"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.66 }}>
                      {[
                        {
                          label: 'Google',
                          icon: <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        },
                        {
                          label: 'GitHub',
                          icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                        },
                      ].map(({ label, icon }) => (
                        <motion.button key={label} type="button"
                          whileHover={{ y: -3, borderColor: 'rgba(0,217,255,0.4)', boxShadow: '0 8px 25px rgba(0,0,0,0.35)' }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => toast('Próximamente', { icon: '⏳' })}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-colors"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
                        >
                          {icon}{label}
                        </motion.button>
                      ))}
                    </motion.div>

                    {/* Footer */}
                    <motion.p className="text-center text-[11px] mt-5"
                      style={{ color: 'rgba(255,255,255,0.28)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}>
                      ¿No tienes cuenta?{' '}
                      <Link to="/signup" className="font-semibold transition-all"
                        style={{ color: '#00D9FF' }}
                        onMouseEnter={e => (e.currentTarget.style.textShadow = '0 0 12px rgba(0,217,255,0.9)')}
                        onMouseLeave={e => (e.currentTarget.style.textShadow = 'none')}>
                        Crear cuenta gratis
                      </Link>
                    </motion.p>
                  </div>

                  {/* Bottom line */}
                  <div className="h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(0,217,255,0.6), transparent)' }} />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Corner brackets */}
          {[
            { pos: 'top-5 left-5', b: 'border-t border-l', r: 'rounded-tl' },
            { pos: 'top-5 right-5', b: 'border-t border-r', r: 'rounded-tr' },
            { pos: 'bottom-5 left-5', b: 'border-b border-l', r: 'rounded-bl' },
            { pos: 'bottom-5 right-5', b: 'border-b border-r', r: 'rounded-br' },
          ].map(({ pos, b, r }, i) => (
            <div key={i} className={`fixed ${pos} w-10 h-10 ${b} ${r} pointer-events-none z-10 opacity-20`}
              style={{ borderColor: i % 2 === 0 ? 'rgba(0,217,255,0.6)' : 'rgba(139,92,246,0.6)' }} />
          ))}

          {/* Scroll hint (fade out after first scroll) */}
          {sp < 0.04 && <ScrollHint />}

          {/* Scroll progress bar (top) */}
          <div className="absolute top-0 left-0 h-[2px] pointer-events-none z-30" style={{
            width: `${sp * 100}%`,
            background: `linear-gradient(90deg, #00D9FF, ${glowCol}, #EC4899)`,
            boxShadow: `0 0 12px ${glowCol}`,
            transition: 'width 0.1s ease-out',
          }} />

        </div>
      </div>
    </div>
  )
}
