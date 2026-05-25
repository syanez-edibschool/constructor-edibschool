import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface Props extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  glow?: boolean
  delay?: number
}

export default function Card3D({ children, glow = false, delay = 0, className = '', ...props }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        glass-card rounded-2xl p-6
        ${glow ? 'hover:shadow-neon-cyan' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  )
}
