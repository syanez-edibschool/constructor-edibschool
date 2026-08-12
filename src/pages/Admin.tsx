import { useCallback, useEffect, useState, FormEvent } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../services/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Panel de accesos para el equipo de soporte.
//
// Responde las 4 preguntas que el equipo hacía por Slack:
//   · ¿Está registrado?          · ¿Ya entró, y cuándo fue la última vez?
//   · ¿Se le envió el correo?    · Dar de alta a quien falte.
//
// El permiso lo decide el BACKEND (rol equipo/admin en alumnos). Esta pantalla
// solo pinta lo que el endpoint le deja ver: esconder el menú no es seguridad.
// ─────────────────────────────────────────────────────────────────────────────

interface EventoCorreo {
  email: string
  tipo: string
  asunto: string | null
  ocurrido_en: string
}

interface AlumnoFicha {
  id: string
  email: string
  nombre: string | null
  creado_en: string | null
  confirmado: boolean
  ultimo_login: string | null
  rol: string | null
  emailImposible: boolean
  ultimoEventoCorreo: EventoCorreo | null
  ultimaActividad: string | null
  visitas: number | null
}

// Toda respuesta de red se coerciona a texto antes de renderizar: pintar un
// objeto en JSX rompe React con el error #31.
function txt(v: unknown, porDefecto = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return porDefecto
}

function fecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Para la actividad importa más «hace cuánto» que la fecha exacta.
function haceCuanto(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const dias = Math.floor(h / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`
}

const ETIQUETA_EVENTO: Record<string, { texto: string; color: string }> = {
  'email.sent':             { texto: 'Enviado',           color: '#7DA6FF' },
  'email.delivered':        { texto: 'Entregado',         color: '#4ADE80' },
  'email.opened':           { texto: 'Abierto',           color: '#4ADE80' },
  'email.delivery_delayed': { texto: 'Retrasado',         color: '#FBBF24' },
  'email.bounced':          { texto: 'Rebotado',          color: '#F87171' },
  'email.complained':       { texto: 'Marcado como spam', color: '#FB923C' },
}

function Estado({ evento }: { evento: EventoCorreo | null }) {
  if (!evento) {
    return <span className="text-white/30">sin datos</span>
  }
  const meta = ETIQUETA_EVENTO[evento.tipo] || { texto: txt(evento.tipo, 'desconocido'), color: '#A3A3A3' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      <span style={{ color: meta.color }}>{meta.texto}</span>
    </span>
  )
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Tu sesión caducó. Vuelve a entrar.')

  const r = await fetch('/api/admin-alumnos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  })
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new Error(txt(json.error, 'No se pudo completar la operación'))
  return json as T
}

export default function Admin() {
  const [comprobando, setComprobando] = useState(true)
  const [permitido, setPermitido] = useState(false)
  const [rol, setRol] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<AlumnoFicha[] | null>(null)

  const [detalle, setDetalle] = useState<{ alumno: AlumnoFicha; eventos: EventoCorreo[] } | null>(null)

  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [dandoAlta, setDandoAlta] = useState(false)

  useEffect(() => {
    llamar<{ permitido: boolean; rol: string | null }>({ accion: 'sesion' })
      .then((r) => { setPermitido(Boolean(r.permitido)); setRol(r.rol) })
      .catch(() => setPermitido(false))
      .finally(() => setComprobando(false))
  }, [])

  const buscar = useCallback(async (texto: string) => {
    const limpio = texto.trim().toLowerCase()
    if (limpio.length < 3) { toast.error('Escribe al menos 3 caracteres'); return }
    setBuscando(true)
    setDetalle(null)
    try {
      const r = await llamar<{ alumnos: AlumnoFicha[] }>({ accion: 'buscar', q: limpio })
      setResultados(r.alumnos || [])
      if ((r.alumnos || []).length === 0) toast('Ningún correo coincide. Revisa si está bien escrito.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al buscar')
    } finally {
      setBuscando(false)
    }
  }, [])

  const verDetalle = async (email: string) => {
    try {
      const r = await llamar<{ alumno: AlumnoFicha; eventos: EventoCorreo[] }>({ accion: 'detalle', email })
      setDetalle({ alumno: r.alumno, eventos: r.eventos || [] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al abrir el detalle')
    }
  }

  const darAlta = async (e: FormEvent) => {
    e.preventDefault()
    const email = nuevoEmail.trim().toLowerCase()
    if (!email) { toast.error('Escribe el correo'); return }
    setDandoAlta(true)
    try {
      const r = await llamar<{ estado: string }>({ accion: 'alta', email, nombre: nuevoNombre.trim() })
      if (r.estado === 'ya_existia') {
        toast.success('Ese correo ya estaba registrado. Ya puede entrar.')
      } else {
        toast.success('Alta creada. Ya puede entrar escribiendo su correo.')
      }
      setNuevoEmail(''); setNuevoNombre('')
      await buscar(email)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo dar de alta')
    } finally {
      setDandoAlta(false)
    }
  }

  if (comprobando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0E0B30' }}>
        <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin"
          style={{ borderTopColor: '#8357F6' }} />
      </div>
    )
  }

  if (!permitido) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0E0B30' }}>
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white mb-2">Panel restringido</h1>
          <p className="text-sm text-white/50">
            Este panel es solo para el equipo y los mentores. Si necesitas acceso, pide
            que te asignen el rol <strong className="text-white/80">equipo</strong>,{' '}
            <strong className="text-white/80">mentor</strong> o{' '}
            <strong className="text-white/80">admin</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#0E0B30' }}>
      <div className="max-w-6xl mx-auto">

        <header className="mb-8">
          <h1 className="text-2xl font-black text-white">Accesos al Acelerador</h1>
          <p className="text-sm text-white/40 mt-1">
            Comprueba si un alumno está registrado, si se le envió el correo y cuándo entró
            por última vez. Tu rol: <strong className="text-white/70">{txt(rol, 'equipo')}</strong>
          </p>
        </header>

        {/* ── Buscar ── */}
        <section className="mb-6 rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(131,87,246,0.18)' }}>
          <form onSubmit={(e) => { e.preventDefault(); void buscar(q) }} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Correo o parte del correo (mínimo 3 caracteres)"
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(131,87,246,0.25)' }}
            />
            <button type="submit" disabled={buscando}
              className="rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8357F6,#C49DFF)' }}>
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
        </section>

        {/* ── Resultados ── */}
        {resultados && resultados.length > 0 && (
          <section className="mb-6 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(131,87,246,0.18)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full text-sm" style={{ minWidth: 1000 }}>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3 font-semibold">Correo</th>
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Alta</th>
                    <th className="px-4 py-3 font-semibold">Último acceso</th>
                    <th className="px-4 py-3 font-semibold">Actividad real</th>
                    <th className="px-4 py-3 font-semibold">Último correo</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((a) => (
                    <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td className="px-4 py-3 text-white/90">
                        {txt(a.email)}
                        {a.emailImposible && (
                          <span className="block text-[11px]" style={{ color: '#F87171' }}>
                            dirección imposible — nunca recibirá correo
                          </span>
                        )}
                        {!a.confirmado && (
                          <span className="block text-[11px]" style={{ color: '#FBBF24' }}>
                            sin confirmar — no puede entrar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/60">{txt(a.nombre, '—')}</td>
                      <td className="px-4 py-3 text-white/50">{fecha(a.creado_en)}</td>
                      <td className="px-4 py-3">
                        {a.ultimo_login
                          ? <span className="text-white/80">{fecha(a.ultimo_login)}</span>
                          : <span style={{ color: '#FBBF24' }}>nunca ha entrado</span>}
                      </td>
                      <td className="px-4 py-3">
                        {a.ultimaActividad ? (
                          <>
                            <span className="text-white/80">{haceCuanto(a.ultimaActividad)}</span>
                            {typeof a.visitas === 'number' && (
                              <span className="block text-[11px] text-white/35">
                                {a.visitas === 1 ? '1 tramo' : `${a.visitas} tramos`}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-white/30">sin datos</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><Estado evento={a.ultimoEventoCorreo} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => void verDetalle(a.email)}
                          className="text-xs underline" style={{ color: '#C49DFF' }}>
                          ver correos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {resultados && resultados.length === 0 && (
          <section className="mb-6 rounded-2xl p-5 text-sm text-white/50"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.25)' }}>
            No hay ningún registro con ese correo. Si el alumno debería tener acceso,
            dale de alta abajo — y comprueba antes que el correo está bien escrito.
          </section>
        )}

        {/* ── Detalle de correos ── */}
        {detalle && (
          <section className="mb-6 rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(131,87,246,0.18)' }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-base font-bold text-white">{txt(detalle.alumno.email)}</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {detalle.alumno.ultimo_login
                    ? `Ya entró alguna vez. Último inicio de sesión: ${fecha(detalle.alumno.ultimo_login)}`
                    : 'Nunca ha iniciado sesión.'}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {detalle.alumno.ultimaActividad
                    ? `Última vez dentro de la plataforma: ${fecha(detalle.alumno.ultimaActividad)} (${haceCuanto(detalle.alumno.ultimaActividad)})`
                    : 'Sin actividad registrada. Solo se mide desde que se activó el registro de actividad.'}
                </p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-xs text-white/40 hover:text-white/70">
                cerrar
              </button>
            </div>

            {detalle.eventos.length === 0 ? (
              <p className="text-sm text-white/50">
                Sin eventos de correo registrados. Solo se guardan desde que se activó el
                webhook de Resend, así que los envíos anteriores no aparecen aquí.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detalle.eventos.map((ev, i) => (
                  <li key={`${txt(ev.tipo)}-${txt(ev.ocurrido_en)}-${i}`}
                    className="flex items-center justify-between gap-4 text-sm py-1.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Estado evento={ev} />
                    <span className="text-white/40 text-xs">{txt(ev.asunto, '—')}</span>
                    <span className="text-white/50 text-xs whitespace-nowrap">{fecha(ev.ocurrido_en)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Dar de alta ── */}
        <section className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(131,87,246,0.18)' }}>
          <h2 className="text-base font-bold text-white mb-1">Dar de alta</h2>
          <p className="text-xs text-white/40 mb-4">
            Crea el acceso sin contraseña. Después el alumno pide su link en la pantalla
            de entrada. Si ya existía, no se duplica.
          </p>
          <form onSubmit={darAlta} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)}
              placeholder="correo@alumno.com"
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(131,87,246,0.25)' }}
            />
            <input
              type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre y apellido (opcional)"
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(131,87,246,0.25)' }}
            />
            <button type="submit" disabled={dandoAlta}
              className="rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8357F6,#C49DFF)' }}>
              {dandoAlta ? 'Creando…' : 'Dar de alta'}
            </button>
          </form>
        </section>

      </div>
    </div>
  )
}
