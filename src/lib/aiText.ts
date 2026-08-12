// Coerción de datos de IA a texto antes de pintarlos en JSX.
//
// La IA a veces devuelve un objeto (o un array) donde el prompt pedía una
// cadena. Si ese valor llega tal cual a un nodo de React, React lanza el
// error #31 ("Objects are not valid as a React child") y tumba la página
// entera. No se puede normalizar en el backend sin un esquema por herramienta
// (hay objetos legítimos: meses del tracker, casos, paquetes de precios), así
// que la defensa correcta está aquí: en el punto de renderizado.
//
// Regla del proyecto: TODO dato que venga de la IA se pinta con toText(), y
// TODA lista que venga de la IA se recorre con toList().
// La otra mitad del mismo problema: donde se pidió una lista, la IA a veces
// devuelve un objeto (o un único elemento suelto). Entonces `x.map(...)` revienta
// con «X.map is not a function» — el `?.` NO protege de esto, porque el valor no
// es null: simplemente no es un array. toList() siempre devuelve algo recorrible.
export function toList<T>(v: T[] | null | undefined): T[]
export function toList<T = unknown>(v: unknown): T[]
export function toList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v == null) return []
  // Un objeto donde se esperaba una lista suele ser un mapa de elementos
  // ({"lunes": {...}, "martes": {...}}): sus valores SON la lista.
  if (typeof v === 'object') return Object.values(v as Record<string, T>)
  return [v as T]
}

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
