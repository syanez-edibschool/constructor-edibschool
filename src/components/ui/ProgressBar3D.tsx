import { motion } from 'framer-motion'

interface Props {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  className?: string
}

export default function ProgressBar3D({ value, max = 100, label, showPercent = true, className = '' }: Props) {
  const pct = Math.round((value / max) * 100)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-xs text-white/50">
          {label && <span>{label}</span>}
          {showPercent && <span className="text-cyan font-semibold">{pct}%</span>}
        </div>
      )}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full progress-bar"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
