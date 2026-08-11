import { useEffect } from 'react'
import { supabase } from '../services/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Registra que el alumno está usando la plataforma AHORA.
//
// Hace falta porque auth.users.last_sign_in_at solo se actualiza al canjear un
// magic link, no al refrescar la sesión: alguien que entró hace semanas y sigue
// usando la app a diario seguiría mostrando la fecha vieja.
//
// La escritura va por la RPC project_registrar_actividad(), que solo puede
// escribir la fila del usuario de la sesión: nadie puede falsear la de otro.
//
// Se limita a un registro cada 5 minutos (guardado en localStorage para que
// sobreviva a recargas y cambios de página). Así navegar entre pantallas no
// genera una escritura por clic. La cuenta de `visitas` cuenta, por tanto,
// tramos de actividad de 5 minutos, no páginas vistas.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'mkth_actividad_ultimo_registro'
const VENTANA_MS = 5 * 60 * 1000

function registrar(): void {
  let ultimo = 0
  try {
    ultimo = Number(localStorage.getItem(CLAVE) || 0)
  } catch {
    ultimo = 0 // navegación privada puede bloquear localStorage
  }
  if (Date.now() - ultimo < VENTANA_MS) return

  try {
    localStorage.setItem(CLAVE, String(Date.now()))
  } catch {
    // Sin localStorage registramos igual; solo perdemos la limitación.
  }

  // Sin bloquear y con el error silenciado: esto es telemetría, nunca debe
  // estorbar a lo que el alumno está haciendo.
  void (async () => {
    try {
      await supabase.rpc('project_registrar_actividad')
    } catch {
      // Si falla, no pasa nada: solo perdemos un registro de actividad.
    }
  })()
}

export function useRegistrarActividad(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return

    // OJO: esto NO va dentro de onAuthStateChange. Llamar funciones async de
    // Supabase dentro de ese callback puede bloquear el lock de GoTrue y dejar
    // las consultas siguientes colgadas.
    registrar()

    // Mientras la pestaña siga abierta, seguimos marcando actividad.
    const intervalo = setInterval(registrar, VENTANA_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') registrar() }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [userId])
}
