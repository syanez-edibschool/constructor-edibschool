import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusIcon, FolderPlusIcon, SparklesIcon } from '@heroicons/react/24/outline'

interface Action { label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; onClick: () => void }

interface QuickActionsProps {
  onNewProject: () => void
}

export default function QuickActions({ onNewProject }: QuickActionsProps) {
  const [open, setOpen] = useState(false)

  const actions: Action[] = [
    { label: 'Nuevo proyecto', Icon: FolderPlusIcon, color: '#00D9FF', onClick: () => { onNewProject(); setOpen(false) } },
    { label: 'Plantillas',     Icon: SparklesIcon,   color: '#8B5CF6', onClick: () => setOpen(false) },
  ]

  return (
    <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 40 }}>
      {/* Backdrop to close */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
          />
        )}
      </AnimatePresence>

      {/* Action items */}
      <AnimatePresence>
        {open && actions.map((action, i) => (
          <motion.div
            key={action.label}
            initial={{ scale: 0, opacity: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, y: -(i + 1) * 60 - 4 }}
            exit={{ scale: 0, opacity: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26, delay: i * 0.04 }}
            style={{ position: 'absolute', bottom: 0, left: 0, display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}
          >
            <motion.button
              onClick={action.onClick}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: action.color, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 16px ${action.color}55`,
                flexShrink: 0,
              }}
            >
              <action.Icon style={{ width: 20, height: 20, color: '#fff' }} />
            </motion.button>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: 'var(--text)',
              background: 'var(--surface-s)',
              padding: '4px 10px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px var(--shadow)',
              border: '1px solid var(--border)',
            }}>
              {action.label}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08, boxShadow: '0 16px 40px rgba(0,217,255,.5), 0 0 50px rgba(139,92,246,.3)' }}
        whileTap={{ scale: 0.94 }}
        animate={{
          rotate: open ? 45 : 0,
          boxShadow: open
            ? '0 8px 30px rgba(0,217,255,.5)'
            : ['0 8px 30px rgba(0,217,255,.35)', '0 8px 38px rgba(139,92,246,.5)', '0 8px 30px rgba(0,217,255,.35)'],
        }}
        transition={{ rotate: { duration: 0.2 }, boxShadow: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}
        aria-label="Acciones rápidas"
        aria-expanded={open}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}
      >
        <PlusIcon style={{ width: 26, height: 26, color: '#fff' }} />
      </motion.button>
    </div>
  )
}
