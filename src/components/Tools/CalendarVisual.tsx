import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowPathIcon, ArrowDownTrayIcon,
  ViewColumnsIcon, FilmIcon, DevicePhoneMobileIcon, PhotoIcon,
  VideoCameraIcon, EnvelopeIcon, SignalIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import DayDetail, { type CalendarDay } from './DayDetail'
import { api } from '../../services/api'

export interface CalendarWeek {
  week: number
  days: CalendarDay[]
}

interface CalendarVisualProps {
  projectId: string
  weeks: CalendarWeek[]
  updatedAt?: string
  onRegenerate: () => void
  onWeeksChange: (weeks: CalendarWeek[]) => void
}

const WEEK_DAYS      = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const WEEK_DAYS_SHORT = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO']

function getCalendarMonday(): Date {
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getCellDate(weekIndex: number, colIndex: number): Date {
  const monday = getCalendarMonday()
  const d = new Date(monday)
  d.setDate(monday.getDate() + weekIndex * 7 + colIndex)
  return d
}

function formatCellDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const TYPE_COLORS: Record<string, string> = {
  Carrusel: '#8B5CF6', Reel: '#EC4899', Story: '#F59E0B',
  Post: '#10B981', Video: '#3B82F6', Email: '#0891b2', Live: '#EF4444',
}

type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>
const TYPE_ICON_MAP: Record<string, IconComp> = {
  Carrusel: ViewColumnsIcon,
  Reel:     FilmIcon,
  Story:    DevicePhoneMobileIcon,
  Post:     PhotoIcon,
  Video:    VideoCameraIcon,
  Email:    EnvelopeIcon,
  Live:     SignalIcon,
}

function TypeIcon({ type, style }: { type: string; style?: React.CSSProperties }) {
  const Icon = TYPE_ICON_MAP[type] || DocumentTextIcon
  return <Icon style={style || { width: 18, height: 18 }} />
}

function getDayIndex(dayName: string): number {
  return WEEK_DAYS.findIndex(d => d.toLowerCase() === dayName.toLowerCase())
}

function downloadCalendar(weeks: CalendarWeek[]) {
  const lines: string[] = ['CALENDARIO DE CONTENIDO — 4 SEMANAS\n']
  for (const w of weeks) {
    lines.push(`\n=== SEMANA ${w.week} ===`)
    for (const d of w.days) {
      lines.push(`\n${d.day} ${d.timing}`)
      lines.push(`Tipo: ${d.type}${d.platform ? ` | ${d.platform}` : ''}`)
      lines.push(`Contenido: ${d.content}`)
      if (d.cta) lines.push(`CTA: ${d.cta}`)
    }
  }
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' })),
    download: 'calendario-contenido.txt',
  })
  a.click()
}

interface SelectedDay { day: CalendarDay; weekIndex: number; dayIndex: number }

const CONTENT_FILTERS: Array<{ key: string; label: string; color: string }> = [
  { key: 'all',      label: 'Todos',      color: 'var(--accent)' },
  { key: 'Reel',     label: 'Reels',      color: '#EC4899'       },
  { key: 'Carrusel', label: 'Carruseles', color: '#8B5CF6'       },
  { key: 'Story',    label: 'Stories',    color: '#F59E0B'       },
  { key: 'Post',     label: 'Posts',      color: '#10B981'       },
  { key: 'Video',    label: 'Video',      color: '#3B82F6'       },
  { key: 'Email',    label: 'Emails',     color: '#0891b2'       },
]

export default function CalendarVisual({ projectId, weeks: initialWeeks, updatedAt, onRegenerate, onWeeksChange }: CalendarVisualProps) {
  const [weeks, setWeeks]         = useState<CalendarWeek[]>(initialWeeks)
  const [selected, setSelected]   = useState<SelectedDay | null>(null)
  const [contentFilter, setContentFilter] = useState<string>('all')

  const handleSave = async (weekIndex: number, dayIndex: number, updates: Partial<CalendarDay>) => {
    await api.patch(`/projects/${projectId}/tools/calendario/update-day`, { weekIndex, dayIndex, updates })
    setWeeks(prev => {
      const next = prev.map((w, wi) => wi !== weekIndex ? w : {
        ...w,
        days: w.days.map((d, di) => di !== dayIndex ? d : { ...d, ...updates }),
      })
      onWeeksChange(next)
      return next
    })
    if (selected) setSelected(s => s ? { ...s, day: { ...s.day, ...updates } } : s)
  }

  const handleDelete = async (weekIndex: number, dayIndex: number) => {
    await api.delete(`/projects/${projectId}/tools/calendario/day`, { data: { weekIndex, dayIndex } })
    setWeeks(prev => {
      const next = prev.map((w, wi) => wi !== weekIndex ? w : {
        ...w,
        days: w.days.filter((_, di) => di !== dayIndex),
      })
      onWeeksChange(next)
      return next
    })
  }

  const totalPosts = weeks.reduce((s, w) => s + w.days.length, 0)
  const filteredTotal = contentFilter === 'all'
    ? totalPosts
    : weeks.reduce((s, w) => s + w.days.filter(d => d.type === contentFilter).length, 0)

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
            Calendario de Contenido
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {contentFilter === 'all' ? totalPosts : filteredTotal} publicaciones · 4 semanas
            {contentFilter !== 'all' && ` · filtrado: ${contentFilter}`}
            {updatedAt && ` · Actualizado ${new Date(updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => downloadCalendar(weeks)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
          >
            <ArrowDownTrayIcon style={{ width: 15, height: 15 }} />
            Descargar
          </button>
          <button
            onClick={onRegenerate}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
          >
            <ArrowPathIcon style={{ width: 15, height: 15 }} />
            Regenerar
          </button>
        </div>
      </div>

      {/* Content type filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>Filtrar:</span>
        {CONTENT_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setContentFilter(f.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${contentFilter === f.key ? f.color + '60' : 'var(--border)'}`,
              background: contentFilter === f.key ? f.color + '18' : 'transparent',
              color: contentFilter === f.key ? f.color : 'var(--text-3)',
              transition: 'all .12s',
            }}
          >
            {f.key !== 'all' && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* All 4 weeks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {weeks.map((week, wi) => {
          const dayMap: Record<number, { day: CalendarDay; idx: number }> = {}
          week.days.forEach((d, idx) => {
            const col = getDayIndex(d.day)
            if (col >= 0) dayMap[col] = { day: d, idx }
          })

          const visibleCount = contentFilter === 'all'
            ? week.days.length
            : week.days.filter(d => d.type === contentFilter).length

          return (
            <motion.div
              key={week.week}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: wi * 0.06 }}
            >
              {/* Week header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                  {week.week}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Semana {week.week}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {visibleCount}{contentFilter !== 'all' ? `/${week.days.length}` : ''} publicaciones
                </span>
              </div>

              {/* Day columns header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                {WEEK_DAYS_SHORT.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', padding: '4px 0' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                {Array.from({ length: 7 }, (_, col) => {
                  const entry    = dayMap[col]
                  const cellDate = getCellDate(wi, col)
                  const dateLabel = formatCellDate(cellDate)

                  if (!entry) {
                    return (
                      <div
                        key={col}
                        style={{
                          minHeight: 86, borderRadius: 10,
                          background: 'var(--card-bg)',
                          border: '1px dashed var(--border)',
                          opacity: 0.4,
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'flex-end',
                          padding: '5px 6px',
                        }}
                      >
                        <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 500 }}>
                          {dateLabel}
                        </span>
                      </div>
                    )
                  }

                  const { day, idx } = entry
                  const color    = TYPE_COLORS[day.type] || 'var(--accent)'
                  const isActive = selected?.weekIndex === wi && selected?.dayIndex === idx
                  const isFiltered = contentFilter !== 'all' && day.type !== contentFilter

                  return (
                    <motion.button
                      key={col}
                      whileHover={!isFiltered ? { scale: 1.04, y: -2 } : {}}
                      whileTap={!isFiltered ? { scale: .97 } : {}}
                      onClick={() => !isFiltered && setSelected({ day, weekIndex: wi, dayIndex: idx })}
                      style={{
                        minHeight: 86,
                        borderRadius: 10,
                        background: isActive ? `${color}18` : 'var(--card-bg)',
                        border: `1px solid ${isActive ? color + '60' : 'var(--border)'}`,
                        cursor: isFiltered ? 'default' : 'pointer',
                        padding: '5px 6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all .15s',
                        boxShadow: isActive ? `0 0 12px ${color}30` : 'none',
                        opacity: isFiltered ? 0.15 : 1,
                      }}
                    >
                      <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 500, alignSelf: 'flex-end', lineHeight: 1 }}>
                        {dateLabel}
                      </span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        <TypeIcon type={day.type} style={{ width: 18, height: 18, color }} />
                        <span style={{
                          fontSize: 10, fontWeight: 700, color,
                          letterSpacing: '0.04em', textAlign: 'center',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: '100%',
                        }}>
                          {day.type}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 500 }}>
                          {day.timing}
                        </span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
            <TypeIcon type={type} style={{ width: 14, height: 14, color }} />
            <span style={{ color, fontWeight: 600 }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Day detail modal */}
      {selected && (
        <DayDetail
          day={selected.day}
          weekIndex={selected.weekIndex}
          dayIndex={selected.dayIndex}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
