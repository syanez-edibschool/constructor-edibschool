import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import {
  CalendarDaysIcon, FilmIcon, DevicePhoneMobileIcon, PencilSquareIcon,
  PhotoIcon, ViewColumnsIcon, GlobeAltIcon, DocumentTextIcon,
  BanknotesIcon, PresentationChartBarIcon, EnvelopeIcon, GiftIcon,
  DocumentCheckIcon, ChartBarIcon, BookOpenIcon, MapIcon,
  DocumentDuplicateIcon, CpuChipIcon,
  ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon,
  CheckCircleIcon, LockClosedIcon,
  PlusCircleIcon, BuildingOffice2Icon,
} from '@heroicons/react/24/outline'

type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>
export type ToolState = 'done' | 'active' | 'locked' | 'idle'

interface SidebarTool { id: string; Icon: IconComp; short: string; cat: string }

const TOOLS: SidebarTool[] = [
  // Análisis
  { id: 'clone-winner',    Icon: DocumentDuplicateIcon, short: 'Clonar Ganador',  cat: 'analisis'       },
  // Contenido
  { id: 'estrategia90d',   Icon: MapIcon,               short: 'Estrategia 90D',  cat: 'contenido'      },
  { id: 'calendario',      Icon: CalendarDaysIcon,       short: 'Calendario',      cat: 'contenido'      },
  { id: 'story',           Icon: PencilSquareIcon,       short: 'Story',           cat: 'contenido'      },
  { id: 'carruseles',      Icon: ViewColumnsIcon,        short: 'Carruseles',      cat: 'contenido'      },
  { id: 'reels',           Icon: DevicePhoneMobileIcon,  short: 'Reels',           cat: 'contenido'      },
  { id: 'imagenes',        Icon: PhotoIcon,              short: 'Imágenes IA',     cat: 'contenido'      },
  // Ventas
  { id: 'vsl',             Icon: FilmIcon,               short: 'VSL',             cat: 'ventas'         },
  { id: 'propuesta',       Icon: DocumentTextIcon,       short: 'Propuesta',       cat: 'ventas'         },
  { id: 'precios',         Icon: BanknotesIcon,          short: 'Precios',         cat: 'ventas'         },
  { id: 'website',         Icon: GlobeAltIcon,           short: 'Sitio Web',       cat: 'ventas'         },
  { id: 'contrato',        Icon: DocumentCheckIcon,      short: 'Contrato',        cat: 'ventas'         },
  // Automatización
  { id: 'prompt-generator', Icon: CpuChipIcon,           short: 'Prompts Agentes', cat: 'automatizacion' },
  { id: 'emails',           Icon: EnvelopeIcon,          short: 'Emails',          cat: 'automatizacion' },
  // Tracking
  { id: 'tracker',         Icon: ChartBarIcon,           short: 'Tracker',         cat: 'tracking'       },
]

// Step numbers for each tool (shown as badge)
const TOOL_STEPS: Record<string, number> = {
  'clone-winner': 1,
  'estrategia90d': 2,
  'calendario': 3, 'story': 4, 'carruseles': 5, 'reels': 6, 'imagenes': 7,
  'vsl': 8, 'propuesta': 9, 'precios': 10, 'website': 11,
  'prompt-generator': 12,
  'emails': 13, 'contrato': 14,
  'tracker': 15,
}

const CATS = ['analisis', 'contenido', 'ventas', 'automatizacion', 'tracking']
const CAT_LABELS: Record<string, string>  = { analisis: 'Análisis', contenido: 'Contenido', ventas: 'Ventas', automatizacion: 'Automatización', tracking: 'Tracking' }
const CAT_COLORS: Record<string, string>  = { analisis: '#EC4899', contenido: '#00D9FF', ventas: '#F59E0B', automatizacion: '#8B5CF6', tracking: '#10B981' }

export interface SidebarProps {
  mode: 'dashboard' | 'project'
  collapsed: boolean
  onToggle: () => void
  // Dashboard-mode actions
  onNewProject?: () => void
  projects?: { id: string; name: string }[]
  onProjectSelect?: (id: string) => void
  // Project-mode info
  projectName?: string
  projectProgress?: number
  currentStep?: number
  toolStates?: Record<string, ToolState>
  activeToolId?: string
  onToolSelect?: (toolId: string) => void
  onBack?: () => void
  user?: { email?: string; user_metadata?: { name?: string } } | null
  onLogout?: () => void
}

function NavItem({ Icon, label, collapsed, onClick, accent, disabled }: {
  Icon: IconComp; label: string; collapsed: boolean
  onClick?: () => void; accent?: string; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={collapsed ? label : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '10px' : '9px 12px',
        borderRadius: 8,
        marginBottom: 2,
        cursor: disabled ? 'default' : 'pointer',
        border: '1px solid transparent',
        background: 'transparent',
        color: disabled ? 'var(--text-3)' : (accent || 'var(--text-2)'),
        opacity: disabled ? 0.45 : 1,
        fontSize: 13,
        fontWeight: 500,
        transition: 'background 0.12s, color 0.12s',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--accent-d)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
    </button>
  )
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div style={{ height: 8 }} />
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '10px 10px 3px', opacity: 0.7 }}>
      {label}
    </p>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
}

export default function Sidebar({
  mode, collapsed, onToggle, onNewProject,
  projects = [], onProjectSelect,
  projectName, projectProgress = 0, currentStep = 1,
  toolStates = {}, activeToolId, onToolSelect, onBack,
  user, onLogout,
}: SidebarProps) {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const logoSrc = isDark ? '/logo_blanco.png' : '/logo_negro.png'
  const userName   = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario'
  const userInitial = (user?.user_metadata?.name || user?.email || 'U')[0].toUpperCase()
  const getState   = (id: string): ToolState => toolStates[id] || 'idle'

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{
        flexShrink: 0,
        height: '100vh',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* ── Logo + collapse toggle ── */}
      <div style={{ padding: '14px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', flexShrink: 0, minHeight: 64 }}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.button
              key="logo"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              onClick={() => mode === 'project' ? (onBack?.(), navigate('/dashboard')) : undefined}
              style={{
                background: 'none', border: 'none', cursor: mode === 'project' ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: 0,
              }}
            >
              {mode === 'project' && <ArrowLeftIcon style={{ width: 14, height: 14, color: 'var(--text-3)', flexShrink: 0 }} />}
              <img src={logoSrc} alt="MKT Hackers" style={{ height: isDark ? 32 : 42, width: 'auto', objectFit: 'contain' }} />
            </motion.button>
          )}
        </AnimatePresence>
        {collapsed && <div style={{ flex: 1 }} />}
        <button onClick={onToggle} className="btn-icon" style={{ width: 32, height: 32, flexShrink: 0 }} title={collapsed ? 'Expandir' : 'Colapsar'}>
          {collapsed
            ? <ChevronRightIcon style={{ width: 15, height: 15 }} />
            : <ChevronLeftIcon  style={{ width: 15, height: 15 }} />}
        </button>
      </div>

      {/* ── DASHBOARD MODE ── */}
      {mode === 'dashboard' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column' }}>
          <SectionLabel label="Acciones rápidas" collapsed={collapsed} />
          <NavItem Icon={PlusCircleIcon} label="Crear proyecto" collapsed={collapsed} onClick={onNewProject} accent="var(--accent)" />

          {projects.length > 0 && (
            <>
              <Divider />
              <SectionLabel label="Tus proyectos" collapsed={collapsed} />
              {projects.slice(0, 8).map(p => (
                <button
                  key={p.id}
                  title={collapsed ? p.name : undefined}
                  onClick={() => onProjectSelect?.(p.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: collapsed ? '9px' : '8px 10px',
                    borderRadius: 8, marginBottom: 2,
                    cursor: 'pointer', border: '1px solid transparent',
                    background: 'transparent', color: 'var(--text-2)',
                    fontSize: 12, fontWeight: 500, textAlign: 'left',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-d)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'linear-gradient(135deg,rgba(0,217,255,.15),rgba(139,92,246,.15))',
                    border: '1px solid rgba(0,217,255,.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <BuildingOffice2Icon style={{ width: 12, height: 12, color: 'var(--accent)' }} />
                  </div>
                  {!collapsed && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {p.name}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── PROJECT MODE ── */}
      {mode === 'project' && (
        <>
          {/* Project info */}
          {!collapsed && (
            <div style={{ borderBottom: '1px solid var(--border)', padding: '12px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,rgba(0,217,255,.15),rgba(139,92,246,.15))', border: '1px solid rgba(0,217,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BuildingOffice2Icon style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {projectName || 'Proyecto'}
                </p>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                Paso {currentStep} de 8 · {projectProgress}%
              </p>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${projectProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ height: '100%', background: 'linear-gradient(90deg,#00D9FF,#8B5CF6)', borderRadius: 999 }}
                />
              </div>
            </div>
          )}

          {/* Tools list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
            {!collapsed && (
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '8px 8px 3px', opacity: 0.7 }}>
                Herramientas
              </p>
            )}

            {CATS.map(cat => {
              const catTools = TOOLS.filter(t => t.cat === cat)
              const catColor = CAT_COLORS[cat]
              return (
                <div key={cat}>
                  {!collapsed && (
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: catColor, padding: '8px 8px 2px', opacity: 0.6 }}>
                      {CAT_LABELS[cat]}
                    </p>
                  )}
                  {collapsed && <div style={{ height: 6 }} />}
                  {catTools.map(tool => {
                    const state    = getState(tool.id)
                    const isActive = tool.id === activeToolId
                    const isDone   = state === 'done'
                    const isLocked = state === 'locked'
                    const itemColor = isDone ? '#10B981' : isActive ? 'var(--accent)' : 'var(--text-2)'

                    return (
                      <button
                        key={tool.id}
                        onClick={() => !isLocked && onToolSelect?.(tool.id)}
                        disabled={isLocked}
                        title={tool.short}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          gap: 8, padding: collapsed ? '9px' : '7px 10px',
                          minHeight: 34, borderRadius: 8, marginBottom: 1,
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                          textAlign: 'left',
                          border: isActive ? '1px solid var(--border-h)' : '1px solid transparent',
                          background: isActive ? 'var(--accent-d)' : 'transparent',
                          color: itemColor, opacity: isLocked ? 0.38 : 1,
                          transition: 'background 0.12s, color 0.12s',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                        }}
                        onMouseEnter={e => { if (!isLocked && !isActive) (e.currentTarget as HTMLElement).style.background = 'var(--accent-d)' }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        {isDone   ? <CheckCircleIcon style={{ width: 16, height: 16, flexShrink: 0, color: '#10B981' }} />
                        : isLocked ? <LockClosedIcon  style={{ width: 16, height: 16, flexShrink: 0 }} />
                                   : <tool.Icon        style={{ width: 16, height: 16, flexShrink: 0 }} />}

                        {!collapsed && (
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tool.short}
                          </span>
                        )}
                        {!collapsed && TOOL_STEPS[tool.id] && !isDone && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'monospace', opacity: 0.5 }}>
                            {TOOL_STEPS[tool.id]}
                          </span>
                        )}
                        {!collapsed && isActive && !isDone && (
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, boxShadow: '0 0 5px var(--accent)' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Back to dashboard */}
          <Divider />
          <div style={{ padding: '4px 6px', flexShrink: 0 }}>
            <NavItem
              Icon={ArrowLeftIcon}
              label="Volver al Dashboard"
              collapsed={collapsed}
              onClick={() => { onBack?.(); navigate('/dashboard') }}
            />
          </div>
        </>
      )}

      {/* ── User footer (both modes) ── */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 8px', flexShrink: 0 }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={onLogout} title="Cerrar sesión" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                {userInitial}
              </div>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {userInitial}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{userName}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{user?.email}</p>
            </div>
            <button onClick={onLogout} className="btn-icon" style={{ width: 28, height: 28, flexShrink: 0 }} title="Cerrar sesión">
              <ArrowLeftIcon style={{ width: 13, height: 13 }} />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
