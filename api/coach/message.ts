import Anthropic from '@anthropic-ai/sdk'
import type { IncomingMessage, ServerResponse } from 'http'

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: key })
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

  try {
    const { message, context } = req.body ?? {}

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `${context || ''}\n\n${message}` }],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 200
    res.end(JSON.stringify({ message: reply }))
  } catch (error: any) {
    console.error('Coach error:', error)
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 500
    res.end(JSON.stringify({ error: String(error?.message || error) }))
  }
}
