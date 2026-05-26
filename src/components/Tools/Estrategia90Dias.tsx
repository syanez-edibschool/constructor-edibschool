'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayContent {
  day: number
  date_label: string
  format: 'Reel' | 'Carrusel' | 'Post' | 'Story' | 'Email'
  topic: string
  hook: string
  cta: string
  priority: 'ALTA' | 'MEDIA' | 'BAJA'
}

interface Week {
  week: number
  month: number
  theme: string
  intensity: 'ALTA' | 'MEDIA' | 'BAJA'
  days: DayContent[]
}

interface StrategyData {
  weeks: Week[]
}

interface Props {
  projectId: string
}

// ─── Format Colors Map ────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, string> = {
  Reel: '#00D9FF',
  Carrusel: '#8B5CF6',
  Post: '#10B981',
  Story: '#EC4899',
  Email: '#F59E0B',
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo']
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({ content }: { content: DayContent }) {
  const [showCTA, setShowCTA] = useState(false)
  const color = FORMAT_COLORS[content.format]

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setShowCTA(true)}
      onMouseLeave={() => setShowCTA(false)}
      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div
          className="px-2 py-1 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {content.format}
        </div>
        <div className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
          {content.priority === 'ALTA' ? '🔴' : content.priority === 'MEDIA' ? '🟡' : '🟢'}
        </div>
      </div>

      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
        {content.topic}
      </p>

      <p className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-1">
        {content.hook}
      </p>

      {showCTA && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-xs text-gray-500 dark:text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"
        >
          CTA: {content.cta}
        </motion.p>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Estrategia90Dias({ projectId }: Props) {
  const [vista, setVista] = useState<'mes' | 'semana'>('mes')
  const [mesActual, setMesActual] = useState(1)
  const [semanaActual, setSemanaActual] = useState(1)
  const [filtroFormato, setFiltroFormato] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StrategyData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/estrategia90d?projectId=${projectId}`)
        if (!response.ok) throw new Error('Error al cargar estrategia')

        const result = await response.json()
        const parsed: StrategyData = result.result
          ? JSON.parse(result.result)
          : JSON.parse(result.content || '{"weeks":[]}')

        setData(parsed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Estrategia 90 Días</h2>
        <SkeletonLoader />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'No hay estrategia disponible'}</p>
      </div>
    )
  }

  // Agrupar contenido por mes y semana
  const weeksPerMonth: Record<number, Week[]> = {}
  data.weeks.forEach((w) => {
    if (!weeksPerMonth[w.month]) weeksPerMonth[w.month] = []
    weeksPerMonth[w.month].push(w)
  })

  const mesesDisponibles = Object.keys(weeksPerMonth).map(Number).sort()
  const semanasDelMes = weeksPerMonth[mesActual] || []
  const contenidoMes = semanasDelMes.flatMap((w) => w.days)

  // Filtrar por formato
  const contenidoFiltrado = contenidoMes.filter((d) =>
    filtroFormato === 'Todos' ? true : d.format === filtroFormato
  )

  // Obtener semana activa para vista semana
  const semanaActiva = data.weeks.find((w) => w.week === semanaActual)
  const contentosSemanaPorDia: Record<number, DayContent[]> = {}
  if (semanaActiva) {
    semanaActiva.days.forEach((d) => {
      if (!contentosSemanaPorDia[d.day]) contentosSemanaPorDia[d.day] = []
      contentosSemanaPorDia[d.day].push(d)
    })
  }

  const exportCSV = () => {
    const rows = ['Week,Day,Date_Label,Format,Topic,Hook,CTA,Priority']
    data.weeks.forEach((w) => {
      w.days.forEach((d) => {
        rows.push(
          `${w.week},${d.day},"${d.date_label}",${d.format},"${d.topic.replace(/"/g, '""')}","${d.hook.replace(/"/g, '""')}","${d.cta.replace(/"/g, '""')}",${d.priority}`
        )
      })
    })

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `estrategia-90d-${projectId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Estrategia 90 Días
        </h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Descargar CSV
        </button>
      </div>

      {/* ── Vista Toggle & Navigation ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex gap-2">
          <button
            onClick={() => setVista('mes')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              vista === 'mes'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            Por Mes
          </button>
          <button
            onClick={() => setVista('semana')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              vista === 'semana'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            Por Semana
          </button>
        </div>

        {/* Month Navigation */}
        {vista === 'mes' && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setMesActual((m) => (m > 1 ? m - 1 : m))}
              className="px-3 py-1 text-gray-900 dark:text-gray-100"
            >
              &lt;
            </button>
            <span className="px-4 py-1 font-semibold text-gray-900 dark:text-gray-100 min-w-32 text-center">
              Mes {mesActual} - {MONTH_NAMES[mesActual - 1]}
            </span>
            <button
              onClick={() => setMesActual((m) => (m < 3 ? m + 1 : m))}
              className="px-3 py-1 text-gray-900 dark:text-gray-100"
            >
              &gt;
            </button>
          </div>
        )}

        {/* Week Navigation */}
        {vista === 'semana' && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setSemanaActual((s) => (s > 1 ? s - 1 : s))}
              className="px-3 py-1 text-gray-900 dark:text-gray-100"
            >
              &lt;
            </button>
            <span className="px-4 py-1 font-semibold text-gray-900 dark:text-gray-100 min-w-32 text-center">
              Semana {semanaActual}
            </span>
            <button
              onClick={() => setSemanaActual((s) => (s < 13 ? s + 1 : s))}
              className="px-3 py-1 text-gray-900 dark:text-gray-100"
            >
              &gt;
            </button>
          </div>
        )}
      </div>

      {/* ── Format Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {['Todos', 'Reel', 'Carrusel', 'Post', 'Story', 'Email'].map((fmt) => (
          <button
            key={fmt}
            onClick={() => setFiltroFormato(fmt)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtroFormato === fmt
                ? 'text-white'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
            style={
              filtroFormato === fmt && fmt !== 'Todos'
                ? { backgroundColor: FORMAT_COLORS[fmt] }
                : {}
            }
          >
            {fmt}
          </button>
        ))}
      </div>

      {/* ── Vista Mes (Grid) ──────────────────────────────────────────────── */}
      {vista === 'mes' && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Mes {mesActual} - {MONTH_NAMES[mesActual - 1]}
          </h2>

          <div className="space-y-4">
            {semanasDelMes.map((semana) => (
              <div key={semana.week}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Semana {semana.week}
                  </h3>
                  {semana.week === 1 && mesActual === 1 && (
                    <span className="px-2 py-1 text-xs font-bold rounded bg-red-600 text-white">
                      SEMANA DE LANZAMIENTO
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {semana.theme}
                  </span>
                </div>

                {/* Grid de 7 días */}
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const dayNum = dayIndex + 1
                    const contentosDelDia = semana.days
                      .filter((d) => d.day === dayNum)
                      .filter((d) => filtroFormato === 'Todos' || d.format === filtroFormato)

                    const fecha = semana.days.find((d) => d.day === dayNum)?.date_label || ''

                    return (
                      <div
                        key={dayIndex}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 min-h-40"
                      >
                        {fecha && (
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">
                            {fecha.split(' ')[0]}
                          </p>
                        )}
                        <div className="space-y-2">
                          {contentosDelDia.map((c, idx) => (
                            <ContentCard key={idx} content={c} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {contenidoFiltrado.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No hay contenido para este filtro
            </p>
          )}
        </div>
      )}

      {/* ── Vista Semana (Columnas) ───────────────────────────────────────── */}
      {vista === 'semana' && semanaActiva && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Semana {semanaActual} - {semanaActiva.theme}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {semanaActiva.intensity}
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-3 min-w-max">
              {DAY_NAMES.map((day, idx) => {
                const dayNum = idx + 1
                const contentosDelDia = semanaActiva.days
                  .filter((d) => d.day === dayNum)
                  .filter((d) => filtroFormato === 'Todos' || d.format === filtroFormato)

                const fecha = semanaActiva.days.find((d) => d.day === dayNum)?.date_label || ''

                return (
                  <div key={idx} className="min-w-64">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {day}
                    </h3>
                    {fecha && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {fecha}
                      </p>
                    )}
                    <div className="space-y-2">
                      {contentosDelDia.map((c, idx) => (
                        <ContentCard key={idx} content={c} />
                      ))}
                      {contentosDelDia.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">
                          Sin contenido
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {vista === 'semana' && !semanaActiva && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No hay datos para esta semana
        </p>
      )}
    </div>
  )
}
