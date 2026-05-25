import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import type { Project } from '../../services/projectsService'

type Filter = 'all' | 'active' | 'completed'
type Sort   = 'recent' | 'name' | 'progress'

interface ProjectGridProps {
  projects: Project[]
  loading: boolean
  renderCard: (project: Project, index: number) => React.ReactNode
  renderNewCard: () => React.ReactNode
  renderEmpty?: () => React.ReactNode
}

function LoadingGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--sp-lg)' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
          style={{ height: 220, borderRadius: 'var(--radius-lg)', background: 'var(--card-bg)', border: '1px solid var(--border)' }}
        />
      ))}
    </div>
  )
}

export default function ProjectGrid({ projects, loading, renderCard, renderNewCard, renderEmpty }: ProjectGridProps) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<Filter>('all')
  const [sort, setSort]       = useState<Sort>('recent')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = [...projects]

    if (search.trim())
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

    if (filter === 'active')    list = list.filter(p => p.status !== 'completed')
    if (filter === 'completed') list = list.filter(p => p.status === 'completed')

    if (sort === 'name')     list.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'progress') list.sort((a, b) => (b.progress || 0) - (a.progress || 0))
    if (sort === 'recent')   list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    return list
  }, [projects, search, filter, sort])

  const FILTER_OPTS: { val: Filter; label: string }[] = [
    { val: 'all',       label: 'Todos'       },
    { val: 'active',    label: 'En progreso' },
    { val: 'completed', label: 'Completados' },
  ]
  const SORT_OPTS: { val: Sort; label: string }[] = [
    { val: 'recent',   label: 'Más reciente' },
    { val: 'name',     label: 'Nombre'       },
    { val: 'progress', label: 'Progreso'     },
  ]

  return (
    <section aria-label="Proyectos">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder="Buscar proyectos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar proyectos"
            className="input-form"
            style={{ paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9 }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTER_OPTS.map(o => (
            <button
              key={o.val}
              onClick={() => setFilter(o.val)}
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                border: `1px solid ${filter === o.val ? 'var(--border-h)' : 'var(--border)'}`,
                background: filter === o.val ? 'var(--accent-d)' : 'transparent',
                color: filter === o.val ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="btn-icon"
            style={{ width: 36, height: 36 }}
            title="Ordenar"
          >
            <AdjustmentsHorizontalIcon style={{ width: 16, height: 16 }} />
          </button>
          {showFilters && (
            <div style={{
              position: 'absolute', right: 0, top: 40, width: 160,
              background: 'var(--surface-s)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              boxShadow: '0 8px 24px var(--shadow)', zIndex: 30,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '8px 12px 4px' }}>Ordenar por</p>
              {SORT_OPTS.map(o => (
                <button
                  key={o.val}
                  onClick={() => { setSort(o.val); setShowFilters(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', fontSize: 13,
                    color: sort === o.val ? 'var(--accent)' : 'var(--text-2)',
                    background: sort === o.val ? 'var(--accent-d)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 0.1s, color 0.1s',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Count badge */}
        <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          {filtered.length} {filtered.length === 1 ? 'proyecto' : 'proyectos'}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingGrid />
      ) : filtered.length === 0 && !search && projects.length === 0 ? (
        renderEmpty?.()
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--sp-lg)' }}>
            {renderNewCard()}
            {filtered.map((p, i) => renderCard(p, i + 1))}
          </div>

          {filtered.length === 0 && search && (
            <div style={{ textAlign: 'center', padding: 'var(--sp-2xl) 0', color: 'var(--text-3)' }}>
              <MagnifyingGlassIcon style={{ width: 32, height: 32, marginBottom: 8, color: 'var(--text-3)' }} />
              <p style={{ fontSize: 14 }}>Sin resultados para "{search}"</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
