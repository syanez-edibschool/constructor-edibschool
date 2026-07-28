import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─────────────────────────────────────────────────────────────────────────────
// Alta automática del equipo interno (@edibschool.com).
//
// El login usa shouldCreateUser:false → solo entran los emails ya creados (vía
// WordPress/webhook). El equipo de EDIB debe poder entrar SÍ O SÍ, esté o no
// dado de alta en WordPress: este endpoint lo crea al vuelo.
//
// PÚBLICO (sin JWT) a propósito: quien lo llama todavía no tiene sesión — ese es
// justo el caso. Es seguro porque:
//   · SOLO acepta correos @edibschool.com, y el dominio se valida AQUÍ (servidor).
//     El cliente no puede saltárselo.
//   · Lo único que hace es crear el usuario en auth.users. Es idempotente y no
//     lee ni devuelve datos de nadie.
//   · Crear el usuario NO da acceso por sí solo: para entrar hay que abrir el
//     magic link que llega a esa bandeja @edibschool.com.
//
// La fila en `alumnos` la crea el trigger de la base (rol por defecto: alumno).
//
// Variables de entorno (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ─────────────────────────────────────────────────────────────────────────────

const DOMINIO_EQUIPO = '@edibschool.com'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = (req.body?.email || '').toString().trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Email inválido' })
  }
  if (!email.endsWith(DOMINIO_EQUIPO)) {
    return res.status(403).json({ error: 'Este acceso es solo para correos del equipo' })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) {
    console.error('[acceso-edib] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Supabase no configurado' })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true, // confirmado: entra por magic link sin verificar el email
  })

  if (error) {
    // Idempotencia: si ya existe, para nosotros es éxito (ya puede entrar).
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return res.status(200).json({ ok: true, status: 'already_exists' })
    }
    console.error('[acceso-edib] Error creando usuario:', error.message)
    return res.status(500).json({ error: 'No se pudo dar de alta el acceso' })
  }

  return res.status(200).json({ ok: true, status: 'created' })
}
