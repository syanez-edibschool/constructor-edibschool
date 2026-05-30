import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import type { VercelRequest, VercelResponse } from "@vercel/node"

function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

function parseJSON<T = any>(raw: string): T {
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
    throw new Error(`JSON parse falló. Primeros 300 chars: ${raw.slice(0, 300)}`)
  }
}

async function generate(anthropic: Anthropic, prompt: string, opts?: { model?: string; maxTokens?: number }) {
  const res = await anthropic.messages.create({
    model: opts?.model ?? 'claude-haiku-4-5-20251001', // Haiku por defecto: 3-5x más rápido
    max_tokens: opts?.maxTokens ?? 2048,
    system: 'Devuelves SOLO JSON válido y completo. NO incluyas texto antes ni después. NO uses bloques de código markdown.',
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content[0].type === 'text' ? res.content[0].text : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const operation = req.query.operation as string
  const projectId = req.query.projectId as string

  if (!projectId || !operation) {
    return res.status(400).json({ error: 'projectId y operation requeridos' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  const token = authHeader.split(' ')[1]
  const db = getDb(token)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    // ── Fetch project answers for context ─────────────────────────────────────
    const { data: questionsRow } = await db
      .from('project_questions')
      .select('answers_json')
      .eq('project_id', projectId)
      .single()

    const answers = questionsRow?.answers_json || {}
    const ctx = JSON.stringify(answers)

    // ── GENERATE nicho + avatar + competencia ─────────────────────────────────
    if (operation === 'generate') {
      const [nichoRaw, avatarRaw, compRaw] = await Promise.all([
        generate(anthropic, `
Basado en estas respuestas de un emprendedor que quiere crear una agencia de IA:
${ctx}

Genera un análisis de nicho detallado en formato JSON:
{
  "sector": "nombre del sector específico",
  "micronicho": "descripción del micronicho exacto",
  "tam": "rango de potenciales clientes (ej: 15,000-20,000)",
  "ticket": "rango de precio mensual recomendado (ej: €2,500-4,500/mes)",
  "trend": "crecimiento anual estimado (ej: ↑ 22% anual)",
  "momento": "¿Es buen momento para entrar? (1 oración)",
  "razon": "Explicación de 2-3 oraciones de por qué este nicho es ideal ahora mismo para una agencia de IA"
}`),

        generate(anthropic, `
Basado en estas respuestas del emprendedor:
${ctx}

Crea un avatar de cliente ideal VIVIDO y detallado en JSON:
{
  "name": "nombre ficticio realista",
  "age": "rango de edad (ej: 38-45 años)",
  "position": "cargo/posición exacta",
  "experience": "años de experiencia en el sector",
  "income": "rango de ingresos mensuales",
  "goals": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "pains": ["dolor 1", "dolor 2", "dolor 3"],
  "narrative": "Historia de 3-4 oraciones en primera persona que describe UN DÍA en su vida, sus frustraciones, y por qué necesita ayuda de IA"
}`),

        generate(anthropic, `
Basado en estas respuestas del emprendedor:
${ctx}

Genera un análisis de competencia en JSON:
{
  "competitors": [
    {
      "name": "nombre realista de competidor tipo",
      "price": "rango de precio que cobran",
      "strengths": ["fortaleza 1", "fortaleza 2"],
      "weaknesses": ["debilidad 1", "debilidad 2"],
      "gap": "oportunidad específica contra este competidor (1 oración)"
    }
  ],
  "positioning": "Posicionamiento único recomendado de 1-2 oraciones para diferenciarse",
  "opportunity": "La mayor oportunidad de mercado que existe ahora mismo (2 oraciones)"
}
Incluye exactamente 3 competidores.`),
      ])

      const nicho = parseJSON(nichoRaw)
      const avatar = parseJSON(avatarRaw)
      const competencia = parseJSON(compRaw)

      const results = await Promise.allSettled([
        db.from('project_nicho').upsert({
          project_id: projectId,
          sector: nicho.sector,
          micronicho: nicho.micronicho,
          tam: nicho.tam,
          ticket: nicho.ticket,
          trend: nicho.trend,
          momento: nicho.momento,
          data_json: JSON.stringify(nicho),
        }, { onConflict: 'project_id' }),
        db.from('project_avatar').upsert({
          project_id: projectId,
          name: avatar.name,
          age: avatar.age,
          data_json: JSON.stringify(avatar),
        }, { onConflict: 'project_id' }),
        db.from('project_competencia').upsert({
          project_id: projectId,
          data_json: JSON.stringify(competencia),
        }, { onConflict: 'project_id' }),
      ])

      // Verificar si hubo errores en las inserciones
      const errors = results.map((r, i) => {
        if (r.status === 'rejected') {
          const tables = ['project_nicho', 'project_avatar', 'project_competencia']
          return `Error al guardar ${tables[i]}: ${r.reason?.message || r.reason}`
        }
        if (r.status === 'fulfilled' && r.value.error) {
          const tables = ['project_nicho', 'project_avatar', 'project_competencia']
          return `Error Supabase en ${tables[i]}: ${JSON.stringify(r.value.error)}`
        }
        return null
      }).filter(Boolean)

      if (errors.length > 0) {
        console.error('[analysis/generate] Save errors:', errors)
        return res.status(500).json({
          error: 'Error al guardar análisis',
          details: errors,
          nicho,
          avatar,
          competencia,
        })
      }

      return res.status(200).json({ nicho, avatar, competencia })
    }

    // ── UPDATE nicho ──────────────────────────────────────────────────────────
    if (operation === 'update-nicho') {
      const { feedback } = req.body
      const raw = await generate(anthropic, `
El usuario quiere modificar el análisis de nicho. Feedback: "${feedback}"
Respuestas originales: ${ctx}
Genera un nuevo nicho JSON con los mismos campos: sector, micronicho, tam, ticket, trend, momento, razon.`)
      const nicho = parseJSON(raw)
      const result = await db.from('project_nicho').upsert({
        project_id: projectId,
        sector: nicho.sector,
        micronicho: nicho.micronicho,
        tam: nicho.tam,
        ticket: nicho.ticket,
        trend: nicho.trend,
        momento: nicho.momento,
        data_json: JSON.stringify(nicho),
      }, { onConflict: 'project_id' })
      if (result.error) {
        console.error('[analysis/update-nicho] Save error:', result.error)
        return res.status(500).json({ error: 'Error al guardar nicho', details: result.error })
      }
      return res.status(200).json({ nicho })
    }

    // ── UPDATE avatar ─────────────────────────────────────────────────────────
    if (operation === 'update-avatar') {
      const { feedback } = req.body
      const raw = await generate(anthropic, `
El usuario quiere modificar el avatar. Feedback: "${feedback}"
Respuestas originales: ${ctx}
Genera un nuevo avatar JSON con los mismos campos: name, age, position, experience, income, goals, pains, narrative.`)
      const avatar = parseJSON(raw)
      const result = await db.from('project_avatar').upsert({
        project_id: projectId,
        name: avatar.name,
        age: avatar.age,
        data_json: JSON.stringify(avatar),
      }, { onConflict: 'project_id' })
      if (result.error) {
        console.error('[analysis/update-avatar] Save error:', result.error)
        return res.status(500).json({ error: 'Error al guardar avatar', details: result.error })
      }
      return res.status(200).json({ avatar })
    }

    // ── UPDATE competencia ────────────────────────────────────────────────────
    if (operation === 'update-competencia') {
      const { feedback } = req.body
      const raw = await generate(anthropic, `
El usuario quiere modificar el análisis de competencia. Feedback: "${feedback}"
Respuestas originales: ${ctx}
Genera un nuevo análisis JSON con: competitors (3), positioning, opportunity.`)
      const competencia = parseJSON(raw)
      const result = await db.from('project_competencia').upsert({
        project_id: projectId,
        data_json: JSON.stringify(competencia),
      }, { onConflict: 'project_id' })
      if (result.error) {
        console.error('[analysis/update-competencia] Save error:', result.error)
        return res.status(500).json({ error: 'Error al guardar competencia', details: result.error })
      }
      return res.status(200).json({ competencia })
    }

    return res.status(400).json({ error: `Operación desconocida: ${operation}` })
  } catch (error: any) {
    console.error(`[analysis/${operation}]`, error)
    return res.status(500).json({
      error: error.message || 'Error en análisis',
      operation,
      projectId,
      hint: 'Visita /api/health desde el navegador para verificar configuración de Vercel',
    })
  }
}
