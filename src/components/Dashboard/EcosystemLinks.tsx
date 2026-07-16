import type { ComponentType, SVGProps } from 'react'
import {
  AcademicCapIcon, ChatBubbleLeftRightIcon, LockClosedIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { useSeguimientoStatus } from '../../hooks/useSeguimientoStatus'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

// Apps del ecosistema (repos/deploys separados, misma Supabase).
const SEGUIMIENTO_URL = 'https://plataforma-seguimiento.vercel.app'
const TUTORIAS_URL = 'https://tutorias-edibschool.vercel.app'
const LOCK_MSG = 'Completa el programa de Seguimiento para desbloquear'

function openExt(url: string) { window.open(url, '_blank', 'noopener,noreferrer') }

function SideBtn({ Icon, label, accent, locked, onClick, collapsed }: {
  Icon: IconComp; label: string; accent: string; locked?: boolean; onClick: () => void; collapsed: boolean
}) {
  // accent debe ser hex (#RRGGBB) para poder tintar el fondo con alfa.
  const bg = locked ? 'var(--card-bg)' : `${accent}1f`
  const bgHover = `${accent}33`
  const border = locked ? 'var(--border)' : `${accent}40`
  return (
    <button
      onClick={() => { if (!locked) onClick() }}
      disabled={locked}
      title={locked ? LOCK_MSG : label}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '9px' : '9px 12px', borderRadius: 10, marginBottom: 6,
        cursor: locked ? 'not-allowed' : 'pointer', border: `1px solid ${border}`,
        background: bg, color: locked ? 'var(--text-3)' : 'var(--text)',
        opacity: locked ? 0.55 : 1, fontSize: 13, fontWeight: 600,
        justifyContent: collapsed ? 'center' : 'flex-start', transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLElement).style.background = bgHover }}
      onMouseLeave={e => { if (!locked) (e.currentTarget as HTMLElement).style.background = bg }}
    >
      <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: locked ? 'var(--border)' : `${accent}2b` }}>
        <Icon style={{ width: 16, height: 16, color: locked ? 'var(--text-3)' : accent }} />
      </span>
      {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{label}</span>}
      {!collapsed && locked && <LockClosedIcon style={{ width: 13, height: 13, flexShrink: 0 }} />}
    </button>
  )
}

function PlatformCard({ Icon, title, desc, accent, locked, onClick }: {
  Icon: IconComp; title: string; desc: string; accent: string; locked?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={() => { if (!locked) onClick() }}
      disabled={locked}
      title={locked ? LOCK_MSG : title}
      style={{
        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
        padding: 'var(--sp-lg)', borderRadius: 'var(--radius-md)',
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1,
        transition: 'border-color 0.2s, transform 0.2s', width: '100%',
      }}
      onMouseEnter={e => { if (!locked) { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-h)'; el.style.transform = 'translateY(-2px)' } }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}22`, border: `1px solid ${accent}44` }}>
          <Icon style={{ width: 20, height: 20, color: accent }} />
        </div>
        {locked
          ? <LockClosedIcon style={{ width: 18, height: 18, color: 'var(--text-3)' }} />
          : <ArrowTopRightOnSquareIcon style={{ width: 18, height: 18, color: 'var(--text-3)' }} />}
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</p>
      <p style={{ fontSize: 12.5, color: locked ? 'var(--text-3)' : 'var(--text-2)', lineHeight: 1.4 }}>
        {locked ? LOCK_MSG : desc}
      </p>
    </button>
  )
}

/**
 * Botones a las otras 2 apps del ecosistema.
 * - Seguimiento: siempre habilitado.
 * - Tutorías 1:1: habilitado solo cuando el alumno completó Seguimiento.
 */
export default function EcosystemLinks({ variant, collapsed = false }: {
  variant: 'sidebar' | 'cards'; collapsed?: boolean
}) {
  const { seguimientoCompleto } = useSeguimientoStatus()
  const tutLocked = !seguimientoCompleto

  if (variant === 'sidebar') {
    return (
      <>
        <SideBtn Icon={AcademicCapIcon} label="Seguimiento" accent="#10B981" collapsed={collapsed} onClick={() => openExt(SEGUIMIENTO_URL)} />
        <SideBtn Icon={ChatBubbleLeftRightIcon} label="Tutorías 1:1" accent="#8357F6" collapsed={collapsed} locked={tutLocked} onClick={() => openExt(TUTORIAS_URL)} />
      </>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--sp-md)' }}>
      <PlatformCard Icon={AcademicCapIcon} title="Plataforma de Seguimiento" desc="Tu progreso, entregas y evaluaciones del programa." accent="#10B981" onClick={() => openExt(SEGUIMIENTO_URL)} />
      <PlatformCard Icon={ChatBubbleLeftRightIcon} title="Tutorías 1 a 1" desc="Agenda tu sesión 1:1 con un mentor del equipo." accent="#8357F6" locked={tutLocked} onClick={() => openExt(TUTORIAS_URL)} />
    </div>
  )
}
