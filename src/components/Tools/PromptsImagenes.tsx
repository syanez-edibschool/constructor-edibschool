import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardDocumentIcon, CheckIcon, ArrowPathIcon, ChevronDownIcon,
  CubeIcon, FilmIcon, SparklesIcon, UserIcon,
  ChartBarIcon, HeartIcon, BuildingOfficeIcon, PhotoIcon,
} from '@heroicons/react/24/outline'

export interface ImagenPrompt {
  titulo: string
  descripcion: string
  tipo: string
  prompt: string
  negative_prompt?: string
  formato?: string
}

interface PromptsImagenesProps {
  prompts: ImagenPrompt[]
  updatedAt?: string
  onRegenerate: () => void
}

const TIPO_COLORS: Record<string, string> = {
  Producto: '#8357F6',
  Escena: '#10B981',
  Resultado: '#F59E0B',
  Persona: '#AF8AE6',
  Datos: '#C49DFF',
  Emoción: '#EF4444',
  Lugar: '#0891b2',
}

type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>
const TIPO_ICON_MAP: Record<string, IconComp> = {
  Producto:  CubeIcon,
  Escena:    FilmIcon,
  Resultado: SparklesIcon,
  Persona:   UserIcon,
  Datos:     ChartBarIcon,
  Emoción:   HeartIcon,
  Lugar:     BuildingOfficeIcon,
  Hero:      PhotoIcon,
  Lifestyle: UserIcon,
  Ambiente:  BuildingOfficeIcon,
  Dato:      ChartBarIcon,
}
function TipoIcon({ tipo, style }: { tipo: string; style?: React.CSSProperties }) {
  const Icon = TIPO_ICON_MAP[tipo] || PhotoIcon
  return <Icon style={style} />
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.button
      onClick={copy}
      whileTap={{ scale: .95 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
        background: copied ? 'rgba(16,185,129,.15)' : 'var(--card-bg)',
        border: `1px solid ${copied ? '#10B981' : 'var(--border)'}`,
        color: copied ? '#10B981' : 'var(--text-2)',
        cursor: 'pointer', transition: 'all .2s',
      }}
    >
      {copied
        ? <><CheckIcon style={{ width: 12, height: 12 }} />Copiado</>
        : <><ClipboardDocumentIcon style={{ width: 12, height: 12 }} />Copiar prompt</>
      }
    </motion.button>
  )
}

function PromptCard({ p, index }: { p: ImagenPrompt; index: number }) {
  const [showNeg, setShowNeg] = useState(false)
  const color = TIPO_COLORS[p.tipo] || 'var(--accent)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        borderRadius: 14,
        border: `1px solid ${color}30`,
        background: 'var(--card-bg)',
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Top color bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${color},transparent)` }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TipoIcon tipo={p.tipo} style={{ width: 18, height: 18, color }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.titulo}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '1px 6px', borderRadius: 999,
                  background: `${color}18`, color,
                }}>
                  {p.tipo}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.descripcion}</p>
            </div>
          </div>
          {p.formato && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {p.formato}
            </span>
          )}
        </div>

        {/* Prompt box */}
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--bg)', border: '1px solid var(--border)',
          marginBottom: 10,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11, lineHeight: 1.6, color: 'var(--text-2)',
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color, marginBottom: 5 }}>
            Prompt (EN)
          </p>
          {p.prompt}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CopyButton text={p.prompt} />
          {p.negative_prompt && (
            <button
              onClick={() => setShowNeg(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-3)', cursor: 'pointer',
              }}
            >
              Negativo
              <ChevronDownIcon style={{ width: 10, height: 10, transform: showNeg ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
          )}
        </div>

        {/* Negative prompt */}
        <AnimatePresence>
          {showNeg && p.negative_prompt && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: .2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10, lineHeight: 1.6, color: 'var(--text-3)',
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#EF4444', marginBottom: 4 }}>
                  Negative prompt
                </p>
                {p.negative_prompt}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function PromptsImagenes({ prompts, updatedAt, onRegenerate }: PromptsImagenesProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? prompts : prompts.slice(0, 3)

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
            Prompts de Imágenes
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {prompts.length} prompts · Listos para DALL-E, Midjourney, Stable Diffusion
            {updatedAt && ` · ${new Date(updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>
        <button
          onClick={onRegenerate}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}
        >
          <ArrowPathIcon style={{ width: 15, height: 15 }} />
          Regenerar
        </button>
      </div>

      {/* Tipo legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {Object.entries(TIPO_ICON_MAP).slice(0, 7).map(([tipo]) => (
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: TIPO_COLORS[tipo] || 'var(--accent)', fontWeight: 600 }}>
            <TipoIcon tipo={tipo} style={{ width: 12, height: 12 }} />
            <span>{tipo}</span>
          </div>
        ))}
      </div>

      {/* Prompt cards */}
      {visible.map((p, i) => <PromptCard key={i} p={p} index={i} />)}

      {/* Show more / less */}
      {prompts.length > 3 && (
        <motion.button
          onClick={() => setShowAll(v => !v)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: .97 }}
          className="btn-secondary"
          style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, marginTop: 4 }}
        >
          {showAll ? 'Ver menos' : `Ver ${prompts.length - 3} prompts más`}
        </motion.button>
      )}
    </div>
  )
}
