import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../services/supabase'
import { ArrowRightIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline'

interface ProjectCardData {
  id: string
  name: string
  description?: string
  status?: string
  progress?: number
  current_step?: number
  created_at: string
  updated_at: string
}

interface ProjectCardProps {
  project: ProjectCardData
  index: number
  col: string
  isDark: boolean
  onContinue: () => void
  onDelete: () => void
}

interface NichoData { sector?: string; micronicho?: string; tam?: string }
interface AvatarData { name?: string; age?: string; narrative?: string }

type Spark = { id: number; x: number; y: number; vx: number; vy: number; color: string }

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
  if (h < 1) return 'Hace unos minutos'
  if (h < 24) return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

export default function ProjectCard({ project, index, col, isDark, onContinue, onDelete }: ProjectCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 })
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sparks, setSparks] = useState<Spark[]>([])
  const [nicho, setNicho] = useState<NichoData | null>(null)
  const [avatar, setAvatar] = useState<AvatarData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [nichoRes, avatarRes] = await Promise.all([
        supabase.from('project_nicho').select('sector,micronicho,tam').eq('project_id', project.id).maybeSingle(),
        supabase.from('project_avatar').select('name,age,narrative').eq('project_id', project.id).maybeSingle(),
      ])
      if (!cancelled) {
        if (nichoRes.data) setNicho(nichoRes.data as NichoData)
        if (avatarRes.data) setAvatar(avatarRes.data as AvatarData)
      }
    }
    load()
    return () => { cancelled = true }
  }, [project.id])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const onMove = useCallback((e: React.MouseEvent) => {
    const r = cardRef.current!.getBoundingClientRect()
    const nx = (e.clientX - r.left - r.width / 2) / (r.width / 2)
    const ny = (e.clientY - r.top - r.height / 2) / (r.height / 2)
    setTilt({ rx: ny * -8, ry: nx * 8, gx: ((e.clientX - r.left) / r.width) * 100, gy: ((e.clientY - r.top) / r.height) * 100 })
  }, [])
  const onLeave = useCallback(() => { setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 }); setHovered(false) }, [])
  const explode = useCallback((e: React.MouseEvent) => {
    const r = cardRef.current!.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    const ns: Spark[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i, x: cx, y: cy,
      vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10,
      color: ['#00D9FF', '#8B5CF6', '#EC4899', '#fff'][Math.floor(Math.random() * 4)],
    }))
    setSparks(s => [...s, ...ns])
    setTimeout(() => setSparks(s => s.filter(sp => !ns.find(n => n.id === sp.id))), 900)
  }, [])

  const pct = project.progress || 0
  const isComplete = project.status === 'completed'
  const cardBg = isDark ? (hovered ? 'rgba(0,217,255,.07)' : 'rgba(255,255,255,.04)') : (hovered ? 'rgba(8,145,178,.05)' : 'var(--surface)')
  const cardBorder = isDark ? (hovered ? 'rgba(0,217,255,.3)' : 'rgba(255,255,255,.07)') : (hovered ? 'rgba(8,145,178,.4)' : 'var(--border)')

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: .5, delay: index * .07, ease: [.25, .46, .45, .94] }}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onLeave}
      onClick={explode}
      style={{ perspective: 1000, transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${hovered ? 1.03 : 1})`, transition: hovered ? 'transform .15s ease-out' : 'transform .4s ease-out' }}
      className="relative flex flex-col gap-3 rounded-2xl overflow-hidden cursor-pointer"
    >
      {isDark && <div className="absolute -inset-px rounded-2xl pointer-events-none transition-opacity duration-300" style={{ opacity: hovered ? 1 : 0, background: `linear-gradient(135deg, ${col}, rgba(139,92,246,.6))`, filter: 'blur(1px)' }} />}
      <div
        className="relative rounded-2xl h-full flex flex-col overflow-hidden"
        style={{ gap: 12, padding: 20, background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: isDark ? 'blur(20px)' : 'none', boxShadow: hovered ? (isDark ? `0 20px 60px rgba(0,0,0,.5),0 0 40px rgba(0,217,255,.12)` : `0 8px 30px var(--shadow)`) : (isDark ? '0 8px 32px rgba(0,0,0,.3)' : `0 2px 8px var(--shadow)`), transition: 'all .3s ease' }}
      >
        {isDark && hovered && <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(0,217,255,.1) 0%, transparent 60%)` }} />}
        {sparks.map(sp => (
          <motion.div key={sp.id} className="absolute w-1.5 h-1.5 rounded-full pointer-events-none" style={{ left: sp.x, top: sp.y, background: sp.color }} initial={{ scale: 1, opacity: 1 }} animate={{ x: sp.vx * 20, y: sp.vy * 20, opacity: 0, scale: 0 }} transition={{ duration: .75, ease: 'easeOut' }} />
        ))}

        {/* Menu */}
        <div ref={menuRef} className="absolute top-3 right-3">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all"
            style={{ background: 'var(--card-bg)', color: 'var(--text-3)' }}
          >
            •••
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-9 w-32 rounded-xl overflow-hidden z-10 animate-in fade-in duration-150"
              style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}
            >
              <button
                onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Icon + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,rgba(0,217,255,.15),rgba(139,92,246,.15))', border: '1px solid rgba(0,217,255,.2)' }}>
            <BuildingOffice2Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1, paddingRight: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3, marginBottom: 1 }}>{project.name}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.description || 'Sin descripción'}
            </p>
          </div>
        </div>

        {/* Nicho + Avatar panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3 }}>Nicho</p>
            {nicho ? (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#00D9FF', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nicho.micronicho || nicho.sector || '—'}</p>
                {nicho.tam && <p style={{ fontSize: 9, color: '#8B5CF6', fontWeight: 600 }}>TAM: {nicho.tam}</p>}
              </>
            ) : (
              <p style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic' }}>Sin definir</p>
            )}
          </div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3 }}>Avatar</p>
            {avatar ? (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#00D9FF', marginBottom: 1 }}>{avatar.name || '—'}</p>
                {avatar.age && <p style={{ fontSize: 9, color: 'var(--text-3)' }}>{avatar.age}</p>}
              </>
            ) : (
              <p style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic' }}>Sin definir</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Progreso · Paso {project.current_step || 1}/8</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{pct}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 999, overflow: 'hidden', background: 'var(--card-bg)' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: index * .07 + .3, ease: 'easeOut' }}
              style={{ background: `linear-gradient(90deg,#00D9FF,${col},#EC4899)`, backgroundSize: '200% 100%' }}
            />
          </div>
        </div>

        {/* Status + time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="relative flex h-2 w-2">
              {!isComplete && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#00D9FF' }} />}
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: isComplete ? '#10B981' : '#00D9FF' }} />
            </span>
            <span style={{ fontSize: 10, color: isComplete ? '#10B981' : 'rgba(0,217,255,.8)' }}>{isComplete ? 'Completado' : 'En progreso'}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{timeAgo(project.updated_at)}</span>
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,217,255,.35)' }}
          whileTap={{ scale: .97 }}
          onClick={e => { e.stopPropagation(); onContinue() }}
          style={{ width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', background: 'linear-gradient(135deg,#00D9FF 0%,#8B5CF6 100%)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', overflow: 'hidden' }}
        >
          <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,.25) 50%,transparent 60%)', backgroundSize: '200% 100%' }} animate={{ backgroundPosition: ['200% 0', '-200% 0'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} />
          <span className="relative">Continuar</span>
          <ArrowRightIcon style={{ width: 14, height: 14 }} className="relative" />
        </motion.button>
      </div>
    </motion.div>
  )
}
