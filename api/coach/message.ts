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

    // Fetch project context from Supabase using user's JWT (respects RLS)
    let projectContext = ''
    if (projectId && token) {
      const db = getDb(token)
      const [projectRes, nichoRes, avatarRes] = await Promise.all([
        db.from('projects').select('name, description').eq('id', projectId).single(),
        db.from('project_nicho').select('data_json').eq('project_id', projectId).single(),
        db.from('project_avatar').select('data_json').eq('project_id', projectId).single(),
      ])

      const project = projectRes.data
      const nicho = nichoRes.data?.data_json as Record<string, string> | null
      const avatar = avatarRes.data?.data_json as Record<string, string> | null

      if (project || nicho || avatar) {
        projectContext = `Contexto del proyecto del usuario:
${project?.name ? `- Proyecto: ${project.name}` : ''}
${project?.description ? `- Descripción: ${project.description}` : ''}
${nicho?.sector ? `- Sector/Nicho: ${nicho.sector}` : ''}
${nicho?.micronicho ? `- Micronicho: ${nicho.micronicho}` : ''}
${nicho?.ticket ? `- Ticket promedio: ${nicho.ticket}` : ''}
${avatar?.name ? `- Cliente ideal: ${avatar.name}, ${avatar.position || ''}` : ''}
${avatar?.pains ? `- Principales dolores del cliente: ${Array.isArray(avatar.pains) ? avatar.pains.join(', ') : avatar.pains}` : ''}
${avatar?.goals ? `- Objetivos del cliente: ${Array.isArray(avatar.goals) ? avatar.goals.join(', ') : avatar.goals}` : ''}`
      }
    }

    const systemPrompt = `Eres un coach experto en marketing digital, ventas y construcción de agencias de IA.
Ayudas a emprendedores a crear y escalar sus agencias. Eres directo, concreto y accionable.
Respondes en español. Máximo 3-4 párrafos. Sin rodeos ni relleno.
${projectContext ? `\n${projectContext}\n\nUsa este contexto para personalizar tus respuestas al proyecto específico del usuario.` : ''}`

    // Build conversation history for multi-turn context
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content })
        }
      }
    }
    messages.push({ role: 'user', content: message })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
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
