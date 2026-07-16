import type { ComponentType, SVGProps } from 'react'
import {
  RocketLaunchIcon, AcademicCapIcon, ChatBubbleLeftRightIcon, BriefcaseIcon, LockClosedIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { useSeguimientoStatus } from '../../hooks/useSeguimientoStatus'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

// Apps del ecosistema (repos/deploys separados, misma Supabase).
const SEGUIMIENTO_URL = 'https://plataforma-seguimiento.vercel.app'
const TUTORIAS_URL = 'https://tutorias-edibschool.vercel.app'
const LOCK_MSG = 'Completa el programa de Seguimiento para desbloquear'

function openExt(url: string) { window.open(url, '_blank', 'noopener,noreferrer') }

function SideBtn({ Icon, label, accent, locked, onClick, collapsed, badge, lockMsg, active }: {
  Icon: IconComp; label: string; accent: string; locked?: boolean; onClick: () => void; collapsed: boolean
  badge?: string; lockMsg?: string; active?: boolean
}) {
  // accent debe ser hex (#RRGGBB) para tintar el fondo con alfa.
  const bg = locked ? `${accent}12` : (active ? `${accent}40` : `${accent}24`)
  const bgHover = `${accent}3a`
  return (
    <button
      onClick={() => { if (!locked) onClick() }}
      disabled={locked}
      title={locked ? (lockMsg || label) : label}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '10px 8px' : '11px 12px', borderRadius: 12, marginBottom: 8,
        cursor: locked ? 'not-allowed' : 'pointer',
        border: `1px solid ${accent}55`, borderLeft: `4px solid ${accent}`,
        background: bg, color: locked ? 'var(--text-2)' : 'var(--text)',
        opacity: locked ? 0.8 : 1, fontSize: 13.5, fontWeight: 700,
        justifyContent: collapsed ? 'center' : 'flex-start', transition: 'background 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { if (!locked) { const el = e.currentTarget as HTMLElement; el.style.background = bgHover; el.style.transform = 'translateX(2px)' } }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = bg; el.style.transform = 'translateX(0)' }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}40` }}>
        <Icon style={{ width: 17, height: 17, color: locked ? 'var(--text-2)' : accent }} />
      </span>
      {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{label}</span>}
      {!collapsed && locked && (badge
        ? <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: accent, background: `${accent}30`, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{badge}</span>
        : <LockClosedIcon style={{ width: 13, height: 13, flexShrink: 0 }} />)}
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
export default function EcosystemLinks({ variant, collapsed = false, onAcelerador, aceleradorActive }: {
  variant: 'sidebar' | 'cards'; collapsed?: boolean; onAcelerador?: () => void; aceleradorActive?: boolean
}) {
  const { seguimientoCompleto } = useSeguimientoStatus()
  const tutLocked = !seguimientoCompleto

  if (variant === 'sidebar') {
    return (
      <>
        <SideBtn Icon={RocketLaunchIcon} label="Acelerador" accent="#8357F6" collapsed={collapsed} active={aceleradorActive} onClick={() => onAcelerador?.()} />
        <SideBtn Icon={AcademicCapIcon} label="Seguimiento" accent="#10B981" collapsed={collapsed} onClick={() => openExt(SEGUIMIENTO_URL)} />
        <SideBtn Icon={ChatBubbleLeftRightIcon} label="Tutorías 1:1" accent="#C49DFF" collapsed={collapsed} locked={tutLocked} lockMsg={LOCK_MSG} onClick={() => openExt(TUTORIAS_URL)} />
        <SideBtn Icon={BriefcaseIcon} label="Oportunidades" accent="#F59E0B" collapsed={collapsed} locked badge="Muy pronto" lockMsg="Bolsa de empleo MKT Hackers — muy pronto" onClick={() => {}} />
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
