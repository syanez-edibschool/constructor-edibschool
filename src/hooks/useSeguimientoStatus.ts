import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

/**
 * Lee la preparación del alumno actual en la Plataforma de Seguimiento
 * (vista compartida vw_preparacion_global de la Supabase del ecosistema).
 * "Completo" = tiene lecciones y todas están evaluadas.
 * Solo lectura; la RLS de la vista permite al alumno ver su propia fila.
 */
export function useSeguimientoStatus() {
  const [seguimientoCompleto, setSeguimientoCompleto] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) { if (activo) setLoading(false); return }
      const { data: row } = await supabase
        .from('vw_preparacion_global')
        .select('lecciones_evaluadas, lecciones_total')
        .eq('alumno_id', uid)
        .maybeSingle()
      if (!activo) return
      const total = Number(row?.lecciones_total ?? 0)
      const evaluadas = Number(row?.lecciones_evaluadas ?? 0)
      setSeguimientoCompleto(total > 0 && evaluadas >= total)
      setLoading(false)
    }
    check()
    // Re-evaluar al volver a la pestaña (si completó Seguimiento en otra pestaña,
    // se desbloquea solo sin recargar).
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      activo = false
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { seguimientoCompleto, loading }
}
