import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Tab {
  id: string
  label: string
  icon?: string
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  children?: ReactNode
}

export default function Tab3D({ tabs, active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/4 border border-white/8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            relative flex-1 flex items-center justify-center gap-2
            px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200
            ${active === tab.id ? 'text-white' : 'text-white/40 hover:text-white/70'}
          `}
        >
          {active === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(0,217,255,0.15) 0%, rgba(139,92,246,0.15) 100%)',
                border: '1px solid rgba(0,217,255,0.3)',
              }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">
            {tab.icon && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}
