import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

export interface BreadcrumbItem { label: string; href?: string }

interface HeaderProps {
  breadcrumb?: BreadcrumbItem[]
  isDark: boolean
  onToggleTheme: () => void
  scrolled?: boolean
  right?: React.ReactNode
}

export default function DashboardHeader({ breadcrumb = [], isDark, onToggleTheme, scrolled, right }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      role="banner"
      style={{
        height: 'var(--header-h)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--sp-lg)',
        gap: 'var(--sp-sm)',
        background: scrolled ? 'var(--surface)' : 'var(--bg)',
        backdropFilter: scrolled && isDark ? 'blur(20px)' : 'none',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 15,
        transition: 'background 0.3s, box-shadow 0.3s',
        boxShadow: scrolled ? '0 2px 16px var(--shadow)' : 'none',
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          {breadcrumb.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>/</span>}
              {item.href ? (
                <button
                  onClick={() => navigate(item.href!)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: i === breadcrumb.length - 1 ? 'var(--text)' : 'var(--text-2)',
                    fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                    fontSize: 13,
                  }}
                >
                  {item.label}
                </button>
              ) : (
                <span style={{
                  color: i === breadcrumb.length - 1 ? 'var(--text)' : 'var(--text-2)',
                  fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                }}>
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div style={{ flex: 1 }} />

      {/* Right slot */}
      {right}

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="btn-icon"
        title={isDark ? 'Modo claro' : 'Modo oscuro'}
        aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      >
        {isDark
          ? <SunIcon style={{ width: 18, height: 18 }} />
          : <MoonIcon style={{ width: 18, height: 18 }} />}
      </button>
    </header>
  )
}
