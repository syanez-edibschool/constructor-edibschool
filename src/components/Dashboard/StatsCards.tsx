import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FolderIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

function useCounter(target: number) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (prevTarget.current !== target) { done.current = false; prevTarget.current = target }
  }, [target])

  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true
        const start = Date.now(), dur = 1200
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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 72, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ')
  const area = `${pts} ${w},${h} 0,${h}`
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      {/* Last dot */}
      <circle cx={(data.length - 1) / (data.length - 1) * w} cy={h - (data[data.length - 1] / max) * (h - 4) - 2} r={2.5} fill={color} />
    </svg>
  )
}

const SPARKS = [
  [1, 3, 2, 4, 3, 5, 4, 6],
  [2, 2, 3, 2, 4, 3, 5, 4],
  [0, 1, 1, 2, 1, 3, 2, 4],
]

function StatCard({ label, value, change, Icon, color, spark }: {
  label: string; value: number; change?: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string; spark: number[]
}) {
  const { val, ref } = useCounter(value)
  const isPositive = !change || change.startsWith('+')

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: `0 8px 28px var(--shadow), 0 0 24px ${color}18` }}
      transition={{ duration: 0.35 }}
      role="status"
      aria-label={`${label}: ${val}`}
      style={{
        background: 'var(--card-bg)',
        border: `1px solid ${color}28`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-sm)',
        transition: 'box-shadow 0.25s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color }} aria-hidden="true" />
        </div>
        <Sparkline data={spark} color={color} />
      </div>

      {/* Value */}
      <div style={{ fontWeight: 800, fontSize: 'var(--fs-2xl)', color, lineHeight: 1 }}>{val}</div>

      {/* Label + change */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)', letterSpacing: '0.04em' }}>{label}</p>
        {change && (
          <span style={{ fontSize: 11, fontWeight: 600, color: isPositive ? '#10B981' : '#EF4444', background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 999 }}>
            {change}
          </span>
        )}
      </div>
    </motion.div>
  )
}

interface StatsCardsProps {
  total: number
  active: number
  completed: number
}

export default function StatsCards({ total, active, completed }: StatsCardsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-md)' }}>
      <StatCard label="Total proyectos" value={total}     Icon={FolderIcon}       color="#00D9FF" spark={SPARKS[0]} change={total > 0 ? `+${total}` : undefined} />
      <StatCard label="En progreso"     value={active}    Icon={BoltIcon}         color="#F59E0B" spark={SPARKS[1]} />
      <StatCard label="Completados"     value={completed} Icon={CheckCircleIcon}  color="#10B981" spark={SPARKS[2]} />
    </div>
  )
}
