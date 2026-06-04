import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PlusIcon, TrashIcon, ArrowDownTrayIcon, BanknotesIcon, ArrowTrendingDownIcon, Cog6ToothIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../services/supabase'

interface LineItem { id: number; descripcion: string; monto: number }
interface OtrosData { impuestos: number; ahorros: number; reinversion: number }
interface HistorialRow {
  mes: string
  totalIngresos: number
  totalEgresos: number
  profit: number
  margen: string
}
type MonthData = { ingresos: LineItem[]; egresos: LineItem[]; otros: OtrosData }

function sum(items: LineItem[]) {
  return (items || []).reduce((a, b) => a + (b.monto || 0), 0)
}

function fmt(v: number) {
  return '$' + v.toLocaleString('es-ES', { maximumFractionDigits: 0 })
}

const DEFAULT_INGRESOS: LineItem[] = [
  { id: 1, descripcion: 'Servicios', monto: 0 },
  { id: 2, descripcion: 'Otros', monto: 0 },
]
const DEFAULT_EGRESOS: LineItem[] = [
  { id: 1, descripcion: 'Software', monto: 0 },
  { id: 2, descripcion: 'Hosting', monto: 0 },
  { id: 3, descripcion: 'Marketing', monto: 0 },
]
const DEFAULT_OTROS: OtrosData = { impuestos: 0, ahorros: 10, reinversion: 20 }

function downloadTxt(ingresos: LineItem[], egresos: LineItem[], otros: OtrosData, mes: string) {
  const totalI = sum(ingresos)
  const totalE = sum(egresos)
  const profit = totalI - totalE
  const margen = totalI > 0 ? ((profit / totalI) * 100).toFixed(2) : '0'
  const lines = [
    `TRACKER FINANCIERO — ${mes}`,
    '',
    '── INGRESOS ──',
    ...ingresos.map(i => `  ${i.descripcion}: ${fmt(i.monto)}`),
    `TOTAL INGRESOS: ${fmt(totalI)}`,
    '',
    '── EGRESOS ──',
    ...egresos.map(e => `  ${e.descripcion}: ${fmt(e.monto)}`),
    `TOTAL EGRESOS: ${fmt(totalE)}`,
    '',
    '── RESULTADO ──',
    `PROFIT: ${fmt(profit)}`,
    `MARGEN: ${margen}%`,
    `Impuestos: ${fmt(otros.impuestos)}`,
    `Ahorros (${otros.ahorros}%): ${fmt(profit * otros.ahorros / 100)}`,
    `Reinversión (${otros.reinversion}%): ${fmt(profit * otros.reinversion / 100)}`,
  ]
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' })),
    download: `tracker-${mes}.txt`,
  })
  a.click()
}

interface TrackerFinancieroProps {
  projectId: string
}

export default function TrackerFinanciero({ projectId }: TrackerFinancieroProps) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [ingresos, setIngresos] = useState<LineItem[]>(DEFAULT_INGRESOS)
  const [egresos, setEgresos] = useState<LineItem[]>(DEFAULT_EGRESOS)
  const [otros, setOtros] = useState<OtrosData>(DEFAULT_OTROS)
  // Datos de TODOS los meses (cada mes su propio set). Aísla por mes.
  const [months, setMonths] = useState<Record<string, MonthData>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Carga inicial: trae todos los meses (con migración del formato viejo) ──
  useEffect(() => {
    let cancel = false
    async function load() {
      const { data } = await supabase
        .from('project_tools')
        .select('result_json')
        .eq('project_id', projectId)
        .eq('tool_id', 'tracker')
        .maybeSingle()
      if (cancel) return
      const d = (data?.result_json as Record<string, unknown>) || {}
      let loadedMonths: Record<string, MonthData> = {}
      if (d.months && typeof d.months === 'object') {
        loadedMonths = d.months as Record<string, MonthData>
      } else if (Array.isArray(d.ingresos) || Array.isArray(d.egresos)) {
        // Formato viejo (un solo set global): lo migramos al mes actual.
        loadedMonths = {
          [mes]: {
            ingresos: (d.ingresos as LineItem[]) || DEFAULT_INGRESOS,
            egresos: (d.egresos as LineItem[]) || DEFAULT_EGRESOS,
            otros: (d.otros as OtrosData) || DEFAULT_OTROS,
          },
        }
      }
      setMonths(loadedMonths)
      const cur = loadedMonths[mes]
      if (cur) {
        setIngresos(cur.ingresos?.length ? cur.ingresos : DEFAULT_INGRESOS)
        setEgresos(cur.egresos?.length ? cur.egresos : DEFAULT_EGRESOS)
        setOtros(cur.otros || DEFAULT_OTROS)
      }
      setLoaded(true)
    }
    load()
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── Persistir (auto-guardado y guardado manual) ──
  const persist = async (showFlag = false) => {
    const merged = { ...months, [mes]: { ingresos, egresos, otros } }
    setMonths(merged)
    if (showFlag) setSaving(true)
    await supabase.from('project_tools').upsert(
      { project_id: projectId, tool_id: 'tracker', result_json: { months: merged } as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'project_id,tool_id' },
    )
    if (showFlag) {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  // Auto-guardado: 1s después del último cambio (evita perder datos al recargar).
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => { void persist() }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingresos, egresos, otros, mes, loaded])

  // Cambiar de mes: guarda el actual en memoria y carga los datos del nuevo mes.
  const changeMonth = (newMes: string) => {
    setMonths(prev => ({ ...prev, [mes]: { ingresos, egresos, otros } }))
    const target = months[newMes]
    setIngresos(target?.ingresos?.length ? target.ingresos : DEFAULT_INGRESOS)
    setEgresos(target?.egresos?.length ? target.egresos : DEFAULT_EGRESOS)
    setOtros(target?.otros || DEFAULT_OTROS)
    setMes(newMes)
  }

  const handleSave = () => persist(true)

  const totalIngresos = sum(ingresos)
  const totalEgresos  = sum(egresos)
  const profit        = totalIngresos - totalEgresos
  const margen        = totalIngresos > 0 ? ((profit / totalIngresos) * 100).toFixed(2) : '0'

  const updateIngreso = (idx: number, field: 'descripcion' | 'monto', value: string | number) =>
    setIngresos(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  const updateEgreso  = (idx: number, field: 'descripcion' | 'monto', value: string | number) =>
    setEgresos(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))

  const ahorrosAmt    = profit * otros.ahorros / 100
  const reinversionAmt = profit * otros.reinversion / 100

  // Historial = resumen de cada mes guardado (incluye el actual en vivo).
  const historialRows: HistorialRow[] = Object.entries({ ...months, [mes]: { ingresos, egresos, otros } })
    .map(([m, md]) => {
      const ti = sum(md.ingresos), te = sum(md.egresos)
      const p = ti - te
      return { mes: m, totalIngresos: ti, totalEgresos: te, profit: p, margen: ti > 0 ? ((p / ti) * 100).toFixed(2) : '0' }
    })
    .filter(r => r.totalIngresos > 0 || r.totalEgresos > 0)
    .sort((a, b) => a.mes.localeCompare(b.mes))

  const summaryCards = [
    { label: 'Ingresos', value: fmt(totalIngresos), color: '#10B981' },
    { label: 'Egresos',  value: fmt(totalEgresos),  color: '#EF4444' },
    { label: 'Profit',   value: fmt(profit),         color: '#00D9FF' },
    { label: 'Margen',   value: `${margen}%`,        color: '#8B5CF6' },
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Tracker Financiero</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Registra ingresos y gastos mensualmente · se guarda solo</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="month"
            value={mes}
            onChange={e => changeMonth(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
          />
          <button
            onClick={() => downloadTxt(ingresos, egresos, otros, mes)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, borderRadius: 10 }}
          >
            <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> Exportar
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 20 }}>
        {summaryCards.map(c => (
          <div key={c.label} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-bg)', border: `1px solid ${c.color}25` }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>{c.label}</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Ingresos */}
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '12px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BanknotesIcon style={{ width: 15, height: 15, color: '#10B981' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#10B981' }}>INGRESOS</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#10B981' }}>{fmt(totalIngresos)}</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {ingresos.map((item, idx) => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                value={item.descripcion}
                onChange={e => updateIngreso(idx, 'descripcion', e.target.value)}
                placeholder="Descripción"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#10B981'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
              />
              <input
                type="number"
                value={item.monto || ''}
                onChange={e => updateIngreso(idx, 'monto', parseFloat(e.target.value) || 0)}
                placeholder="0"
                style={{ width: 110, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: '#10B981', fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'right' }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#10B981'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
              />
              <button onClick={() => setIngresos(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, opacity: 0.6, transition: 'opacity .12s' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}>
                <TrashIcon style={{ width: 15, height: 15 }} />
              </button>
            </motion.div>
          ))}
          <button
            onClick={() => setIngresos(p => [...p, { id: Date.now(), descripcion: '', monto: 0 }])}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#10B981', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4, opacity: 0.8 }}
          >
            <PlusIcon style={{ width: 14, height: 14 }} /> Agregar ingreso
          </button>
        </div>
      </div>

      {/* Egresos */}
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '12px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowTrendingDownIcon style={{ width: 15, height: 15, color: '#EF4444' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#EF4444' }}>EGRESOS</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{fmt(totalEgresos)}</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {egresos.map((item, idx) => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                value={item.descripcion}
                onChange={e => updateEgreso(idx, 'descripcion', e.target.value)}
                placeholder="Descripción"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#EF4444'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
              />
              <input
                type="number"
                value={item.monto || ''}
                onChange={e => updateEgreso(idx, 'monto', parseFloat(e.target.value) || 0)}
                placeholder="0"
                style={{ width: 110, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: '#EF4444', fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'right' }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#EF4444'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
              />
              <button onClick={() => setEgresos(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, opacity: 0.6, transition: 'opacity .12s' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}>
                <TrashIcon style={{ width: 15, height: 15 }} />
              </button>
            </motion.div>
          ))}
          <button
            onClick={() => setEgresos(p => [...p, { id: Date.now(), descripcion: '', monto: 0 }])}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4, opacity: 0.8 }}
          >
            <PlusIcon style={{ width: 14, height: 14 }} /> Agregar egreso
          </button>
        </div>
      </div>

      {/* Otros */}
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cog6ToothIcon style={{ width: 14, height: 14, color: 'var(--text-3)' }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>Distribución del Profit</span>
          </div>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Impuestos ($)',           key: 'impuestos' as const, isFixed: true,  note: fmt(otros.impuestos) },
            { label: 'Ahorros (% del profit)',  key: 'ahorros'    as const, isFixed: false, note: fmt(ahorrosAmt) },
            { label: 'Reinversión (% profit)',  key: 'reinversion' as const, isFixed: false, note: fmt(reinversionAmt) },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{f.label}</label>
              <input
                type="number"
                value={otros[f.key] || ''}
                onChange={e => setOtros(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, textAlign: 'right', outline: 'none' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)', width: 70, textAlign: 'right' }}>{f.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <motion.button
        onClick={handleSave}
        disabled={saving}
        whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,217,255,.3)' }}
        whileTap={{ scale: .97 }}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 12,
          background: saved ? '#10B981' : 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
          border: 'none', cursor: saving ? 'wait' : 'pointer',
          fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 24,
          transition: 'background .3s',
        }}
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : `Guardar ${mes}`}
      </motion.button>

      {/* Historial */}
      {historialRows.length > 0 && (
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChartBarIcon style={{ width: 14, height: 14, color: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Historial</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Mes', 'Ingresos', 'Egresos', 'Profit', 'Margen'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Mes' ? 'left' : 'right', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...historialRows].reverse().map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: row.mes === mes ? 'var(--accent-d)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text)' }}>{row.mes}</td>
                    <td style={{ padding: '9px 12px', color: '#10B981', fontWeight: 600, textAlign: 'right' }}>{fmt(row.totalIngresos)}</td>
                    <td style={{ padding: '9px 12px', color: '#EF4444', fontWeight: 600, textAlign: 'right' }}>{fmt(row.totalEgresos)}</td>
                    <td style={{ padding: '9px 12px', color: '#00D9FF', fontWeight: 600, textAlign: 'right' }}>{fmt(row.profit)}</td>
                    <td style={{ padding: '9px 12px', color: '#8B5CF6', fontWeight: 700, textAlign: 'right' }}>{row.margen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
