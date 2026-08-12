import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ClockIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { getHistory, type HistoryEntry } from '../../services/toolHistory'
import { exportToPDF, exportToWord } from '../../services/exportContent'
import { toText, toList } from '../../lib/aiText'

// Convierte el resultado guardado de cualquier herramienta de contenido en texto legible.
// Los campos van por toText() porque la IA a veces devuelve objetos donde se
// pidió texto; sin eso saldría «[object Object]».
function summarize(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  const c = content as Record<string, unknown>
  if (Array.isArray(c.sequences)) {
    return (c.sequences as Array<Record<string, unknown>>).map(seq =>
      `=== ${toText(seq.name) || 'Secuencia'} ===\n` +
      toList<Record<string, unknown>>(seq.emails).map(e => `Asunto: ${toText(e.subject)}\n${toText(e.body)}`).join('\n\n')
    ).join('\n\n')
  }
  if (Array.isArray(c.sections)) {
    return (c.sections as Array<Record<string, unknown>>).map(s => `[${toText(s.label)}${s.timing ? ` - ${toText(s.timing)}` : ''}]\n${toText(s.content)}`).join('\n\n')
  }
  if (Array.isArray(c.prompts)) {
    return (c.prompts as Array<Record<string, unknown>>).map((p, i) => `${i + 1}. ${toText(p.title || p.concept)}\n${toText(p.prompt || p.text)}`).join('\n\n')
  }
  if (Array.isArray(c.slides)) {
    return (c.slides as Array<Record<string, unknown>>).map(s => `SLIDE ${toText(s.number)}: ${toText(s.title)}\n${toText(s.content)}`).join('\n\n')
  }
  for (const v of Object.values(c)) {
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) return (v as string[]).join('\n\n')
  }
  const strs = Object.values(c).filter(v => typeof v === 'string') as string[]
  if (strs.length) return strs.join('\n\n')
  return JSON.stringify(content, null, 2)
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export default function HistoryPanel({ projectId, toolId, title }: { projectId: string; toolId: string; title: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  useEffect(() => {
    let alive = true
    getHistory(projectId, toolId).then(items => {
      if (!alive) return
      setEntries(items)
      setLoading(false)
    })
    return () => { alive = false }
  }, [projectId, toolId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
        <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Cargando historial...</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
        <ClockIcon style={{ width: 36, height: 36, margin: '0 auto 12px', opacity: 0.5 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>Aún no hay historial</p>
        <p style={{ fontSize: 12 }}>Cada vez que generes contenido aquí, se guardará para que puedas consultarlo.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{entries.length} generación(es) guardada(s)</p>
      {entries.map((entry, i) => {
        const text = summarize(entry.content)
        const isOpen = openIdx === i
        return (
          <div key={i} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                <ClockIcon style={{ width: 15, height: 15, color: 'var(--accent)' }} />
                {i === 0 ? 'Más reciente' : `Versión ${entries.length - i}`}
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>· {fmtDate(entry.created_at)}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => { navigator.clipboard.writeText(text); toast.success('Copiado') }} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8 }}>Copiar</button>
                  <button onClick={() => exportToPDF(`${title} - ${fmtDate(entry.created_at)}`, text)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}><ArrowDownTrayIcon style={{ width: 13 }} /> PDF</button>
                  <button onClick={() => exportToWord(`${title} - ${fmtDate(entry.created_at)}`, text)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}><ArrowDownTrayIcon style={{ width: 13 }} /> Word</button>
                </div>
                <div style={{ maxHeight: '45vh', overflowY: 'auto', background: 'var(--card-bg)', borderRadius: 8, padding: '12px 14px' }}>
                  <pre style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{text}</pre>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
