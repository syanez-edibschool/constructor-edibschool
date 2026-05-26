import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { message, context } = req.body
    if (!message) return res.status(400).json({ error: 'Message requerido' })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `${context || ''}\n\n${message}` }],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return res.status(200).json({ message: reply })
  } catch (error: any) {
    console.error('Coach error:', error)
    return res.status(500).json({ error: error.message || 'Error en coach' })
  }
}
