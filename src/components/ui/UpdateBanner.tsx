import { useEffect, useState, useCallback, useRef } from 'react'

const STORAGE_KEY = 'mkt_app_build'
const POLL_INTERVAL = 3 * 60 * 1000

async function fetchRemoteBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.build ?? null
  } catch {
    return null
  }
}

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false)
  const remoteBuild = useRef<string | null>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const shortcut = isMac ? '⌘ + Shift + R' : 'Ctrl + Shift + R'

  const check = useCallback(async () => {
    const remote = await fetchRemoteBuild()
    if (!remote) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      // Primera visita: guardar silenciosamente
      localStorage.setItem(STORAGE_KEY, remote)
    } else if (stored !== remote) {
      remoteBuild.current = remote
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    check()
    const id = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [check])

  const handleUpdate = () => {
    if (remoteBuild.current) localStorage.setItem(STORAGE_KEY, remoteBuild.current)
    window.location.reload()
  }

  const handleDismiss = () => {
    if (remoteBuild.current) localStorage.setItem(STORAGE_KEY, remoteBuild.current)
    setVisible(false)
  }

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
        maxWidth: 500,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>🚀</span>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          Nueva versión disponible
        </p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
          o presiona <kbd style={{ background: 'rgba(0,217,255,0.12)', border: '1px solid rgba(0,217,255,0.3)', borderRadius: 5, padding: '1px 5px', color: '#00D9FF', fontFamily: 'monospace', fontSize: 10 }}>{shortcut}</kbd>
        </p>
      </div>
      <button
        onClick={handleUpdate}
        style={{
          background: 'rgba(0,217,255,0.15)',
          border: '1px solid rgba(0,217,255,0.4)',
          borderRadius: 8,
          color: '#00D9FF',
          fontSize: 12,
          fontWeight: 600,
          padding: '7px 14px',
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Actualizar
      </button>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
