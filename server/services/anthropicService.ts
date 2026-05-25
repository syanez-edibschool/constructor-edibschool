import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DEFAULT_SYSTEM = 'Eres un experto en estrategia de negocios, copywriting y psicología del consumidor. Responde siempre en español. Devuelve SOLO JSON válido cuando se te pida, sin texto adicional ni markdown.'

export async function generateWithClaude(prompt: string, systemPrompt?: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
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
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemPrompt,
    messages,
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}
