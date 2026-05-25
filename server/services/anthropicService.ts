import Anthropic from '@anthropic-ai/sdk'
import { generateWithOpenAI } from './openaiService'

const DEFAULT_SYSTEM = 'Eres un experto en estrategia de negocios, copywriting y psicología del consumidor. Responde siempre en español. Devuelve SOLO JSON válido cuando se te pida, sin texto adicional ni markdown.'

export async function generateWithClaude(prompt: string, systemPrompt?: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateWithOpenAI(prompt)
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: systemPrompt || DEFAULT_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function generateCoachReply(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || ''
    return generateWithOpenAI(`${systemPrompt}\n\nUser: ${lastUser}\nAssistant:`)
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemPrompt,
    messages,
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}
