import { motion } from 'framer-motion'
import { BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/outline'

interface EmptyStateProps { onNew: () => void }

export default function EmptyState({ onNew }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ textAlign: 'center', padding: 'var(--sp-2xl) 0 var(--sp-2xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-lg)' }}
    >
      {/* Illustration */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 88, height: 88, borderRadius: 28,
          background: 'linear-gradient(135deg,rgba(0,217,255,.12),rgba(139,92,246,.12))',
          border: '1px solid rgba(0,217,255,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <BuildingOffice2Icon style={{ width: 40, height: 40, color: 'var(--accent)' }} />
      </motion.div>

      <div>
        <h3 style={{ color: 'var(--text)', marginBottom: 8, fontSize: 'var(--fs-xl)' }}>
          Sin proyectos todavía
        </h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', maxWidth: 320, lineHeight: 1.6 }}>
          Crea tu primera agencia de IA y empieza a generar prompts, scripts y estrategias en minutos.
        </p>
      </div>

      <motion.button
        onClick={onNew}
        whileHover={{ y: -2, boxShadow: '0 10px 30px rgba(0,217,255,.4)' }}
        whileTap={{ scale: 0.97 }}
        className="btn-primary"
        style={{ padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <PlusIcon style={{ width: 18, height: 18 }} />
        Crear primer proyecto
      </motion.button>
    </motion.div>
  )
}
