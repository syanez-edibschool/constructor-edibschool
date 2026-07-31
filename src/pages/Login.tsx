import { useState, useEffect, useRef, FormEvent } from 'react'
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
// Canvas: particles + trails + distortion waves (sin seguimiento del cursor)
// ─────────────────────────────────────────────────────────────────────────────
interface CanvasRefs { scrollProgress: number; scrollVel: number }

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
    const C: RGB[] = [[131,87,246],[131,87,246],[196,157,255],[236,72,153],[196,157,255]]

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
      const { scrollProgress: sp, scrollVel: sv } = refs.current
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
          ctx.strokeStyle = `rgba(131,87,246,${0.025 * intensity})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      for (const p of particles) {
        // Ambient float (único movimiento: ya no reacciona al cursor)
        p.vx += Math.sin(t * p.freq + p.phase) * 0.018
        p.vy += Math.cos(t * p.freq * 1.4 + p.phase) * 0.013

        // Damping: friction so velocity doesn't explode
        p.vx *= 0.93; p.vy *= 0.93

        // Scroll intensity multiplies movement
        p.x += p.vx * speedMult; p.y += p.vy * speedMult

        // Wrap
        if (p.x < -25) p.x = canvas.width + 25
        if (p.x > canvas.width + 25) p.x = -25
        if (p.y < -25) p.y = canvas.height + 25
        if (p.y > canvas.height + 25) p.y = -25

        // Trail — visible when moving fast
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy)
        p.trail.push({ x: p.x, y: p.y })
        if (p.trail.length > 10) p.trail.shift()

        // Draw meteor trail (always, based on speed)
        const trailOpacity = Math.min(1, speed * 0.4) * 0.15
        if (p.trail.length > 2 && trailOpacity > 0.02) {
          ctx.beginPath()
          ctx.moveTo(p.trail[0].x, p.trail[0].y)
          for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
          const [r,g,b] = p.color
          ctx.strokeStyle = `rgba(${r},${g},${b},${trailOpacity})`
          ctx.lineWidth = p.r * 0.6
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Halo + core
        const [r,g,b] = p.color
        const glowBoost = 1 + intensity * 0.6
        const haloRadius = p.r * 6
        const halo = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y, haloRadius)
        halo.addColorStop(0, `rgba(${r},${g},${b},${Math.min(0.95, p.opacity * glowBoost)})`)
        halo.addColorStop(0.3, `rgba(${r},${g},${b},${Math.min(0.4, p.opacity * glowBoost * 0.25)})`)
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath(); ctx.arc(p.x, p.y, haloRadius, 0, Math.PI*2)
        ctx.fillStyle = halo; ctx.fill()

        // Core dot
        const coreAlpha = Math.min(1, p.opacity * 3)
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${r},${g},${b},${coreAlpha})`
        ctx.fill()
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
  { size: 520, x: '-10%', y: '-18%', color: '131,87,246', op: 0.14, delay: 0, dur: 9, morph: 0 },
  { size: 580, x: '62%',  y: '45%',  color: '196,157,255', op: 0.12, delay: 2.5, dur: 11, morph: 1 },
  { size: 380, x: '20%',  y: '62%',  color: '236,72,153', op: 0.09, delay: 5, dur: 8, morph: 2 },
  { size: 300, x: '78%',  y: '-6%',  color: '131,87,246', op: 0.08, delay: 3.5, dur: 10, morph: 3 },
  { size: 250, x: '42%',  y: '82%',  color: '196,157,255', op: 0.07, delay: 1, dur: 7, morph: 4 },
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
        { w: 480+intensity*200, x: '4%', y: `${4 - intensity*12}%`, color:'131,87,246', dur: 5, delay: 0 },
        { w: 560+intensity*160, x: 'auto', y: `${4 - intensity*10}%`, color:'196,157,255', dur: 7, delay: 1.5, right:'4%' },
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
// Glitch overlay
// ─────────────────────────────────────────────────────────────────────────────
function GlitchOverlay() {
  return (
    <motion.div
      className="absolute inset-0 z-30 pointer-events-none"
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: [0, 0.9, 0, 0.6, 0, 0.8, 0], x: [-3, 3, -2, 4, 0, -1, 0], skewX: [0, 1, -1, 0] }}
      transition={{ duration: 0.12, ease: 'linear' }}
      style={{ background: 'linear-gradient(135deg, rgba(131,87,246,0.04), rgba(236,72,153,0.04))', mixBlendMode: 'screen' }}
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
      <label className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(131,87,246,0.5)' }}>{label}</label>
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

    const COLS = ['#8357F6','#C49DFF','#AF8AE6','#ffffff','#8357F6']
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
      whileHover={{ y: -4, boxShadow: '0 20px 60px rgba(131,87,246,0.5), 0 8px 30px rgba(196,157,255,0.4)' }}
      whileTap={{ y: -1, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 280, damping: 18 }}
      className="relative w-full overflow-hidden rounded-xl py-[15px] text-sm font-black tracking-[0.18em] uppercase text-white disabled:opacity-50"
      style={{ background: 'linear-gradient(135deg, #8357F6 0%, #C49DFF 55%, #AF8AE6 100%)' }}
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
        {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</> : children}
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
        style={{ border: '1px solid rgba(131,87,246,0.25)' }}
      >
        <motion.div className="w-1 h-2 rounded-full"
          style={{ background: '#8357F6' }}
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
  const { loginWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sp, setSp] = useState(0)     // scroll progress 0-1
  const glitching = useGlitch()

  const containerRef = useRef<HTMLDivElement>(null)
  const lastScrollTop = useRef(0)
  const lastScrollTime = useRef(Date.now())
  const canvasRefs = useRef<CanvasRefs>({ scrollProgress: 0, scrollVel: 0 })

  // Mouse → Framer Motion springs for card tilt
  const rawMX = useMotionValue(0)
  const rawMY = useMotionValue(0)
  const smMX = useSpring(rawMX, { stiffness: 55, damping: 14 })
  const smMY = useSpring(rawMY, { stiffness: 55, damping: 14 })
  const rotateY = useTransform(smMX, [-1, 1], [-13, 13])
  const rotateX = useTransform(smMY, [-1, 1], [9, -9])

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

  // Mouse handler — solo inclina la tarjeta (motion values: no re-renderiza).
  // El fondo ya no reacciona al cursor.
  const handleMouseMove = (e: React.MouseEvent) => {
    rawMX.set((e.clientX / window.innerWidth) * 2 - 1)
    rawMY.set((e.clientY / window.innerHeight) * 2 - 1)
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
    if (!email) { toast.error('Escribe tu email'); return }
    setLoading(true)
    try {
      await loginWithMagicLink(email)
      setSent(true)
      toast.success('Te enviamos un link de acceso a tu email.', { duration: 6000 })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el link')
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
          background: '#0E0B30',
        }}>

          {/* ── Layer 1: Particle canvas (parallax internal) ── */}
          <ParticleCanvas refs={canvasRefs} />

          {/* ── Layer 2: Morphing shapes (40% speed) ── */}
          <MorphingLayer intensity={intensity} offset={shapeOffset} />

          {/* ── Layer 3: Glow orbs (60% speed) ── */}
          <GlowOrbs intensity={intensity} offset={orbOffset} />

          {/* Grid texture */}
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(131,87,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(131,87,246,1) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }} />

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
                    background: `linear-gradient(135deg, ${glowCol}, rgba(196,157,255,0.6), rgba(236,72,153,0.4))`,
                    filter: `blur(1px)`,
                    borderRadius: 28,
                  }}
                />

                {/* Card body */}
                <div className="relative rounded-[26px] overflow-hidden" style={{
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                  border: `1px solid rgba(131,87,246,${0.15 + intensity * 0.25})`,
                  boxShadow: `0 40px 100px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 ${60 + intensity*60}px rgba(131,87,246,${0.05 + intensity*0.1})`,
                }}>
                  {/* Top line */}
                  <div className="h-[1.5px]" style={{ background: `linear-gradient(90deg, transparent, ${glowCol}, rgba(196,157,255,0.9), transparent)` }} />

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
                            background: `linear-gradient(135deg, ${glowCol} 0%, #C49DFF 50%, #AF8AE6 100%)`,
                            backgroundSize: '300% 100%',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                          }}
                          animate={{ backgroundPosition: ['0% 0','100% 0','0% 0'] }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                        >
                          <img src="/logo_blanco.png" alt="MKT Hackers" style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block' }} />
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

                      <motion.p className="text-[11px] leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}>
                        Escribe tu correo y te enviaremos un link de acceso. No necesitas contraseña.
                      </motion.p>

                      <motion.div className="mt-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
                        <GradientButton loading={loading}>{sent ? 'LINK ENVIADO ✓' : 'ENVIAR LINK DE ACCESO →'}</GradientButton>
                      </motion.div>

                      {sent && (
                        <motion.p className="text-[11px] text-center leading-relaxed"
                          style={{ color: 'rgba(131,87,246,0.7)' }}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          Revisa tu bandeja de entrada (y spam). Haz clic en el link para entrar.
                        </motion.p>
                      )}
                    </form>

                    {/* Footer */}
                    <motion.p className="text-center text-[11px] mt-6 leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.28)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.66 }}>
                      ¿No tienes acceso? Solicita una invitación a tu administrador.
                    </motion.p>
                  </div>

                  {/* Bottom line */}
                  <div className="h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,157,255,0.6), rgba(131,87,246,0.6), transparent)' }} />
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
              style={{ borderColor: i % 2 === 0 ? 'rgba(131,87,246,0.6)' : 'rgba(196,157,255,0.6)' }} />
          ))}

          {/* Scroll hint (fade out after first scroll) */}
          {sp < 0.04 && <ScrollHint />}

          {/* Scroll progress bar (top) */}
          <div className="absolute top-0 left-0 h-[2px] pointer-events-none z-30" style={{
            width: `${sp * 100}%`,
            background: `linear-gradient(90deg, #8357F6, ${glowCol}, #AF8AE6)`,
            boxShadow: `0 0 12px ${glowCol}`,
            transition: 'width 0.1s ease-out',
          }} />

        </div>
      </div>
    </div>
  )
}
