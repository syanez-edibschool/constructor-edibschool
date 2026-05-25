import { ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export default function Modal3D({ open, onClose, title, children, maxWidth = 'max-w-lg' }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`w-full ${maxWidth} glass rounded-2xl border border-white/10 shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
                  <h2 className="text-lg font-bold gradient-text">{title}</h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
