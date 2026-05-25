import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const variants = {
  primary: 'btn-primary rounded-xl text-white font-bold tracking-widest uppercase',
  secondary: 'btn-secondary rounded-xl font-semibold',
  ghost: 'bg-transparent border border-transparent hover:border-cyan/30 text-white/70 hover:text-white rounded-xl font-medium transition-all duration-200',
  danger: 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-xl font-semibold transition-all duration-200',
}

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
}

export default function Button3D({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        flex items-center justify-center gap-2 transition-all duration-300
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Cargando...</span>
        </>
      ) : children}
    </motion.button>
  )
}
