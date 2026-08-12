import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─────────────────────────────────────────────────────────────────────────────
// Acceso directo con el correo: sin contraseña, sin enlace por correo, sin OTP.
//
// Cómo funciona (y por qué NO se envía ningún email):
//   1. El navegador manda el correo aquí.
//   2. Comprobamos que el usuario EXISTE (ver aviso de abajo).
//   3. `admin.auth.admin.generateLink({ type: 'magiclink' })` GENERA el token
//      pero NO envía correo. Ahí está toda la gracia: no hace falta SMTP.
//   4. Devolvemos solo `properties.hashed_token`.
//   5. El navegador lo canjea con `supabase.auth.verifyOtp()`.
//
// Resultado: sesión AUTÉNTICA de Supabase, JWT con `role: authenticated`, RLS
// intacto. Nada de banderas propias en localStorage ni usuarios simulados.
//
// ⚠️ `generateLink` CREA el usuario si no existe. Sin la comprobación de
// existencia previa, este login se convertiría en registro abierto. Y el SDK no
// tiene búsqueda por email: hay que ir al endpoint de la Admin API con
// `?filter=`, que además busca de forma PARCIAL → la coincidencia exacta se
// comprueba a mano sobre los resultados.
//
// El cliente admin se crea AQUÍ, inline: Vercel no bundlea los `api/_*.ts`
// importados desde `api/` (→ FUNCTION_INVOCATION_FAILED). Mismo patrón que
// acceso-edib.ts, admin-alumnos.ts y wp-webhook.ts.
//
// Variables de entorno (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Requisito previo: la tabla `public.project_login_attempt`
// (supabase/migrations/20260812_project_login_attempt.sql).
// ─────────────────────────────────────────────────────────────────────────────

// Vía de vuelta de una línea:
//   false → solo entran los correos ya registrados.
//   true  → cualquier correo entra y se le crea la cuenta.
const CREAR_CUENTAS_NUEVAS = false

// El equipo interno entra sí o sí, esté o no dado de alta en WordPress. El
// dominio se valida AQUÍ (servidor): el cliente no puede saltárselo. Esto
// preserva el comportamiento que ya tenía el login por enlace mágico.
const DOMINIO_EQUIPO = '@edibschool.com'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TABLA_INTENTOS = 'project_login_attempt'
const VENTANA_MINUTOS = 15
const MAX_POR_EMAIL = 5
const MAX_POR_IP = 20

// Respaldo PARCIAL para cuando la tabla no existe: es por instancia y se pierde
// en cada arranque en frío. No sustituye a la tabla.
const intentosEnMemoria = new Map<string, number[]>()

// Si la tabla no aparece apagamos las consultas para no reintentar en cada
// petición, pero lo VOLVEMOS a encender pasados 5 minutos. Si no, una instancia
// caliente que arrancó antes de crear la tabla se quedaría contando en memoria
// de por vida, ignorando la tabla ya creada.
const REINTENTO_TABLA_MS = 5 * 60 * 1000
let tablaAusenteDesde = 0
const tablaUsable = () =>
  !tablaAusenteDesde || Date.now() - tablaAusenteDesde > REINTENTO_TABLA_MS

type ErrorSupabase = { code?: string; message?: string } | null

const esTablaAusente = (e: ErrorSupabase) =>
  e?.code === 'PGRST205' || /Could not find the table/i.test(e?.message || '')

function ipDePeticion(req: VercelRequest): string {
  const r = req.headers['x-forwarded-for']
  if (typeof r === 'string' && r.length) return r.split(',')[0].trim()
  if (Array.isArray(r) && r.length) return String(r[0]).trim()
  return req.socket?.remoteAddress || 'desconocida'
}

function limiteEnMemoria(email: string, ip: string): boolean {
  const ahora = Date.now()
  const desde = ahora - VENTANA_MINUTOS * 60 * 1000
  const contar = (clave: string, tope: number) => {
    const previos = (intentosEnMemoria.get(clave) || []).filter((t) => t >= desde)
    previos.push(ahora)
    intentosEnMemoria.set(clave, previos)
    return previos.length > tope
  }
  if (intentosEnMemoria.size > 5000) {
    for (const [k, m] of intentosEnMemoria) {
      if (!m.some((t) => t >= desde)) intentosEnMemoria.delete(k)
    }
  }
  return contar(`email:${email}`, MAX_POR_EMAIL) || contar(`ip:${ip}`, MAX_POR_IP)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Escribe un correo válido.' })
    }

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !serviceKey) {
      console.error('[login-directo] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
      return res.status(500).json({ error: 'Acceso no configurado.' })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Límite de intentos ────────────────────────────────────────────────────
    const limiteSuperado = async (): Promise<boolean> => {
      if (!tablaUsable()) return limiteEnMemoria(email, ip)
      const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000).toISOString()
      const [porEmail, porIp] = await Promise.all([
        admin.from(TABLA_INTENTOS).select('id', { count: 'exact', head: true })
          .eq('email', email).gte('created_at', desde),
        admin.from(TABLA_INTENTOS).select('id', { count: 'exact', head: true })
          .eq('ip', ip).gte('created_at', desde),
      ])
      const fallo = porEmail.error || porIp.error
      if (fallo) {
        if (esTablaAusente(fallo)) {
          tablaAusenteDesde = Date.now()
          return limiteEnMemoria(email, ip)
        }
        console.error('[login-directo] límite no evaluable:', fallo.message)
        return false   // un limitador roto no debe tumbar el login de todos
      }
      tablaAusenteDesde = 0
      return (porEmail.count || 0) >= MAX_POR_EMAIL || (porIp.count || 0) >= MAX_POR_IP
    }

    const registrarIntento = async (): Promise<void> => {
      if (!tablaUsable()) return   // ya contado en memoria
      const { error } = await admin.from(TABLA_INTENTOS).insert({ email, ip })
      if (error) {
        if (esTablaAusente(error)) tablaAusenteDesde = Date.now()
        else console.error('[login-directo] intento no registrado:', error.message)
        return
      }
      if (Math.random() < 0.02) {
        const caducado = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        await admin.from(TABLA_INTENTOS).delete().lt('created_at', caducado)
      }
    }

    // Explícito, no de rebote por generateLink: la fila de `alumnos` la crea el
    // trigger de la base con rol `alumno`.
    const crearCuenta = async (): Promise<{ error?: string }> => {
      const { error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (!error) return {}
      const msg = (error.message || '').toLowerCase()
      // Carrera entre dos peticiones simultáneas: no es un error.
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) return {}
      return { error: error.message }
    }

    // El SDK no busca por email; `filter` es PARCIAL, exactitud a mano.
    const buscarUsuario = async (): Promise<{ existe?: boolean; error?: string }> => {
      const r = await fetch(
        `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=200`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      )
      if (!r.ok) return { error: `Admin API ${r.status}` }
      const cuerpo = (await r.json()) as { users?: Array<{ email?: string }> }
      const usuarios = cuerpo.users || []
      return { existe: usuarios.some((u) => (u.email || '').toLowerCase() === email) }
    }

    const ip = ipDePeticion(req)
    if (await limiteSuperado()) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' })
    }
    await registrarIntento()   // antes de resolver: cuentan también los fallidos

    const { existe, error: errBusqueda } = await buscarUsuario()
    if (errBusqueda) {
      console.error('[login-directo] búsqueda fallida:', errBusqueda)
      return res.status(500).json({ error: 'No se pudo verificar el acceso.' })
    }

    if (!existe) {
      const esEquipo = email.endsWith(DOMINIO_EQUIPO)
      if (!CREAR_CUENTAS_NUEVAS && !esEquipo) {
        return res.status(401).json({ error: 'Este correo no tiene acceso. Pídele a tu administrador que te dé de alta.' })
      }
      const { error: errAlta } = await crearCuenta()
      if (errAlta) {
        console.error('[login-directo] alta fallida:', errAlta)
        return res.status(500).json({ error: 'No se pudo crear la cuenta.' })
      }
    }

    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (error || !data?.properties?.hashed_token) {
      console.error('[login-directo] generateLink falló:', error?.message)
      return res.status(500).json({ error: 'No se pudo iniciar la sesión.' })
    }

    return res.status(200).json({ success: true, token_hash: data.properties.hashed_token })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado'
    console.error('[login-directo] excepción:', msg)
    return res.status(500).json({ error: 'No se pudo iniciar la sesión.' })
  }
}
