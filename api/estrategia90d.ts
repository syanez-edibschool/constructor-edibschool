import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { projectId, cloneGanadorData } = req.body

    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

    let projectContext = ''
    if (token && projectId) {
      const db = getDb(token)
      const [projRes, nichoRes, avatarRes] = await Promise.all([
        db.from('projects').select('name, description').eq('id', projectId).single(),
        db.from('project_nicho').select('data_json').eq('project_id', projectId).single(),
        db.from('project_avatar').select('data_json').eq('project_id', projectId).single(),
      ])
      const p = projRes.data
      const n = nichoRes.data?.data_json as Record<string, string> | null
      const av = avatarRes.data?.data_json as Record<string, string> | null
      const lines: string[] = []
      if (p?.name) lines.push(`Proyecto: ${p.name}`)
      if (p?.description) lines.push(`Descripción: ${p.description}`)
      if (n?.sector) lines.push(`Sector: ${n.sector}`)
      if (n?.micronicho) lines.push(`Micronicho: ${n.micronicho}`)
      if (n?.ticket) lines.push(`Ticket promedio: ${n.ticket}`)
      if (av?.name) lines.push(`Cliente ideal: ${av.name}`)
      if (av?.pains) lines.push(`Dolores: ${Array.isArray(av.pains) ? av.pains.join(', ') : av.pains}`)
      projectContext = lines.join('\n')
    }

    const cloneContext = cloneGanadorData
      ? `
DATOS DE CLONE THE WINNER (ganador: ${cloneGanadorData.handle}):
- Engagement rate: ${cloneGanadorData.executive_summary?.engagement_rate}
- Posts/semana: ${cloneGanadorData.executive_summary?.posts_per_week}
- Factores de éxito: ${cloneGanadorData.executive_summary?.key_success_factors?.join(', ')}
- Top hooks: ${cloneGanadorData.copy_analysis?.top_hooks?.slice(0, 3).map((h: any) => h.hook).join('; ')}
- Top CTAs: ${cloneGanadorData.copy_analysis?.top_ctas?.slice(0, 3).map((c: any) => c.cta).join('; ')}
- Tono de voz: ${cloneGanadorData.copy_analysis?.tone_of_voice}
- Mix de contenido ganador: ${cloneGanadorData.content_mix?.map((c: any) => `${c.type} ${c.percentage}%`).join(', ')}
- Tareas semana 1 del ganador: ${cloneGanadorData.implementation_plan?.week1?.tasks?.join(', ')}
- Tareas semana 2 del ganador: ${cloneGanadorData.implementation_plan?.week2?.tasks?.join(', ')}
`
      : ''

    const prompt = `Eres un experto en agencias de IA y marketing digital. Genera un plan de acción de 90 días (13 semanas) ultra detallado para lanzar una agencia de IA.

${projectContext ? `CONTEXTO DEL PROYECTO:\n${projectContext}` : ''}
${cloneContext}

INSTRUCCIONES CRÍTICAS:
- Responde SOLO en JSON válido, sin markdown, sin explicaciones
- El JSON debe seguir EXACTAMENTE la estructura indicada
- Distribuye tareas reales y ejecutables
- Semana 1: mínimo 6-7 tareas/día (lanzamiento intensivo)
- Semanas 2-4: 3-5 tareas/día (infraestructura + primeras publicaciones + 30 contactos/día)
- Semanas 5-8: 3-4 tareas/día (Instagram escalado + prospección activa)
- Semanas 9-13: 2-4 tareas/día (publicidad + optimización + escalado)
${cloneGanadorData ? `- Las primeras tareas de la semana 1 deben ser tareas específicas basadas en Clone The Winner (handle: ${cloneGanadorData.handle}), con source="clone_ganador"` : ''}

FASES Y TAREAS OBLIGATORIAS:

FASE 2 - Construcción de Oferta (semanas 1-2):
- Redactar PUV: Ayudo a [micronicho] a [resultado] mediante [mecanismo IA] sin [objeción]
- Definir oferta irresistible (auditoría gratis, prueba 7-14 días, implementación sin costo)
- Crear lead magnet alineado al dolor del avatar
- Validar oferta con 5 prospectos antes de escalar

FASE 3 - Infraestructura Digital (semanas 2-4):
- Montar funnel o sitio web con headline + problema + agitación + solución + CTA
- Configurar calendario en GHL/Calendly con confirmación y recordatorios automáticos
- Activar secuencia email post-registro (inmediato + educativa pre-llamada + post-llamada)
- Configurar agente IA que responda DMs automáticamente
- Preparar documento de propuesta comercial

FASE 4 - Instagram Estratégico (semanas 3-8):
- Optimizar perfil: foto profesional + bio con resultado + CTA
- Publicar 9-12 posts iniciales
- Crear 3 carruseles educativos del nicho
- Crear 2 Reels explicando problemas del sector
- Activar follow estratégico: máximo 30-50 cuentas/día del micronicho
- Enviar DMs con script de apertura a prospectos calificados

FASE 5 - Prospección Activa (SIEMPRE EN PARALELO desde semana 1):
- Contactar mínimo 30 nuevos prospectos diarios
- Llevar seguimiento en CRM
- Hacer follow-up cada 48-72 horas

FASE 6 - Publicidad (semanas 9-13):
- TOFU: Campaña Follow Me Ads con lead magnet
- MOFU: Campaña captación a formulario
- BOFU: Retargeting a mensajes/agenda
- Optimizar campañas con datos reales

HÁBITOS DIARIOS/SEMANALES:
- 30 contactos nuevos diarios
- Seguimiento activo de pipeline
- 3 publicaciones semanales en Instagram
- Mejorar guión de ventas semanalmente
- Estudiar 30-60 minutos diarios

Genera el JSON con esta estructura exacta:
{
  "phases": [
    {
      "id": "fase-2",
      "phase": 2,
      "title": "Construcción de Oferta",
      "color": "#00D9FF",
      "week_start": 1,
      "week_end": 2,
      "tasks": [
        {
          "id": "f2-t1",
          "task": "Redactar PUV: Ayudo a [micronicho] a [resultado] mediante [mecanismo IA] sin [objeción]",
          "completed": false,
          "week": 1,
          "day": 1,
          "priority": "alta",
          "source": "plan_agencia"
        }
      ]
    }
  ],
  "weeks": [
    {
      "week": 1,
      "label": "SEMANA DE LANZAMIENTO",
      "is_launch": true,
      "days": [
        {
          "day": 1,
          "label": "Lunes",
          "tasks": ["f2-t1", "f2-t2"]
        }
      ]
    }
  ]
}

Genera las 13 semanas completas con todos los días (lunes a domingo) y todas las tareas de todas las fases distribuidas correctamente.`

    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawContent = response.content[0].type === 'text' ? response.content[0].text : ''

    let cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    if (!cleaned.startsWith('{')) {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) cleaned = match[0]
    }

    return res.status(200).json({ success: true, content: cleaned })
  } catch (error: any) {
    console.error('Estrategia 90D error:', error)
    return res.status(500).json({ error: error.message || 'Error generando estrategia' })
  }
}
