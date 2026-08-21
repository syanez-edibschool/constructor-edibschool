/**
 * Lista canónica de las herramientas del Acelerador, para CONTAR progreso.
 *
 * Debe coincidir con `TOOLS` de src/pages/Tools.tsx, que es lo que pinta el menú.
 * Vive aparte porque la tarjeta del dashboard también necesita contar, y no puede
 * importar la página entera.
 *
 * OJO con lo que NO va aquí:
 *  · Las filas `*__history` de project_tools son el historial de versiones.
 *  · `puv`, `oferta` y `leadmagnet` son SUBTAREAS de Estrategia 90D (2.1, 2.2 y
 *    2.3), no herramientas del menú: su contenido se ve dentro de esa herramienta.
 * Contar cualquiera de las dos cosas inflaría el progreso por encima del total.
 */
export const IDS_HERRAMIENTAS = [
  'calendario', 'carruseles', 'clone-winner', 'contrato', 'dm-instagram',
  'email-frio', 'emails', 'estrategia90d', 'guion-llamadas', 'imagenes',
  'precios', 'prompt-generator', 'propuesta', 'reels', 'story', 'tracker',
  'vsl', 'website',
] as const

export const SET_HERRAMIENTAS: ReadonlySet<string> = new Set(IDS_HERRAMIENTAS)
export const TOTAL_HERRAMIENTAS = IDS_HERRAMIENTAS.length

/** Cuenta herramientas realmente completadas a partir de los tool_id guardados. */
export function contarCompletadas(toolIds: string[]): number {
  const vistas = new Set<string>()
  for (const t of toolIds) {
    if (!t.endsWith('__history') && SET_HERRAMIENTAS.has(t)) vistas.add(t)
  }
  return vistas.size
}
