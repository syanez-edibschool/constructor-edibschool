import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'

/**
 * Entrada por SSO desde el campus (academia.mkthackers.com).
 *
 * El campus abre `/sso#at=<access_token>&rt=<refresh_token>` con los tokens de SU
 * sesion. Como comparte la misma Supabase, esos tokens ya son validos aqui: se
 * establecen con `setSession` y el alumno entra sin volver a loguearse.
 *
 * Los tokens viajan en el FRAGMENT (`#`), que no se envia al servidor ni queda en
 * los logs; se limpian de la URL en cuanto se usan. Ante cualquier fallo se cae
 * al login normal, nunca a una pantalla rota.
 */
export default function SSO() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    ;(async () => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const frag = new URLSearchParams(hash)
      const accessToken = frag.get('at') ?? ''
      const refreshToken = frag.get('rt') ?? ''

      // Si ya hay sesion (se reabrio el enlace), entra directo.
      const { data: previa } = await supabase.auth.getSession()
      if (previa.session) {
        limpiarHash()
        if (activo) navigate('/dashboard', { replace: true })
        return
      }

      if (!accessToken || !refreshToken) {
        if (activo) setError('El enlace de acceso llego incompleto. Entra escribiendo tu correo.')
        return
      }

      const { error: err } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (!activo) return
      if (err) {
        setError('No pudimos validar tu sesion. Entra escribiendo tu correo.')
        return
      }
      limpiarHash()
      navigate('/dashboard', { replace: true })
    })()
    return () => {
      activo = false
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h2 className="text-white text-xl font-semibold mb-3">No pudimos validar el acceso</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <button
            className="px-5 py-2 rounded-xl bg-[#8357F6] text-white font-semibold"
            onClick={() => navigate('/login', { replace: true })}
          >
            Ir al acceso
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin" />
    </div>
  )
}

/** Quita los tokens de la barra de direcciones en cuanto se han usado. */
function limpiarHash() {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* si el navegador no deja, no pasa nada: el fragment no se envia a ningun servidor */
  }
}
