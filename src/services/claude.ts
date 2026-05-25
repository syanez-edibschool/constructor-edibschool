import { api } from './api'

export async function generateWithClaude(prompt: string, maxTokens?: number): Promise<string> {
  const { data } = await api.post('/claude/generate', { prompt, maxTokens })
  return data.content
}

export async function coachChat(
  message: string,
  context?: Record<string, unknown>,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const { data } = await api.post('/claude/chat', { message, context, history })
  return data.message
}

export async function analyzeCompetitor(prompt: string, url?: string): Promise<string> {
  const { data } = await api.post('/claude/analyze-competitor', { prompt, url })
  return data.analysis
}
