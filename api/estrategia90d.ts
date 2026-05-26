import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import type { VercelRequest, VercelResponse } from "@vercel/node"

interface DayPiece {
  day: number
  date_label: string
  format: "Reel" | "Carrusel" | "Post" | "Story" | "Email"
  topic: string
  hook: string
  cta: string
  priority: "ALTA" | "MEDIA" | "BAJA"
}

interface Week {
  week: number
  month: number
  theme: string
  intensity: "ALTA" | "MEDIA" | "BAJA"
  days: DayPiece[]
}

interface Estrategia90DSchema {
  weeks: Week[]
}

// Lazy init Supabase client
function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

// Parse JSON with markdown stripping
function parseJSON<T>(raw: string): T {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (objMatch) cleaned = objMatch[0]
    else if (arrMatch) cleaned = arrMatch[0]
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`JSON parse failed. First 300 chars: ${raw.slice(0, 300)}`)
  }
}

// Generate content via Claude API
async function generate(anthropic: Anthropic, prompt: string, opts?: { model?: string; maxTokens?: number }) {
  const res = await anthropic.messages.create({
    model: opts?.model ?? 'claude-haiku-4-5-20251001',
    max_tokens: opts?.maxTokens ?? 4096,
    system: 'Devuelves SOLO JSON válido y completo. NO incluyas texto antes ni después. NO uses bloques de código markdown.',
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content[0].type === 'text' ? res.content[0].text : ''
}

// Build the estrategia 90D prompt with context
function buildPrompt(nicho: any, avatar: any, competencia: any): string {
  return `Eres un estratega de marketing digital especializado en estrategias de contenido de 90 días para agencias de IA.

CONTEXTO DEL NEGOCIO:
Nicho: ${JSON.stringify(nicho)}
Avatar del cliente ideal: ${JSON.stringify(avatar)}
Análisis de competencia: ${JSON.stringify(competencia)}

TAREA: Crea una estrategia de contenido de 90 DÍAS (13 semanas) altamente específica y optimizada para este negocio.

RESTRICCIONES Y REGLAS CRÍTICAS:
1. Week 1 DEBE tener 6-7 piezas de contenido con intensidad ALTA (SEMANA DE LANZAMIENTO)
2. Weeks 2-4 DEBEN tener exactamente 5 piezas cada una
3. Weeks 5-8 DEBEN tener exactamente 4 piezas cada una
4. Weeks 9-13 DEBEN tener 3-4 piezas cada una (totales: 3, 3, 4, 3, 4)

5. TEMAS POR MES (OBLIGATORIO):
   - Month 1 (Weeks 1-4): "Awareness + Lead Generation"
   - Month 2 (Weeks 5-8): "Nurturing + Conversion"
   - Month 3 (Weeks 9-13): "Loyalty + Referrals"

6. FORMATOS: Distribuye evitando repetir en la misma semana:
   - Reel (video corto, atrae atención)
   - Carrusel (educativo, 5-7 slides)
   - Post (larga forma, pensamiento)
   - Story (urgencia, cierre rápido)
   - Email (follow-up, valor directo)

7. CADA PIEZA DEBE INCLUIR:
   - topic: Tema específico del nicho (ej: "3 errores que impiden X")
   - hook: Apertura que atrapa (max 15 palabras, con emoción/curiosidad)
   - cta: Call-to-action claro (ej: "Reserva demo gratuita")
   - priority: ALTA (pieza clave de conversión), MEDIA (apoyo), BAJA (filler)

8. DATES: Asume inicio el Lunes 3 de Marzo 2025. Calcula todas las fechas correctamente.

GENERA UN JSON EXACTO CON ESTA ESTRUCTURA:
{
  "weeks": [
    {
      "week": 1,
      "month": 1,
      "theme": "Awareness + Lead Generation",
      "intensity": "ALTA",
      "days": [
        {
          "day": 1,
          "date_label": "Lunes 3 de Marzo",
          "format": "Reel",
          "topic": "3 errores que impiden que tu startup escale con IA",
          "hook": "El 87% de startups fallan por esto...",
          "cta": "Descarga nuestra guía gratuita",
          "priority": "ALTA"
        }
      ]
    }
  ]
}

Cálculo de fechas: Semana N = 7 días. Dentro de cada semana, distribuye los días(1-7).
formato date_label: "Día_semana Fecha de Mes" (ej: "Martes 4 de Marzo", "Miércoles 5 de Marzo")

IMPORTANTE:
- Cuentas de piezas RIGUROSAS (no negocies las cantidades)
- Temas ESPECÍFICOS al nicho/avatar (no genéricos)
- Hooks EMOCIONALES e IRRESISTIBLES
- CTAs que cierren acciones (demo, webinar, descarga, etc.)
- Distribución de formatos PAREJA a lo largo de todo el período

Devuelve SOLO el JSON. NADA MÁS.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const projectId = req.query.projectId as string

  if (!projectId) {
    return res.status(400).json({ error: 'projectId requerido' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const token = authHeader.split(' ')[1]
  const db = getDb(token)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    // ── Fetch nicho, avatar, competencia from DB ──────────────────────────────
    const [nichoRes, avatarRes, competenciaRes] = await Promise.all([
      db.from('project_nicho').select('data_json').eq('project_id', projectId).single(),
      db.from('project_avatar').select('data_json').eq('project_id', projectId).single(),
      db.from('project_competencia').select('data_json').eq('project_id', projectId).single(),
    ])

    const nicho = nichoRes.data?.data_json || {}
    const avatar = avatarRes.data?.data_json || {}
    const competencia = competenciaRes.data?.data_json || {}

    // Validate we have minimum context
    if (!nicho || Object.keys(nicho).length === 0) {
      return res.status(400).json({ error: 'No nicho data found. Run analysis first.' })
    }
    if (!avatar || Object.keys(avatar).length === 0) {
      return res.status(400).json({ error: 'No avatar data found. Run analysis first.' })
    }
    if (!competencia || Object.keys(competencia).length === 0) {
      return res.status(400).json({ error: 'No competencia data found. Run analysis first.' })
    }

    // ── Generate estrategia 90D ───────────────────────────────────────────────
    const prompt = buildPrompt(nicho, avatar, competencia)
    const rawResponse = await generate(anthropic, prompt, { maxTokens: 8192 })
    const schema = parseJSON<Estrategia90DSchema>(rawResponse)

    // Validate schema structure
    if (!schema.weeks || !Array.isArray(schema.weeks) || schema.weeks.length === 0) {
      throw new Error('Invalid schema: missing or empty weeks array')
    }

    // Basic validation of week structure
    for (const week of schema.weeks) {
      if (typeof week.week !== 'number' || typeof week.month !== 'number') {
        throw new Error(`Invalid week structure at week ${week.week}`)
      }
      if (!Array.isArray(week.days)) {
        throw new Error(`Invalid days array at week ${week.week}`)
      }
    }

    // Store result in DB
    await db.from('project_estrategia90d').upsert(
      {
        project_id: projectId,
        data_json: schema,
      },
      { onConflict: 'project_id' }
    )

    // Return response per requirements: { success: true, content: jsonString }
    return res.status(200).json({
      success: true,
      content: JSON.stringify(schema),
    })
  } catch (error: any) {
    console.error(`[estrategia90d/${projectId}]`, error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Error generando estrategia 90D',
      projectId,
      hint: 'Asegúrate de que nicho, avatar y competencia estén generados primero',
    })
  }
}
