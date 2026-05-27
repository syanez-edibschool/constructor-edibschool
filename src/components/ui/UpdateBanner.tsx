import { useEffect, useState } from 'react'

declare const __APP_BUILD__: string

const STORAGE_KEY = 'mkt_app_build'

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const shortcut = isMac ? '⌘ + Shift + R' : 'Ctrl + Shift + R'

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== __APP_BUILD__) {
      if (stored !== null) setVisible(true)
      localStorage.setItem(STORAGE_KEY, __APP_BUILD__)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'rgba(10,10,15,0.96)',
        border: '1px solid rgba(0,217,255,0.35)',
        borderRadius: 14,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,217,255,0.1)',
        backdropFilter: 'blur(20px)',
        minWidth: 320,
        maxWidth: 480,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>🚀</span>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
          Nueva versión disponible
        </p>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
          Presiona <kbd style={{ background: 'rgba(0,217,255,0.15)', border: '1px solid rgba(0,217,255,0.3)', borderRadius: 5, padding: '1px 6px', color: '#00D9FF', fontFamily: 'monospace', fontSize: 11 }}>{shortcut}</kbd> para ver los últimos cambios
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
