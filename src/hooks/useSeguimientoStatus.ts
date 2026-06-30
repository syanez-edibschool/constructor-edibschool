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
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) { if (activo) setLoading(false); return }
      supabase
        .from('vw_preparacion_global')
        .select('lecciones_evaluadas, lecciones_total')
        .eq('alumno_id', uid)
        .maybeSingle()
        .then(({ data: row }) => {
          if (!activo) return
          const total = Number(row?.lecciones_total ?? 0)
          const evaluadas = Number(row?.lecciones_evaluadas ?? 0)
          setSeguimientoCompleto(total > 0 && evaluadas >= total)
          setLoading(false)
        })
    })
    return () => { activo = false }
  }, [])

  return { seguimientoCompleto, loading }
}
