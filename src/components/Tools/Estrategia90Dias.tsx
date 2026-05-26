import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowPathIcon, TrophyIcon, FireIcon, RocketLaunchIcon, ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

// ─── Types (matchea el JSON del backend api/tools.ts → estrategia) ────────────
export interface StrategyDay {
  day: string         // "Lunes" .. "Domingo"
  hours: string       // "4-6h"
  tasks: string[]
}
export interface StrategyWeek {
  week: number
  title: string
  focus: string
  days?: StrategyDay[]      // solo en mes 1
  tasks?: string[]          // mes 2 y 3
  key_days?: string[]       // mes 2 (días críticos)
}
export interface StrategyMonth {
  month: number
  title: string
  summary?: string
  goals: string[]
  kpis: string[]
  weeks: StrategyWeek[]
}

interface Props {
  projectId: string
  months: StrategyMonth[]
  updatedAt?: string
  onRegenerate: () => void
}

const MONTH_COLORS = ['#00D9FF', '#8B5CF6', '#10B981']
const MONTH_ICONS  = [FireIcon, RocketLaunchIcon, ChartBarIcon]

// ─── Component ────────────────────────────────────────────────────────────────
export default function Estrategia90Dias({ projectId, months, updatedAt, onRegenerate }: Props) {
  const [activeMonth, setActiveMonth] = useState(0)
  const [activeWeek, setActiveWeek]   = useState(0)
  const [completed, setCompleted]     = useState<Set<string>>(new Set())

  const storageKey = `estrategia_done_${projectId}`

  // Cargar checkboxes de localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setCompleted(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [storageKey])

  const saveCompleted = (next: Set<string>) => {
    setCompleted(next)
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
  }

  const toggle = (id: string) => {
    const next = new Set(completed)
    if (next.has(id)) next.delete(id); else next.add(id)
    saveCompleted(next)
  }

  // Estadísticas globales
  const stats = useMemo(() => {
    let total = 0
    let done  = 0
    months.forEach((m, mi) => {
      m.weeks?.forEach((w, wi) => {
        if (w.days) {
          w.days.forEach((d, di) => {
            d.tasks?.forEach((_, ti) => {
              total++
              if (completed.has(`m${mi}_w${wi}_d${di}_t${ti}`)) done++
            })
          })
        }
        if (w.tasks) {
          w.tasks.forEach((_, ti) => {
            total++
            if (completed.has(`m${mi}_w${wi}_t${ti}`)) done++
          })
        }
      })
    })
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [months, completed])

  if (!months || months.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <p style={{ fontSize: 14 }}>No hay estrategia generada todavía.</p>
      </div>
    )
  }

  const month = months[activeMonth]
  const week  = month?.weeks?.[activeWeek]
  const MonthIcon = MONTH_ICONS[activeMonth] || ChartBarIcon
  const monthColor = MONTH_COLORS[activeMonth] || 'var(--accent)'

  return (
    <div>
      {/* ── HEADER: progreso global + regenerar ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            Estrategia 90 Días
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {stats.done}/{stats.total} acciones · {stats.pct}% completado
            {updatedAt && <span style={{ marginLeft: 10, opacity: 0.6 }}>· {new Date(updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
          </p>
        </div>
        <button onClick={onRegenerate} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--text-2)', cursor: 'pointer',
        }}>
          <ArrowPathIcon style={{ width: 14, height: 14 }} />
          Regenerar
        </button>
      </div>

      {/* ── BARRA DE PROGRESO ────────────────────────────────────────────── */}
      <div style={{ height: 6, borderRadius: 999, background: 'var(--card-bg)', overflow: 'hidden', marginBottom: 22 }}>
        <motion.div
          animate={{ width: `${stats.pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${MONTH_COLORS[0]}, ${MONTH_COLORS[1]}, ${MONTH_COLORS[2]})` }}
        />
      </div>

      {/* ── TABS DE MESES ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
        {months.map((m, mi) => {
          const Icon = MONTH_ICONS[mi] || ChartBarIcon
          const color = MONTH_COLORS[mi] || 'var(--accent)'
          const isActive = activeMonth === mi
          // contar tareas hechas del mes
          let mDone = 0, mTotal = 0
          m.weeks?.forEach((w, wi) => {
            if (w.days) w.days.forEach((d, di) => d.tasks?.forEach((_, ti) => { mTotal++; if (completed.has(`m${mi}_w${wi}_d${di}_t${ti}`)) mDone++ }))
            if (w.tasks) w.tasks.forEach((_, ti) => { mTotal++; if (completed.has(`m${mi}_w${wi}_t${ti}`)) mDone++ })
          })
          return (
            <button
              key={mi}
              onClick={() => { setActiveMonth(mi); setActiveWeek(0) }}
              style={{
                flex: '1 1 0', minWidth: 180, padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                background: isActive ? `${color}15` : 'var(--surface)',
                border: `1px solid ${isActive ? color + '50' : 'var(--border)'}`,
                textAlign: 'left', transition: 'all .15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Icon style={{ width: 18, height: 18, color: isActive ? color : 'var(--text-3)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? color : 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  MES {m.month}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                  {mDone}/{mTotal}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>
                {m.title}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── CARD DEL MES ACTIVO (resumen + goals + kpis) ─────────────────── */}
      {month && (
        <motion.div
          key={`m-${activeMonth}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '16px 18px', borderRadius: 14,
            background: `${monthColor}08`, border: `1px solid ${monthColor}25`,
            marginBottom: 18,
          }}>
          {month.summary && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 14 }}>
              {month.summary}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: monthColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Objetivos</p>
              {month.goals?.map((g, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.4 }}>
                  <span style={{ color: monthColor, marginRight: 6 }}>›</span>{g}
                </p>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: monthColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>KPIs</p>
              {month.kpis?.map((k, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.4 }}>
                  <span style={{ color: monthColor, marginRight: 6 }}>›</span>{k}
                </p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TABS DE SEMANAS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {month?.weeks?.map((w, wi) => {
          const isActive = activeWeek === wi
          let wDone = 0, wTotal = 0
          if (w.days) w.days.forEach((d, di) => d.tasks?.forEach((_, ti) => { wTotal++; if (completed.has(`m${activeMonth}_w${wi}_d${di}_t${ti}`)) wDone++ }))
          if (w.tasks) w.tasks.forEach((_, ti) => { wTotal++; if (completed.has(`m${activeMonth}_w${wi}_t${ti}`)) wDone++ })
          const allDone = wTotal > 0 && wDone === wTotal
          return (
            <button
              key={wi}
              onClick={() => setActiveWeek(wi)}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? `${monthColor}18` : 'var(--surface)',
                border: `1px solid ${isActive ? monthColor + '50' : 'var(--border)'}`,
                color: isActive ? monthColor : 'var(--text-2)',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              SEM {w.week}
              <span style={{ fontSize: 10, opacity: 0.8 }}>{wDone}/{wTotal}</span>
              {allDone && <CheckCircleIcon style={{ width: 12, height: 12, color: '#10B981' }} />}
            </button>
          )
        })}
      </div>

      {/* ── CONTENIDO DE LA SEMANA ACTIVA ─────────────────────────────────── */}
      {week && (
        <motion.div
          key={`w-${activeMonth}-${activeWeek}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ paddingBottom: 30 }}>

          {/* Título + focus de la semana */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Semana {week.week}: {week.title}
            </h3>
            {week.focus && (
              <p style={{ fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic' }}>
                {week.focus}
              </p>
            )}
          </div>

          {/* MES 1: vista por día */}
          {week.days && week.days.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {week.days.map((d, di) => {
                const dayTasksDone = d.tasks?.filter((_, ti) => completed.has(`m${activeMonth}_w${activeWeek}_d${di}_t${ti}`)).length || 0
                const dayTotal = d.tasks?.length || 0
                const dayAllDone = dayTotal > 0 && dayTasksDone === dayTotal
                return (
                  <div key={di} style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: 'var(--surface)',
                    border: `1px solid ${dayAllDone ? '#10B98140' : 'var(--border)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{d.day}</p>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>{d.hours}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {d.tasks?.map((t, ti) => {
                        const id = `m${activeMonth}_w${activeWeek}_d${di}_t${ti}`
                        const done = completed.has(id)
                        return (
                          <div key={ti} onClick={() => toggle(id)}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', opacity: done ? 0.5 : 1 }}>
                            <div style={{
                              width: 16, height: 16, borderRadius: 5, marginTop: 1, flexShrink: 0,
                              background: done ? '#10B981' : 'transparent',
                              border: `1.5px solid ${done ? '#10B981' : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <p style={{ fontSize: 12, color: done ? 'var(--text-3)' : 'var(--text-2)', lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none' }}>
                              {t}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* MES 2 y 3: vista por tareas */}
          {!week.days && week.tasks && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {week.key_days && week.key_days.length > 0 && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 6,
                  background: `${monthColor}10`, border: `1px solid ${monthColor}25`,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: monthColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Días críticos
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {week.key_days.join(' · ')}
                  </p>
                </div>
              )}
              {week.tasks.map((t, ti) => {
                const id = `m${activeMonth}_w${activeWeek}_t${ti}`
                const done = completed.has(id)
                return (
                  <div key={ti} onClick={() => toggle(id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                      borderRadius: 11, cursor: 'pointer',
                      background: 'var(--surface)',
                      border: `1px solid ${done ? 'var(--border)' : monthColor + '20'}`,
                      opacity: done ? 0.55 : 1,
                    }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, marginTop: 1, flexShrink: 0,
                      background: done ? '#10B981' : 'transparent',
                      border: `2px solid ${done ? '#10B981' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <p style={{ flex: 1, fontSize: 13, color: done ? 'var(--text-3)' : 'var(--text)', lineHeight: 1.5, textDecoration: done ? 'line-through' : 'none' }}>
                      {t}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Mensaje cuando completa la semana */}
          {(() => {
            let wDone = 0, wTotal = 0
            if (week.days) week.days.forEach((d, di) => d.tasks?.forEach((_, ti) => { wTotal++; if (completed.has(`m${activeMonth}_w${activeWeek}_d${di}_t${ti}`)) wDone++ }))
            if (week.tasks) week.tasks.forEach((_, ti) => { wTotal++; if (completed.has(`m${activeMonth}_w${activeWeek}_t${ti}`)) wDone++ })
            const allDone = wTotal > 0 && wDone === wTotal
            if (!allDone) return null
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  marginTop: 18, padding: '14px 18px', borderRadius: 12,
                  background: '#10B98115', border: '1px solid #10B98130',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <TrophyIcon style={{ width: 20, height: 20, color: '#10B981', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>
                    Semana {week.week} completada
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {activeWeek < (month.weeks.length - 1)
                      ? `Sigue con la Semana ${month.weeks[activeWeek + 1].week}: ${month.weeks[activeWeek + 1].title}`
                      : activeMonth < (months.length - 1)
                        ? `Pasa al Mes ${months[activeMonth + 1].month}: ${months[activeMonth + 1].title}`
                        : '¡90 días completados!'}
                  </p>
                </div>
              </motion.div>
            )
          })()}
        </motion.div>
      )}
    </div>
  )
}
