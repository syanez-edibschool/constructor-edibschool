import Anthropic from '@anthropic-ai/sdk'

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY no está configurada')
  return new Anthropic({ apiKey: key })
}

const DEFAULT_SYSTEM = 'Eres un experto en estrategia de negocios, copywriting y psicología del consumidor. Responde siempre en español. Devuelve SOLO JSON válido cuando se te pida, sin texto adicional ni markdown.'

export async function generateWithClaude(prompt: string, systemPrompt?: string): Promise<string> {
  const anthropic = getClient()
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
  const anthropic = getClient()
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemPrompt,
    messages,
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}
