import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  opacity: number
  color: string
  baseY: number
  floatOffset: number
  floatSpeed: number
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Particle[] = []
    const COLORS = ['rgba(0,217,255', 'rgba(139,92,246', 'rgba(236,72,153']

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 30; i++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const y = Math.random() * window.innerHeight
      particles.push({
        x: Math.random() * window.innerWidth,
        y,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0,
        r: Math.random() * 3 + 1,
        opacity: Math.random() * 0.25 + 0.05,
        color,
        floatOffset: Math.random() * Math.PI * 2,
        floatSpeed: Math.random() * 0.003 + 0.001,
      })
    }

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 1

      for (const p of particles) {
        p.x += p.vx
        p.y = p.baseY + Math.sin(t * p.floatSpeed + p.floatOffset) * 30

        if (p.x < -10) p.x = canvas.width + 10
        if (p.x > canvas.width + 10) p.x = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color},${p.opacity})`
        ctx.fill()

        // glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3)
        grad.addColorStop(0, `${p.color},${p.opacity * 0.5})`)
        grad.addColorStop(1, `${p.color},0)`)
        ctx.fillStyle = grad
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  )
}
