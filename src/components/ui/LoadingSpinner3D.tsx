import { motion } from 'framer-motion'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizes = { sm: 32, md: 56, lg: 80 }

export default function LoadingSpinner3D({ size = 'md', label }: Props) {
  const s = sizes[size]

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: s, height: s }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid transparent`,
            borderTopColor: '#00D9FF',
            borderRightColor: '#8B5CF6',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: 4,
            border: `2px solid transparent`,
            borderTopColor: '#EC4899',
            borderLeftColor: '#00D9FF',
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: '30%',
            background: 'radial-gradient(circle, rgba(0,217,255,0.4) 0%, transparent 70%)',
          }}
        />
      </div>
      {label && (
        <motion.p
          className="text-sm text-white/60 text-center"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {label}
        </motion.p>
      )}
    </div>
  )
}
