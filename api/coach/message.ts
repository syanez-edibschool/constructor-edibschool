import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { message, projectId, context, history } = req.body
    if (!message) return res.status(400).json({ error: 'Message requerido' })

    // Fetch project context from Supabase if projectId is provided
    let projectContext = context || ''
    if (projectId) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: project } = await supabase
          .from('projects')
          .select('name, niche, avatar, description')
          .eq('id', projectId)
          .single()
        if (project) {
          projectContext = `Contexto del proyecto:
- Nombre: ${project.name || 'No definido'}
- Nicho: ${project.niche || 'No definido'}
- Avatar/Cliente ideal: ${project.avatar || 'No definido'}
- Descripción: ${project.description || 'No definida'}

${context || ''}`
        }
      }
    }

    const systemPrompt = `Eres un coach experto en marketing digital, ventas y construcción de agencias.
Ayudas a emprendedores a crear y escalar sus agencias de marketing digital.
Respondes en español, de forma clara, directa y accionable.
Máximo 3-4 párrafos por respuesta. Sin rodeos.
${projectContext ? `\n${projectContext}` : ''}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Build conversation history for multi-turn context
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (history && Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content })
        }
      }
    }
    messages.push({ role: 'user', content: message })

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
