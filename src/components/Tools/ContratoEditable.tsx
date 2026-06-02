import { useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowDownTrayIcon, CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../services/supabase'
import { exportToPDF, exportToWord } from '../../services/exportContent'

// Contrato editable tipo Word: el usuario coloca sus propios datos y guarda.
// Persiste en project_tools (tool_id='contrato'), igual que el resto de herramientas.
export default function ContratoEditable({ projectId, initialContent }: { projectId: string; initialContent: string }) {
  const [text, setText] = useState(initialContent || '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('project_tools').upsert({
        project_id: projectId,
        tool_id: 'contrato',
        result_json: { content: text },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,tool_id' })
      if (error) throw error
      setSavedAt(new Date().toISOString())
      toast.success('Contrato guardado')
    } catch {
      toast.error('No se pudo guardar el contrato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-d)', border: '1px solid var(--border-h)' }}>
        <PencilSquareIcon style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0 }} />
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Edita el contrato directamente aquí: coloca tus datos (nombre, empresa, NIF, importes, fechas…) y pulsa <strong>Guardar</strong>.
        </p>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck
        style={{
          width: '100%', minHeight: '55vh', resize: 'vertical',
          padding: '20px 22px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 14, lineHeight: 1.8,
          fontFamily: 'Georgia, "Times New Roman", serif', outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13, borderRadius: 10, fontWeight: 600 }}
        >
          {saving
            ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            : <CheckIcon style={{ width: 15, height: 15 }} />}
          {saving ? 'Guardando…' : 'Guardar contrato'}
        </button>
        <button onClick={() => { navigator.clipboard.writeText(text); toast.success('Copiado') }} className="btn-secondary" style={{ padding: '10px 16px', fontSize: 13, borderRadius: 10 }}>Copiar</button>
        <button onClick={() => exportToPDF('Contrato', text)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, borderRadius: 10 }}><ArrowDownTrayIcon style={{ width: 15 }} /> PDF</button>
        <button onClick={() => exportToWord('Contrato', text)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, borderRadius: 10 }}><ArrowDownTrayIcon style={{ width: 15 }} /> Word</button>
        {savedAt && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10B981', marginLeft: 'auto' }}>
            <CheckIcon style={{ width: 13 }} /> Guardado {new Date(savedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}
