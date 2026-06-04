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
    const { message, projectId, history } = req.body
    if (!message) return res.status(400).json({ error: 'Message requerido' })

    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

    let projectContext = ''

    if (token) {
      const db = getDb(token)

      if (projectId) {
        // Contexto específico del proyecto abierto
        const [projectRes, nichoRes, avatarRes] = await Promise.all([
          db.from('projects').select('name, description').eq('id', projectId).single(),
          db.from('project_nicho').select('data_json').eq('project_id', projectId).single(),
          db.from('project_avatar').select('data_json').eq('project_id', projectId).single(),
        ])

        const project = projectRes.data
        const nicho = nichoRes.data?.data_json as Record<string, string> | null
        const avatar = avatarRes.data?.data_json as Record<string, string> | null

        const lines: string[] = ['El usuario está trabajando en este proyecto:']
        if (project?.name) lines.push(`- Proyecto: ${project.name}`)
        if (project?.description) lines.push(`- Descripción: ${project.description}`)
        if (nicho?.sector) lines.push(`- Sector: ${nicho.sector}`)
        if (nicho?.micronicho) lines.push(`- Micronicho: ${nicho.micronicho}`)
        if (nicho?.ticket) lines.push(`- Ticket promedio: ${nicho.ticket}`)
        if (nicho?.tam) lines.push(`- Tamaño de mercado: ${nicho.tam}`)
        if (avatar?.name) lines.push(`- Cliente ideal: ${avatar.name}${avatar.position ? `, ${avatar.position}` : ''}`)
        if (avatar?.pains) {
          const pains = Array.isArray(avatar.pains) ? avatar.pains.join(', ') : String(avatar.pains)
          lines.push(`- Dolores del cliente: ${pains}`)
        }
        if (avatar?.goals) {
          const goals = Array.isArray(avatar.goals) ? avatar.goals.join(', ') : String(avatar.goals)
          lines.push(`- Objetivos del cliente: ${goals}`)
        }
        projectContext = lines.join('\n')

      } else {
        // En el dashboard — contexto global de todos los proyectos del usuario
        const { data: projects } = await db
          .from('projects')
          .select('id, name, description')
          .limit(10)

        if (projects && projects.length > 0) {
          const lines: string[] = [`El usuario tiene ${projects.length} proyecto(s) en la plataforma:`]
          for (const p of projects) {
            lines.push(`- ${p.name || 'Sin nombre'}${p.description ? `: ${p.description}` : ''}`)
          }
          lines.push('El usuario está en el Dashboard general (no dentro de un proyecto específico).')
          projectContext = lines.join('\n')
        }
      }
    }

    const systemPrompt = `Eres un coach experto en marketing digital, ventas y construcción de agencias de IA.
Ayudas a emprendedores a crear y escalar sus agencias. Eres directo, concreto y accionable.

FORMATO DE RESPUESTA (muy importante):
- Responde en español
- Máximo 4 bloques cortos separados por saltos de línea
- Usa listas con guiones (-) para puntos clave
- Sin asteriscos, sin markdown, sin negritas con **
- Frases cortas y directas, no párrafos largos
- Si das pasos, numéralos: 1. 2. 3.

${projectContext ? `CONTEXTO DEL USUARIO:\n${projectContext}` : ''}`

    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content })
        }
      }
    }
    messages.push({ role: 'user', content: message })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return res.status(200).json({ message: reply })
  } catch (error: any) {
    console.error('Coach error:', error)
    return res.status(500).json({ error: error.message || 'Error en coach' })
  }
}
