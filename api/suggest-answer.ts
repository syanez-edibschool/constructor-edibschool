import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })
    }

    const { projectId, toolId, questionId, questionLabel, questionType, options, existingAnswers } = req.body
    if (!projectId || !questionLabel) {
      return res.status(400).json({ error: 'projectId y questionLabel requeridos' })
    }

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' })
    }
    const token = authHeader.split(' ')[1]
    const db = getDb(token)

    // Fetch project context (nicho, avatar, competencia, otros tools)
    const [nichoRow, avatarRow, compRow, questionsRow, otherToolsRes] = await Promise.all([
      db.from('project_nicho').select('data_json').eq('project_id', projectId).maybeSingle(),
      db.from('project_avatar').select('data_json').eq('project_id', projectId).maybeSingle(),
      db.from('project_competencia').select('data_json').eq('project_id', projectId).maybeSingle(),
      db.from('project_questions').select('answers_json').eq('project_id', projectId).maybeSingle(),
      db.from('project_tools').select('tool_id, result_json').eq('project_id', projectId),
    ])

    const answers = questionsRow.data?.answers_json || {}
    const cloneWinner = (otherToolsRes.data || []).find(t => t.tool_id === 'clone-winner')?.result_json

    // Fuera del recorte de 1500 caracteres a propósito: es el dato que MANDA.
    const nichoLibre = String((answers as Record<string, unknown>)?.nicho_libre ?? '').trim()

    const ctx = `
CONTEXTO DEL PROYECTO:
${nichoLibre ? `- NICHO EXACTO (en palabras del alumno, MANDA sobre lo demás): "${nichoLibre}"` : ''}
- Perfil del negocio: ${JSON.stringify(answers).slice(0, 1500)}
- Nicho: ${JSON.stringify(nichoRow.data?.data_json || {}).slice(0, 800)}
- Avatar ideal: ${JSON.stringify(avatarRow.data?.data_json || {}).slice(0, 800)}
- Competencia: ${JSON.stringify(compRow.data?.data_json || {}).slice(0, 600)}
${cloneWinner ? `- Clone ganador (referencia): ${JSON.stringify(cloneWinner).slice(0, 800)}` : ''}

${toolId ? `Estamos generando la herramienta: ${toolId}` : ''}
${existingAnswers && Object.keys(existingAnswers).length > 0 ? `Otras respuestas ya dadas en esta herramienta:\n${Object.entries(existingAnswers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}`

    const isSelect = questionType === 'select' && Array.isArray(options) && options.length > 0
    const instruction = isSelect
      ? `De las siguientes opciones, elige la MÁS ALINEADA al contexto del negocio:
${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}

Responde SOLO con el texto exacto de la opción (sin número, sin explicación, sin comillas).`
      : `Responde la pregunta directamente con texto plano, sin markdown, sin asteriscos.
${questionType === 'textarea'
  ? 'Respuesta de 2-4 frases CONCRETAS y específicas al negocio del usuario. NO genérica.'
  : 'Respuesta CORTA (máximo 1 frase o 15 palabras). Específica al negocio.'}`

    const prompt = `${ctx}

PREGUNTA QUE DEBES RESPONDER (questionId: ${questionId || 'N/A'}):
"${questionLabel}"

${instruction}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: questionType === 'textarea' ? 400 : 100,
      system: 'Eres un experto en marketing digital y agencias de IA. Generas respuestas concretas, específicas al negocio del usuario (usa su nicho, avatar, competencia). NO uses markdown, asteriscos ni viñetas. Solo texto plano directo. Ortografía impecable: las tildes son OBLIGATORIAS y también se escriben en MAYÚSCULAS, y respetas las tildes diacríticas y los signos ¿ ¡.',
      messages: [{ role: 'user', content: prompt }],
    })

    let suggestion = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    // Limpieza: si Claude puso comillas envolventes, quitarlas
    suggestion = suggestion.replace(/^["']|["']$/g, '').trim()

    return res.status(200).json({ suggestion })
  } catch (error: any) {
    console.error('[suggest-answer]', error)
    return res.status(500).json({ error: error.message || 'Error generando sugerencia' })
  }
}
