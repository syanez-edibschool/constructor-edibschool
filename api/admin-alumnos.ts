import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─────────────────────────────────────────────────────────────────────────────
// Panel de administración de accesos al Acelerador (para el equipo de soporte).
//
// Acciones (POST { accion: ... }):
//   sesion  → devuelve el rol de quien llama (para pintar o esconder el panel)
//   buscar  → { q } busca por fragmento de correo y devuelve estado completo:
//             alta, confirmado, último login y último evento de correo (Resend)
//   detalle → { email } un alumno + su historial de eventos de correo
//   alta    → { email, nombre } crea el usuario confirmado y sin contraseña
//
// SEGURIDAD: TODO se verifica aquí, en el servidor. El frontend solo esconde el
// menú; quien llame a este endpoint sin rol equipo/admin recibe 403 aunque
// manipule el cliente.
//
// La verificación de rol va INLINE a propósito: Vercel no bundlea los archivos
// `_`-prefijados importados desde api/ (da FUNCTION_INVOCATION_FAILED), así que
// este endpoint concentra todas las acciones en vez de compartir un helper.
//
// Variables de entorno (Vercel):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ADMIN_EMAILS (opcional) → correos separados por coma con acceso garantizado.
//     Sirve para arrancar: sin esto, si nadie tiene rol equipo/admin en la tabla
//     `alumnos`, nadie puede entrar al panel para arreglarlo.
// ─────────────────────────────────────────────────────────────────────────────

// Quién puede usar el panel. Incluye `mentor` a propósito: los mentores también
// atienden alumnos y necesitan comprobar accesos. La alternativa —ponerles rol
// `equipo`— les daría además la vista de administración de Mentorías, que no les
// corresponde: `alumnos.rol` es COMPARTIDO por las tres apps del ecosistema.
const ROLES_PERMITIDOS = ['equipo', 'admin', 'mentor']

// Validación ESTRICTA. La del resto del proyecto (/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
// acepta `algo.@gmail.com`: un punto final en la parte local es una dirección
// imposible, Gmail la rechaza y el correo rebota siempre. Aquí no entra.
const EMAIL_OK =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

interface UsuarioAuth {
  id: string
  email?: string
  created_at?: string
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
  user_metadata?: { name?: string }
}

interface EventoCorreo {
  email: string
  tipo: string
  asunto: string | null
  ocurrido_en: string
}

interface Actividad {
  ultima_actividad: string | null
  visitas: number | null
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
  // Actividad real. last_sign_in_at solo cambia al canjear un magic link, así
  // que no dice si el alumno sigue usando la plataforma; esto sí.
  ultimaActividad: string | null
  visitas: number | null
}

// Una dirección que ningún proveedor puede entregar (punto suelto en el local).
function emailImposible(email: string): boolean {
  return !EMAIL_OK.test(email)
}

function ficha(
  u: UsuarioAuth,
  rol: string | null,
  evento: EventoCorreo | null,
  actividad: Actividad | null,
): AlumnoFicha {
  const email = (u.email || '').toLowerCase()
  return {
    id: u.id,
    email,
    nombre: u.user_metadata?.name || null,
    creado_en: u.created_at || null,
    confirmado: Boolean(u.email_confirmed_at),
    ultimo_login: u.last_sign_in_at || null,
    rol,
    emailImposible: email ? emailImposible(email) : true,
    ultimoEventoCorreo: evento,
    ultimaActividad: actividad?.ultima_actividad || null,
    visitas: typeof actividad?.visitas === 'number' ? actividad.visitas : null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) {
    console.error('[admin-alumnos] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Supabase no configurado' })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const cabeceras = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  // ── 1. ¿Quién llama? Sesión válida obligatoria ──
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Necesitas iniciar sesión' })
  }
  const { data: quien, error: errQuien } = await admin.auth.getUser(authHeader.slice(7))
  if (errQuien || !quien?.user) {
    return res.status(401).json({ error: 'Sesión no válida o caducada' })
  }
  const emailQuien = (quien.user.email || '').toLowerCase()

  // ── 2. ¿Tiene rol de equipo? El rol vive en public.alumnos.rol ──
  let rolQuien: string | null = null
  const { data: filaRol } = await admin
    .from('alumnos')
    .select('rol')
    .eq('id', quien.user.id)
    .maybeSingle()
  if (filaRol && typeof filaRol.rol === 'string') rolQuien = filaRol.rol

  const listaArranque = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const permitido = ROLES_PERMITIDOS.includes(rolQuien || '') || listaArranque.includes(emailQuien)

  const accion = (req.body?.accion || '').toString()

  // 'sesion' responde siempre: el frontend necesita saber si mostrar el panel.
  if (accion === 'sesion') {
    return res.status(200).json({ rol: rolQuien, email: emailQuien, permitido })
  }

  if (!permitido) {
    return res.status(403).json({ error: 'Este panel es solo para el equipo' })
  }

  try {
    // ── buscar: por fragmento de correo ──
    if (accion === 'buscar') {
      const q = (req.body?.q || '').toString().trim().toLowerCase()
      if (q.length < 3) {
        return res.status(400).json({ error: 'Escribe al menos 3 caracteres' })
      }

      const r = await fetch(
        `${url}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(q)}`,
        { headers: cabeceras },
      )
      if (!r.ok) {
        console.error('[admin-alumnos] buscar falló:', r.status, await r.text())
        return res.status(502).json({ error: 'No se pudo consultar Supabase' })
      }
      const cuerpo = (await r.json()) as { users?: UsuarioAuth[] }
      const usuarios = cuerpo.users || []
      if (usuarios.length === 0) return res.status(200).json({ alumnos: [] })

      const correos = usuarios.map((u) => (u.email || '').toLowerCase()).filter(Boolean)
      const ids = usuarios.map((u) => u.id)

      // Roles (una sola consulta) — si la tabla no responde, seguimos sin rol.
      const roles = new Map<string, string>()
      const { data: filasRol } = await admin.from('alumnos').select('id, rol').in('id', ids)
      for (const f of filasRol || []) {
        if (f && typeof f.rol === 'string') roles.set(String(f.id), f.rol)
      }

      // Último evento de correo por dirección (una sola consulta, más reciente 1º).
      const ultimoEvento = new Map<string, EventoCorreo>()
      const { data: eventos } = await admin
        .from('project_email_eventos')
        .select('email, tipo, asunto, ocurrido_en')
        .in('email', correos)
        .order('ocurrido_en', { ascending: false })
      for (const ev of (eventos || []) as EventoCorreo[]) {
        const clave = (ev.email || '').toLowerCase()
        if (!ultimoEvento.has(clave)) ultimoEvento.set(clave, ev)
      }

      // Actividad real (una sola consulta para todos).
      const actividades = new Map<string, Actividad>()
      const { data: filasAct } = await admin
        .from('project_actividad')
        .select('usuario_id, ultima_actividad, visitas')
        .in('usuario_id', ids)
      for (const f of filasAct || []) {
        actividades.set(String(f.usuario_id), {
          ultima_actividad: f.ultima_actividad ?? null,
          visitas: typeof f.visitas === 'number' ? f.visitas : Number(f.visitas) || null,
        })
      }

      const alumnos = usuarios.map((u) =>
        ficha(
          u,
          roles.get(u.id) || null,
          ultimoEvento.get((u.email || '').toLowerCase()) || null,
          actividades.get(u.id) || null,
        ),
      )
      return res.status(200).json({ alumnos })
    }

    // ── detalle: un alumno + su historial de correos ──
    if (accion === 'detalle') {
      const email = (req.body?.email || '').toString().trim().toLowerCase()
      if (!email) return res.status(400).json({ error: 'Falta el email' })

      const r = await fetch(
        `${url}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(email)}`,
        { headers: cabeceras },
      )
      const cuerpo = (await r.json()) as { users?: UsuarioAuth[] }
      const u = (cuerpo.users || []).find((x) => (x.email || '').toLowerCase() === email)
      if (!u) return res.status(404).json({ error: 'Ese correo no está registrado' })

      const { data: filaR } = await admin
        .from('alumnos')
        .select('rol')
        .eq('id', u.id)
        .maybeSingle()
      const { data: eventos } = await admin
        .from('project_email_eventos')
        .select('email, tipo, asunto, ocurrido_en')
        .eq('email', email)
        .order('ocurrido_en', { ascending: false })
        .limit(50)

      const { data: filaAct } = await admin
        .from('project_actividad')
        .select('ultima_actividad, visitas')
        .eq('usuario_id', u.id)
        .maybeSingle()

      const lista = (eventos || []) as EventoCorreo[]
      const rol = filaR && typeof filaR.rol === 'string' ? filaR.rol : null
      const actividad: Actividad | null = filaAct
        ? {
            ultima_actividad: filaAct.ultima_actividad ?? null,
            visitas: typeof filaAct.visitas === 'number' ? filaAct.visitas : Number(filaAct.visitas) || null,
          }
        : null

      return res.status(200).json({
        alumno: ficha(u, rol, lista[0] || null, actividad),
        eventos: lista,
      })
    }

    // ── alta: crear el usuario confirmado y sin contraseña ──
    if (accion === 'alta') {
      const email = (req.body?.email || '').toString().trim().toLowerCase()
      const nombre = (req.body?.nombre || '').toString().trim()

      if (!email) return res.status(400).json({ error: 'Falta el email' })
      if (!EMAIL_OK.test(email)) {
        return res.status(400).json({
          error: 'Ese correo no es válido. Revisa que no tenga un punto justo antes de la @ ni espacios.',
        })
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true, // confirmado: entra por magic link sin verificar
        user_metadata: nombre ? { name: nombre } : undefined,
      })

      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
          return res.status(200).json({ ok: true, estado: 'ya_existia', email })
        }
        console.error('[admin-alumnos] alta falló:', error.message)
        return res.status(500).json({ error: 'No se pudo dar de alta' })
      }

      console.log(`[admin-alumnos] ${emailQuien} dio de alta a ${email}`)
      return res.status(200).json({ ok: true, estado: 'creado', email, id: data.user?.id })
    }

    return res.status(400).json({ error: 'Acción no reconocida' })
  } catch (e: unknown) {
    console.error('[admin-alumnos] error inesperado:', e)
    return res.status(500).json({ error: 'Error inesperado' })
  }
}
