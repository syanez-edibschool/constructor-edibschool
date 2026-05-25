import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { createUserClient } from '../services/supabaseService'
import { generateCoachReply, generateWithClaude as _generateWithClaude } from '../services/anthropicService'

const generateWithClaude = _generateWithClaude

const router = Router()
router.use(requireAuth as any)

function getToken(req: AuthRequest): string {
  return req.headers.authorization!.split(' ')[1]
}

interface Message { role: 'user' | 'assistant'; content: string; timestamp: string }

interface ProjectContext {
  projectName?: string
  nicho?: string
  avatar?: string
  competencia?: string
  completedTools?: string[]
  currentTool?: string
  progress?: number
  currentStep?: number
}

const COACH_NO_JSON = `CRITICAL OUTPUT RULES:
- NEVER return JSON, objects, arrays, or any structured data format
- NEVER use curly braces { } or square brackets [ ] in your response
- Respond ONLY in natural, conversational Spanish prose
- No bullet lists, no markdown headers — just direct, punchy sentences
- If you feel like formatting data, write it as plain sentences instead`

function buildCoachSystemPrompt(ctx: ProjectContext, userName: string): string {
  const completedList = ctx.completedTools?.length
    ? ctx.completedTools.join(', ')
    : 'Ninguna aún'

  return `You are an elite AI business coach named "Coach" — a senior growth strategist who has helped 500+ entrepreneurs build profitable AI agencies.

${COACH_NO_JSON}

USER PROFILE:
- Name: ${userName}
- Business: ${ctx.projectName || 'Agencia de IA'}
- Niche: ${ctx.nicho || 'Not defined yet'}
- Ideal client (avatar): ${ctx.avatar || 'Not analyzed yet'}
- Competition analysis: ${ctx.competencia ? 'Done' : 'Pending'}
- Tools completed: ${completedList}
- Currently working on: ${ctx.currentTool || 'Exploring'}
- Progress: ${ctx.progress || 0}% (Step ${ctx.currentStep || 1}/8)

YOUR ROLE:
1. Be a PEER, not a teacher. Talk like a trusted advisor who knows their business
2. Be SPECIFIC to their exact niche, avatar, and context — NEVER give generic answers
3. When they share progress: CELEBRATE briefly, then give 1-2 SPECIFIC insights
4. When they ask questions: answer with their EXACT data (niche, numbers, context)
5. Always end with ONE actionable question or suggestion
6. If context is missing (no niche defined), gently guide them to complete setup first

COMMUNICATION RULES:
- Max 4-6 sentences per response (be concise and punchy)
- Use their name sparingly (once per conversation, not every message)
- Mix Spanish and direct language — match their tone
- Never say "In general..." or "It depends..." — be SPECIFIC
- Numbers and specifics beat vague advice every time
- Emoji: use sparingly, only for genuine celebration 🔥

AVOID:
- Long philosophical speeches
- Generic marketing advice
- "Great question!" or hollow praise
- Repeating what they just said back to them`
}

// POST /coach/message
router.post('/message', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { message, projectId, context, history = [] } = req.body as {
      message: string
      projectId?: string
      context?: ProjectContext
      history?: Message[]
    }

    const { data: userData } = await db.auth.getUser()
    const userName = userData?.user?.user_metadata?.name?.split(' ')[0]
      || userData?.user?.email?.split('@')[0]
      || 'amigo'

    let ctx: ProjectContext = context || {}

    if (projectId && !context) {
      const [nichoRow, avatarRow, compRow, toolsRow, projectRow] = await Promise.all([
        db.from('project_nicho').select('data_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_avatar').select('data_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_competencia').select('data_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_tools').select('tool_id').eq('project_id', projectId),
        db.from('projects').select('name, progress, current_step').eq('id', projectId).single(),
      ])

      ctx = {
        projectName: projectRow.data?.name,
        nicho: JSON.stringify(nichoRow.data?.data_json || {}),
        avatar: JSON.stringify(avatarRow.data?.data_json || {}),
        competencia: compRow.data ? 'Completed' : undefined,
        completedTools: toolsRow.data?.map((t: { tool_id: string }) => t.tool_id) || [],
        progress: projectRow.data?.progress,
        currentStep: projectRow.data?.current_step,
      }
    }

    const systemPrompt = buildCoachSystemPrompt(ctx, userName)

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const reply = await generateCoachReply(messages, systemPrompt)

    res.json({ reply: reply.trim(), timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Coach error]', err)
    res.status(500).json({ error: 'Error al procesar mensaje' })
  }
})

// GET /coach/suggestion/:projectId — proactive suggestion based on project state
router.get('/suggestion/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { projectId } = req.params

    const { data: userData } = await db.auth.getUser()
    const userName = userData?.user?.user_metadata?.name?.split(' ')[0]
      || userData?.user?.email?.split('@')[0]
      || 'amigo'

    const [projectRow, toolsRow, nichoRow] = await Promise.all([
      db.from('projects').select('name, progress, current_step, updated_at').eq('id', projectId).single(),
      db.from('project_tools').select('tool_id, updated_at').eq('project_id', projectId),
      db.from('project_nicho').select('data_json').eq('project_id', projectId).maybeSingle(),
    ])

    const project = projectRow.data
    const tools = toolsRow.data || []
    const nicho = nichoRow.data?.data_json as Record<string, string> | null

    const lastActivity = tools.length > 0
      ? new Date(tools.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at)
      : null
    const hoursSinceActivity = lastActivity
      ? (Date.now() - lastActivity.getTime()) / 3600000
      : null

    let suggestionPrompt = ''

    if (!nicho) {
      suggestionPrompt = `User ${userName} just opened their project "${project?.name || 'Agencia IA'}" but hasn't defined their niche yet. Give a SHORT motivating welcome message (2-3 sentences) that: 1) welcomes them, 2) tells them the first step is to define their niche, 3) explains WHY (it's the foundation). Be warm and direct. In Spanish.`
    } else if (tools.length === 0) {
      suggestionPrompt = `User ${userName} has defined their niche (${JSON.stringify(nicho).slice(0, 100)}) but hasn't generated any tools yet. Give a SHORT proactive coaching message (2-3 sentences) that: 1) acknowledges the niche is done, 2) recommends the BEST tool to start with (calendar for content creators, VSL for service businesses, tracker for financial focus), 3) explains the quick win they'll get. In Spanish.`
    } else if (hoursSinceActivity && hoursSinceActivity > 48) {
      const lastTool = tools[0]?.tool_id
      suggestionPrompt = `User ${userName} hasn't been active for ${Math.round(hoursSinceActivity)} hours. Last thing they did was generate "${lastTool}". Give a SHORT accountability message (2-3 sentences) that: 1) notices the pause (not judgmentally), 2) asks about blockers, 3) offers 1 specific next step. In Spanish. Be like a peer, not a parent.`
    } else {
      const lastTool = tools[0]?.tool_id
      suggestionPrompt = `User ${userName} just generated "${lastTool}" for their project "${project?.name}". Niche: ${JSON.stringify(nicho).slice(0, 80)}. Give a SHORT celebratory + insight message (2-3 sentences): 1) quick celebration, 2) one SPECIFIC insight about what they generated, 3) what to do next. In Spanish.`
    }

    const suggestionSystem = `Eres un AI Coach de negocios experto. Respondes SIEMPRE en español conversacional natural. ${COACH_NO_JSON}`
    const suggestion = await generateWithClaude(suggestionPrompt, suggestionSystem)

    res.json({ suggestion: suggestion.trim(), timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Coach suggestion error]', err)
    res.status(200).json({ suggestion: '¡Hola! Estoy aquí para ayudarte. ¿En qué puedo apoyarte hoy?', timestamp: new Date().toISOString() })
  }
})

export default router
