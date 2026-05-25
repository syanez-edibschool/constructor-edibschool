import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
dotenv.config()

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function testAnthropic() {
  console.log('🧪 Testing Anthropic connection...')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in .env')
    process.exit(1)
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Responde con un emoji y una palabra que describa que estés funcionando.' }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('✅ Anthropic API funcionando!')
    console.log('Respuesta:', text)
  } catch (error: any) {
    console.error('❌ Error conectando con Anthropic:', error?.message || error)
    process.exit(1)
  }
}

testAnthropic()
