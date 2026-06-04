import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
}

function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

// Repara JSON truncado: cierra strings, arrays y objetos que quedaron abiertos
// (cuando la respuesta de la IA se corta por el límite de tokens).
function repairTruncatedJSON(input: string): string {
  let str = input.trim()
  const stack: string[] = []
  let inStr = false
  let escaped = false
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') stack.push('}')
    else if (c === '[') stack.push(']')
    else if (c === '}' || c === ']') stack.pop()
  }
  if (inStr) str += '"'
  // Quita coma colgante o clave incompleta al final
  str = str.replace(/,\s*$/, '').replace(/,\s*"[^"]*$/, '').replace(/:\s*$/, ': null')
  while (stack.length) str += stack.pop()
  return str
}

function parseJson(raw: string): unknown {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/)
    if (match) cleaned = match[0]
  }
  // 1º intento: parse directo. 2º intento: reparando JSON truncado.
  try {
    return JSON.parse(cleaned)
  } catch {
    return JSON.parse(repairTruncatedJSON(cleaned))
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { projectId, cloneGanadorData } = req.body

    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

    let projectContext = ''
    if (token && projectId) {
      const db = getDb(token)
      const [projRes, nichoRes, avatarRes] = await Promise.all([
        db.from('projects').select('name, description').eq('id', projectId).single(),
        db.from('project_nicho').select('*').eq('project_id', projectId).maybeSingle(),
        db.from('project_avatar').select('*').eq('project_id', projectId).maybeSingle(),
      ])
      const p = projRes.data
      // data_json puede venir como string (JSON.stringify), objeto, o vacío.
      // Si está vacío usamos las columnas individuales como fallback.
      const norm = (row: Record<string, unknown> | null): Record<string, unknown> | null => {
        if (!row) return null
        let dj: unknown = row.data_json
        if (typeof dj === 'string') { try { dj = JSON.parse(dj) } catch { /* keep */ } }
        if (dj && typeof dj === 'object' && Object.keys(dj as object).length > 0) return dj as Record<string, unknown>
        return row // fallback: usa las columnas sueltas (sector, micronicho, name, etc.)
      }
      const n = norm(nichoRes.data) as Record<string, string> | null
      const av = norm(avatarRes.data) as Record<string, string> | null
      const lines: string[] = []
      if (p?.name) lines.push(`Proyecto: ${p.name}`)
      if (p?.description) lines.push(`Descripción: ${p.description}`)
      if (n?.sector) lines.push(`Sector: ${n.sector}`)
      if (n?.micronicho) lines.push(`Micronicho: ${n.micronicho}`)
      if (n?.ticket) lines.push(`Ticket promedio: ${n.ticket}`)
      if (av?.name) lines.push(`Cliente ideal: ${av.name}`)
      if (av?.pains) lines.push(`Dolores: ${Array.isArray(av.pains) ? av.pains.join(', ') : av.pains}`)
      projectContext = lines.join('\n')
    }

    const cloneContext = cloneGanadorData
      ? `DATOS DE CLONE THE WINNER (ganador: ${cloneGanadorData.handle}):
- Engagement rate: ${cloneGanadorData.executive_summary?.engagement_rate}
- Posts/semana: ${cloneGanadorData.executive_summary?.posts_per_week}
- Factores de éxito: ${cloneGanadorData.executive_summary?.key_success_factors?.join(', ')}
- Top hooks: ${cloneGanadorData.copy_analysis?.top_hooks?.slice(0, 3).map((h: any) => h.hook).join('; ')}
- Top CTAs: ${cloneGanadorData.copy_analysis?.top_ctas?.slice(0, 3).map((c: any) => c.cta).join('; ')}
- Tono de voz: ${cloneGanadorData.copy_analysis?.tone_of_voice}
- Mix de contenido: ${cloneGanadorData.content_mix?.map((c: any) => `${c.type} ${c.percentage}%`).join(', ')}
- Tareas semana 1: ${cloneGanadorData.implementation_plan?.week1?.tasks?.join(', ')}`
      : ''

    const client = getClient()

    // ── STEP 1: Generate phases with all tasks ────────────────────────────────
    const phasesPrompt = `Eres un experto en agencias de IA. Genera las FASES de un plan de 90 días para lanzar una agencia de IA.
${projectContext ? `\nCONTEXTO:\n${projectContext}` : ''}
${cloneContext ? `\n${cloneContext}` : ''}

REGLAS GLOBALES OBLIGATORIAS (aplican a TODAS las tareas, sin excepción):
- NO menciones ningún nombre propio de persona ni de marca específica en ninguna tarea.
- NO incluyas precios ni tarifas de servicios en ninguna parte. La ÚNICA cifra de dinero permitida es el presupuesto de campañas: 5 € al día de media.
- NO menciones ningún software fuera de estos cuatro: Claude, ChatGPT, GoHighLevel y Notion. PROHIBIDO mencionar ManyChat, Calendly, Mailchimp, Zapier o cualquier otro.
- NUNCA repitas una tarea ya mencionada en una fase anterior (ej: si ya dijiste "configurar CRM", no lo vuelvas a poner en fases posteriores).
- El lead magnet se capta y se entrega SIEMPRE por CHAT/DM, NUNCA por email.
- En lugar de "social proof" o "prueba social", usa SIEMPRE la palabra "demos".
- El CTA de TODAS las tareas de MOFU es exactamente "agendar demo".
- PROHIBIDO incluir tareas de "documentar objeciones, dolores y lenguaje" o de "ajustar propuesta y PUV".

ASIGNACIÓN DE HERRAMIENTA POR TAREA (rellena el campo "tool"):
- Diseño de lead magnet y tareas de contenido/diseño → "Claude"
- Generación de imágenes → "ChatGPT"
- Documento de oferta final con entregables en Notion → "Claude"
- Sitios, dominios, funnels y todo lo relacionado → "GoHighLevel"
- Agentes / automatizaciones de DMs → "GoHighLevel"
- Todo lo de TOFU → "Claude"
- Si una tarea no encaja en ninguna, deja "tool": "".

Responde SOLO JSON válido sin markdown. Estructura exacta:
{
  "phases": [
    {
      "id": "fase-2",
      "phase": 2,
      "title": "Construcción de Oferta",
      "color": "#00D9FF",
      "week_start": 1,
      "week_end": 2,
      "tasks": [
        {"id": "f2-t1", "task": "Diseñar la oferta irresistible", "completed": false, "week": 1, "day": 1, "priority": "alta", "source": "plan_agencia", "tool": "Claude"}
      ]
    }
  ]
}

FASES REQUERIDAS:
- Fase 2 "Construcción de Oferta" (sem 1-2): definir la oferta irresistible, diseñar el lead magnet (captado y entregado por CHAT, nunca email), documento de oferta final con entregables en Notion, validación con 5 prospectos. 12 tareas.
- Fase 3 "Infraestructura Digital" (sem 2-4): montar sitio/funnel/dominio en GoHighLevel, sistema de agendamiento en GoHighLevel, agente IA de DMs en GoHighLevel. 15 tareas.
- Fase 4 "Instagram Estratégico" (sem 3-8): perfil, 9 posts iniciales, carruseles, reels, imágenes, follows, DMs de prospección. 20 tareas.
- Fase 5 "Prospección Activa" (sem 1-13, paralelo): 30 contactos/día, configurar CRM en GoHighLevel (una sola vez en todo el plan), follow-up 48-72h. 10 tareas recurrentes.
- Fase 6 "Publicidad Paga" (sem 9-13): contenido TOFU, MOFU de captación con CTA "agendar demo", BOFU de retargeting con demos, campañas con presupuesto medio de 5 € al día, optimización. 12 tareas.
${cloneGanadorData ? `Las primeras 3 tareas de fase 2 semana 1 deben basarse en Clone The Winner con source="clone_ganador".` : ''}

Distribuye las tareas con week 1-13 y day 1-7. Genera al menos 65 tareas en total. Incluye el campo "tool" en CADA tarea según la asignación de arriba.`

    const phasesResp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10000,
      messages: [{ role: 'user', content: phasesPrompt }],
    })

    const phasesRaw = phasesResp.content[0].type === 'text' ? phasesResp.content[0].text : ''
    const phasesData = parseJson(phasesRaw) as { phases: unknown[] }

    if (!phasesData.phases || phasesData.phases.length === 0) {
      throw new Error('No se generaron fases. Intenta de nuevo.')
    }

    // ── STEP 2: Generate weeks calendar ──────────────────────────────────────
    // Extract task IDs grouped by week for the prompt
    const tasksByWeek: Record<number, string[]> = {}
    for (const phase of phasesData.phases as any[]) {
      for (const task of phase.tasks || []) {
        const w = task.week || 1
        if (!tasksByWeek[w]) tasksByWeek[w] = []
        tasksByWeek[w].push(`${task.id}(día ${task.day || 1})`)
      }
    }

    const weeksContext = Object.entries(tasksByWeek)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([w, ids]) => `Semana ${w}: ${ids.join(', ')}`)
      .join('\n')

    const weeksPrompt = `Genera el calendario de 13 semanas para un plan de agencia de IA.
Tienes estas tareas distribuidas por semana (id tarea con su día):
${weeksContext}

Responde SOLO JSON válido sin markdown. Estructura exacta:
{
  "weeks": [
    {
      "week": 1,
      "label": "SEMANA DE LANZAMIENTO",
      "is_launch": true,
      "days": [
        {"day": 1, "label": "Lunes", "tasks": ["f2-t1", "f5-t1"]},
        {"day": 2, "label": "Martes", "tasks": ["f2-t2"]},
        {"day": 3, "label": "Miércoles", "tasks": ["f2-t3", "f5-t2"]},
        {"day": 4, "label": "Jueves", "tasks": ["f3-t1"]},
        {"day": 5, "label": "Viernes", "tasks": ["f3-t2", "f5-t3"]},
        {"day": 6, "label": "Sábado", "tasks": []},
        {"day": 7, "label": "Domingo", "tasks": []}
      ]
    }
  ]
}

Reglas:
- Genera las 13 semanas completas (semana 1 a 13)
- Semana 1 is_launch: true, las demás false
- Distribuye los task IDs de cada semana en los días lunes-viernes principalmente
- Cada día: 1-4 task IDs máximo
- Usa los IDs exactos de las tareas que te di arriba
- Day labels: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo`

    const weeksResp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: weeksPrompt }],
    })

    const weeksRaw = weeksResp.content[0].type === 'text' ? weeksResp.content[0].text : ''

    let weeksData: { weeks: unknown[] } = { weeks: [] }
    try {
      weeksData = parseJson(weeksRaw) as { weeks: unknown[] }
    } catch {
      // weeks calendar is optional — fall back to empty
    }

    const combined = {
      phases: phasesData.phases,
      weeks: weeksData.weeks || [],
    }

    return res.status(200).json({ success: true, content: JSON.stringify(combined) })
  } catch (error: any) {
    console.error('Estrategia 90D error:', error)
    return res.status(500).json({ error: error.message || 'Error generando estrategia' })
  }
}
