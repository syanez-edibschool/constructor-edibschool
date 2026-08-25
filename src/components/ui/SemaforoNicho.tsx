import { motion } from 'framer-motion'
import { toText, toList } from '../../lib/aiText'

/**
 * Semáforo del nicho. Informa, NUNCA bloquea: un rojo no impide seguir, porque
 * el negocio del alumno puede estar ya en ese nicho. Es criterio formativo, no
 * un error técnico — y así lo dice el texto.
 *
 * Todo lo que viene de la IA pasa por toText/toList antes de pintarse (React #31).
 */

export interface Veredicto {
  semaforo: 'verde' | 'ambar' | 'rojo'
  titular: string
  motivos: string[]
  recomendacion: string
}

const ESTILOS = {
  verde: { color: '#34D399', fondo: 'rgba(52,211,153,0.08)', borde: 'rgba(52,211,153,0.35)', icono: '✓', etiqueta: 'Nicho sólido' },
  ambar: { color: '#FBBF24', fondo: 'rgba(251,191,36,0.08)', borde: 'rgba(251,191,36,0.35)', icono: '!', etiqueta: 'Nicho con peros' },
  rojo:  { color: '#F87171', fondo: 'rgba(248,113,113,0.08)', borde: 'rgba(248,113,113,0.35)', icono: '×', etiqueta: 'Nicho no recomendado' },
} as const

interface Props {
  veredicto: Veredicto | null
  evaluando?: boolean
  /** En la pantalla de revisión se recuerda el veredicto de forma más compacta. */
  compacto?: boolean
}

export default function SemaforoNicho({ veredicto, evaluando = false, compacto = false }: Props) {
  if (evaluando) {
    return (
      <p className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Evaluando tu nicho…
      </p>
    )
  }
  if (!veredicto) return null

  const e = ESTILOS[veredicto.semaforo] ?? ESTILOS.ambar
  const motivos = toList(veredicto.motivos)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl px-4 py-3"
      style={{ background: e.fondo, border: `1px solid ${e.borde}` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center rounded-full text-[11px] font-bold"
          style={{ width: 18, height: 18, background: e.color, color: '#0E0B30' }}
        >
          {e.icono}
        </span>
        <span className="text-xs font-bold" style={{ color: e.color }}>{e.etiqueta}</span>
      </div>

      <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
        {toText(veredicto.titular)}
      </p>

      {motivos.length > 0 && !compacto && (
        <ul className="mt-2 flex flex-col gap-1">
          {motivos.map((m, i) => (
            <li key={i} className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              · {m}
            </li>
          ))}
        </ul>
      )}

      {veredicto.recomendacion && (
        <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'rgba(196,157,255,0.9)' }}>
          {toText(veredicto.recomendacion)}
        </p>
      )}

      {veredicto.semaforo !== 'verde' && (
        <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Es una recomendación de la formación, no un error: puedes continuar con este nicho.
        </p>
      )}
    </motion.div>
  )
}
