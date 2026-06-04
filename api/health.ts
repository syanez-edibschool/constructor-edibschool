import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Health check.
//   - PÚBLICO (por defecto): respuesta mínima { status, timestamp }. NO revela
//     claves, URLs ni el stack. Solo confirma que la app responde y que la BD
//     está accesible. Es lo que consulta UptimeRobot. No pinga a la IA (ahorra
//     coste y evita falsas alarmas por hipos puntuales de Anthropic).
//   - DETALLADO: solo si se pasa ?key=<HEALTH_DEBUG_KEY>. Devuelve el diagnóstico
//     completo (env, ping a Anthropic, auth). HEALTH_DEBUG_KEY se configura en Vercel.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  const debugKey = process.env.HEALTH_DEBUG_KEY
  const isDebug = !!debugKey && req.query.key === debugKey

  // ── Chequeo de la BD (barato, sin IA) ──────────────────────────────────────
  let supabaseOk = false
  let supabaseNote = 'env vars no configuradas'
  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey)
      const { error } = await sb.from('projects').select('id').limit(1)
      supabaseOk = !error
      supabaseNote = error ? `query error: ${error.message}` : 'conexión OK'
    } catch (err: any) {
      supabaseNote = err.message
    }
  }

  // ── Respuesta PÚBLICA mínima (sin secretos ni detalles del stack) ──────────
  if (!isDebug) {
    return res.status(supabaseOk ? 200 : 503).json({
      status: supabaseOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    })
  }

  // ── Respuesta DETALLADA (requiere token correcto) ──────────────────────────
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      ANTHROPIC_API_KEY: anthropicKey ? `set (${anthropicKey.slice(0, 12)}…${anthropicKey.slice(-4)})` : 'MISSING',
      VITE_SUPABASE_URL: supabaseUrl ? `set (${supabaseUrl})` : 'MISSING',
      VITE_SUPABASE_ANON_KEY: supabaseKey ? `set (${supabaseKey.slice(0, 18)}…)` : 'MISSING',
    },
    anthropic: { ok: false } as Record<string, any>,
    supabase: { ok: supabaseOk, note: supabaseNote },
    auth: { ok: false } as Record<string, any>,
  }

  // Anthropic ping (solo en modo detallado)
  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey })
      const r = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Responde solo: OK' }],
      })
      const text = r.content[0].type === 'text' ? r.content[0].text : ''
      checks.anthropic = { ok: true, reply: text }
    } catch (err: any) {
      checks.anthropic = { ok: false, error: err.message }
    }
  } else {
    checks.anthropic.error = 'ANTHROPIC_API_KEY no configurada'
  }

  // Auth check (si manda Authorization header)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ') && supabaseUrl && supabaseKey) {
    const token = authHeader.split(' ')[1]
    try {
      const sb = createClient(supabaseUrl, supabaseKey)
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) {
        checks.auth = { ok: false, error: error?.message || 'token inválido' }
      } else {
        checks.auth = { ok: true, userId: data.user.id, email: data.user.email }
        const userDb = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
        const { data: projects, error: pErr } = await userDb
          .from('projects')
          .select('id, name')
          .limit(5)
        checks.auth.projects_count = projects?.length ?? 0
        checks.auth.projects_sample = projects?.slice(0, 3)
        if (pErr) checks.auth.projects_error = pErr.message
      }
    } catch (err: any) {
      checks.auth = { ok: false, error: err.message }
    }
  } else {
    checks.auth.note = 'No Authorization header — envía Bearer token para probar JWT'
  }

  const allOk = checks.anthropic.ok && checks.supabase.ok
  return res.status(allOk ? 200 : 500).json(checks)
}
