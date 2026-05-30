import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook: WordPress crea un usuario → se pre-autoriza en Supabase Auth.
//
// Flujo:
//   WordPress (al crear usuario) → POST aquí con { email, name, secret }
//   → validamos el secreto → creamos el usuario en Supabase (sin contraseña)
//   → el cliente entra después con magic link desde el Constructor.
//
// El usuario queda "pre-autorizado": como el login usa shouldCreateUser:false,
// SOLO los emails creados aquí (es decir, creados en WordPress) pueden entrar.
//
// Variables de entorno necesarias (configurar en Vercel):
//   SUPABASE_URL                → URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY   → clave service_role (admin). NUNCA en el frontend.
//   WP_WEBHOOK_SECRET           → secreto compartido con WordPress (inventa uno largo).
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. Validar el secreto compartido (header o body)
  const expected = process.env.WP_WEBHOOK_SECRET
  if (!expected) {
    console.error('[wp-webhook] Falta WP_WEBHOOK_SECRET en variables de entorno')
    return res.status(500).json({ error: 'Webhook no configurado' })
  }
  const provided = (req.headers['x-webhook-secret'] as string) || req.body?.secret
  if (provided !== expected) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  // 2. Validar datos de entrada
  const rawEmail = (req.body?.email || '').toString().trim().toLowerCase()
  const name = (req.body?.name || '').toString().trim()
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
  if (!emailValid) {
    return res.status(400).json({ error: 'Email inválido', email: rawEmail })
  }

  // 3. Crear el usuario en Supabase Auth (admin)
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) {
    console.error('[wp-webhook] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Supabase no configurado' })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email: rawEmail,
    email_confirm: true, // confirmado: puede entrar por magic link sin verificar email
    user_metadata: name ? { name } : undefined,
  })

  // 4. Idempotencia: si ya existe, no es un error (lo creaste dos veces en WP)
  if (error) {
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return res.status(200).json({ ok: true, status: 'already_exists', email: rawEmail })
    }
    console.error('[wp-webhook] Error creando usuario:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, status: 'created', email: rawEmail, id: data.user?.id })
}
