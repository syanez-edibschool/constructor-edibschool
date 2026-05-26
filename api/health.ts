import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {},
    anthropic: { ok: false },
    supabase: { ok: false },
    auth: { ok: false },
  }

  // ── ENV VARS ──────────────────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  checks.env = {
    ANTHROPIC_API_KEY: anthropicKey ? `set (${anthropicKey.slice(0, 12)}…${anthropicKey.slice(-4)})` : 'MISSING',
    VITE_SUPABASE_URL: supabaseUrl ? `set (${supabaseUrl})` : 'MISSING',
    VITE_SUPABASE_ANON_KEY: supabaseKey ? `set (${supabaseKey.slice(0, 18)}…)` : 'MISSING',
  }

  // ── ANTHROPIC PING ────────────────────────────────────────────────────────
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

  // ── SUPABASE PING ─────────────────────────────────────────────────────────
  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey)
      const { error } = await sb.from('projects').select('id').limit(1)
      // RLS without JWT should return 0 rows but no error (or specific RLS error)
      checks.supabase = { ok: true, note: error ? `query error: ${error.message}` : 'conexión OK' }
    } catch (err: any) {
      checks.supabase = { ok: false, error: err.message }
    }
  } else {
    checks.supabase.error = 'Supabase env vars no configuradas'
  }

  // ── AUTH CHECK (si manda Authorization header) ────────────────────────────
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

        // Test RLS: try to fetch user's projects
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
