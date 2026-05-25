import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { generateWithClaude, generateCoachReply } from '../services/anthropicService'

const router = Router()
router.use(requireAuth as any)

// POST /claude/generate — generic content generation
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, maxTokens } = req.body as { prompt: string; maxTokens?: number }
    if (!prompt) { res.status(400).json({ error: 'prompt requerido' }); return }

    const content = await generateWithClaude(prompt)
    res.json({ content })
  } catch (err: any) {
    console.error('[claude/generate]', err?.message || err)
    res.status(500).json({ error: err?.message || 'Error generating content' })
  }
})

// POST /claude/chat — generic AI chat (coach-style)
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { message, context, history = [] } = req.body as {
      message: string
      context?: Record<string, unknown>
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    }
    if (!message) { res.status(400).json({ error: 'message requerido' }); return }

    const systemPrompt = `Eres un experto en estrategia de negocios y agencias de IA. Responde siempre en español de forma directa y útil.${context ? `\n\nContexto del proyecto: ${JSON.stringify(context)}` : ''}`

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history.slice(-6),
      { role: 'user', content: message },
    ]

    const reply = await generateCoachReply(messages, systemPrompt)
    res.json({ message: reply.trim() })
  } catch (err: any) {
    console.error('[claude/chat]', err?.message || err)
    res.status(500).json({ error: err?.message || 'Chat error' })
  }
})

// POST /claude/analyze-competitor — competitor analysis
router.post('/analyze-competitor', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body as { url?: string; prompt: string }
    if (!prompt) { res.status(400).json({ error: 'prompt requerido' }); return }

    const analysis = await generateWithClaude(prompt)
    res.json({ analysis })
  } catch (err: any) {
    console.error('[claude/analyze-competitor]', err?.message || err)
    res.status(500).json({ error: err?.message || 'Analysis error' })
  }
})

export default router
