import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateWithOpenAI(prompt: string, model = 'gpt-4o-mini'): Promise<string> {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Eres un experto en estrategia de negocios digitales, marketing y agencias de IA. Responde siempre en español. Devuelve SOLO JSON válido cuando se te pida, sin texto adicional ni markdown.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  })

  return completion.choices[0].message.content || ''
}

export { openai }
