// Coerción de datos de IA a texto antes de pintarlos en JSX.
//
// La IA a veces devuelve un objeto (o un array) donde el prompt pedía una
// cadena. Si ese valor llega tal cual a un nodo de React, React lanza el
// error #31 ("Objects are not valid as a React child") y tumba la página
// entera. No se puede normalizar en el backend sin un esquema por herramienta
// (hay objetos legítimos: meses del tracker, casos, paquetes de precios), así
// que la defensa correcta está aquí: en el punto de renderizado.
//
// Regla del proyecto: TODO dato que venga de la IA se pinta con toText().
export function toText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(toText).join('\n')
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k.replace(/_/g, ' ').toUpperCase()}:\n${toText(val)}`)
      .join('\n\n')
  }
  return String(v)
}
