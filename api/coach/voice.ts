import Anthropic from '@anthropic-ai/sdk'
import { ElevenLabsClient } from 'elevenlabs'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { reportarError } from '../../src/lib/reportarError.js'

function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY no configurada')
  }

  const tmpDir = os.tmpdir()
  const audioPath = path.join(tmpDir, `audio_${Date.now()}.webm`)
  fs.writeFileSync(audioPath, audioBuffer)

  try {
    const formData = new FormData()
    formData.append('file', fs.createReadStream(audioPath))
    formData.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        ...formData.getHeaders(),
      },
      body: formData as unknown as BodyInit,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data: any = await response.json()
    return data.text
  } finally {
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath)
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { audio, projectId } = req.body

    if (!audio) return res.status(400).json({ error: 'Audio requerido' })

    const audioBuffer = Buffer.from(audio, 'base64')

    const transcript = await transcribeAudio(audioBuffer)
    if (!transcript.trim()) {
      return res.status(400).json({ error: 'No se pudo transcribir el audio' })
    }

    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

    let projectContext = ''

    if (token) {
      const db = getDb(token)

      if (projectId) {
        const [projectRes, nichoRes, avatarRes] = await Promise.all([
          db.from('projects').select('name, description').eq('id', projectId).single(),
          db.from('project_nicho').select('data_json').eq('project_id', projectId).single(),
          db.from('project_avatar').select('data_json').eq('project_id', projectId).single(),
        ])

        const project = projectRes.data
        const nicho = nichoRes.data?.data_json as Record<string, string> | null
        const avatar = avatarRes.data?.data_json as Record<string, string> | null

        const lines: string[] = ['El usuario está trabajando en este proyecto:']
        if (project?.name) lines.push(`- Proyecto: ${project.name}`)
        if (project?.description) lines.push(`- Descripción: ${project.description}`)
        if (nicho?.sector) lines.push(`- Sector: ${nicho.sector}`)
        if (nicho?.micronicho) lines.push(`- Micronicho: ${nicho.micronicho}`)
        if (nicho?.ticket) lines.push(`- Ticket promedio: ${nicho.ticket}`)
        if (nicho?.tam) lines.push(`- Tamaño de mercado: ${nicho.tam}`)
        if (avatar?.name) lines.push(`- Cliente ideal: ${avatar.name}${avatar.position ? `, ${avatar.position}` : ''}`)
        if (avatar?.pains) {
          const pains = Array.isArray(avatar.pains) ? avatar.pains.join(', ') : String(avatar.pains)
          lines.push(`- Dolores del cliente: ${pains}`)
        }
        if (avatar?.goals) {
          const goals = Array.isArray(avatar.goals) ? avatar.goals.join(', ') : String(avatar.goals)
          lines.push(`- Objetivos del cliente: ${goals}`)
        }
        projectContext = lines.join('\n')

      } else {
        const { data: projects } = await db
          .from('projects')
          .select('id, name, description')
          .limit(10)

        if (projects && projects.length > 0) {
          const lines: string[] = [`El usuario tiene ${projects.length} proyecto(s) en la plataforma:`]
          for (const p of projects) {
            lines.push(`- ${p.name || 'Sin nombre'}${p.description ? `: ${p.description}` : ''}`)
          }
          lines.push('El usuario está en el Dashboard general (no dentro de un proyecto específico).')
          projectContext = lines.join('\n')
        }
      }
    }

    const systemPrompt = `Eres un coach experto en marketing digital, ventas y construcción de agencias de IA.
Ayudas a emprendedores a crear y escalar sus agencias. Eres directo, concreto y accionable.

FORMATO DE RESPUESTA (muy importante):
- Responde en español
- Máximo 3-4 frases cortas y directas
- Frases conversacionales, como en una conversación por voz
- Sin asteriscos, sin markdown, sin negritas
- Sé conciso, el usuario te está escuchando por voz
- Ortografía impecable: las tildes son OBLIGATORIAS y también se escriben en MAYÚSCULAS. Respeta las tildes diacríticas y los signos ¿ ¡

${projectContext ? `CONTEXTO DEL USUARIO:\n${projectContext}` : ''}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: transcript }],
    })

    const textReply = response.content[0].type === 'text' ? response.content[0].text : ''

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      return res.status(500).json({
        error: 'ElevenLabs API key not configured',
        transcript,
        text: textReply,
      })
    }

    const client = new ElevenLabsClient({ apiKey: elevenLabsApiKey })

    const audioBuffer2 = await client.generate({
      voice: 'Diego',
      text: textReply,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_64',
    })

    const audioBase64 = Buffer.from(audioBuffer2 as unknown as Uint8Array).toString('base64')

    return res.status(200).json({
      transcript,
      text: textReply,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
    })
  } catch (error: any) {
    console.error('Coach voice error:', error)
    await reportarError(error, { endpoint: 'coach/voice', status: error?.status, tipo: error?.error?.error?.type })
    return res.status(500).json({ error: error.message || 'Error en coach de voz' })
  }
}
