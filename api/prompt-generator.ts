import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { reportarError } from '../src/lib/reportarError.js'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { platform, interactionType, agentData } = req.body as {
      platform: string
      interactionType: 'texto' | 'voz'
      agentData: {
        agentName: string
        businessType: string
        targetAudience: string
        mainObjective: string
        personality: string
        objections?: string
        additionalInfo: string
      }
    }

    if (!platform || !interactionType || !agentData) {
      return res.status(400).json({ error: 'Faltan datos requeridos' })
    }

    const isGhlText = platform === 'ghl' && interactionType === 'texto'

    const systemPrompt = isGhlText
      ? `Eres un experto en IA conversacional especializado en Go High Level (GHL).
Generas prompts de sistema EXACTAMENTE en el formato de 3 secciones que GHL requiere.
Escribe directamente el prompt sin explicaciones ni introducciones.
Usa lenguaje natural, claro y orientado a resultados.
Ortografía impecable: las tildes son OBLIGATORIAS y también se escriben en MAYÚSCULAS. Respeta las tildes diacríticas y los signos ¿ ¡.`
      : `Eres un experto en diseño de agentes conversacionales de IA.
Generas prompts de sistema profesionales con estructura completa para cualquier plataforma.
Escribe directamente el prompt sin explicaciones ni introducciones.
Cada sección debe ser detallada, accionable y adaptada al negocio específico.
Ortografía impecable: las tildes son OBLIGATORIAS y también se escriben en MAYÚSCULAS. Respeta las tildes diacríticas y los signos ¿ ¡.`

    const formatInstructions = isGhlText
      ? `Genera el prompt de sistema para Go High Level EXACTAMENTE con este formato de 3 secciones:

## PERSONALIDAD
[Describe el nombre del agente, su carácter, tono de voz, estilo de comunicación y cómo se presenta. Debe sentirse como un asistente real de la empresa.]

## OBJETIVO
[Define la meta principal del agente: qué debe lograr en cada conversación, qué resultado concreto debe generar.]

## INFORMACIÓN ADICIONAL
[Incluye todo el flujo conversacional completo:
- Preguntas que debe hacer en orden específico
- Cómo debe manejar cada tipo de respuesta
- Qué datos debe recopilar y cómo
- Cuándo y cómo pasar a la siguiente etapa
- Cómo manejar objeciones comunes
- Qué hacer si no sabe algo
- Cuándo transferir a un humano y cómo hacerlo
- Mensajes de cierre y próximos pasos]`
      : `Genera el prompt de sistema profesional completo con EXACTAMENTE estas 8 secciones:

## ROL Y CONTEXTO
[Quién es el agente, para qué empresa trabaja, en qué contexto opera y cuál es su propósito en la organización.]

## PERSONALIDAD Y TONO
[Carácter del agente, estilo de comunicación, cómo habla, qué expresiones usa y qué debe evitar decir.]

## OBJETIVO PRINCIPAL
[Meta concreta y medible de cada interacción. Qué resultado específico debe generar.]

## CAPACIDADES
[Qué puede hacer el agente, qué información maneja, qué acciones puede tomar, sus límites.]

## FLUJO DE CONVERSACIÓN
[Paso a paso detallado de cómo debe desarrollarse cada conversación desde el saludo hasta el cierre.]

## MANEJO DE OBJECIONES
[Respuestas específicas a las objeciones más comunes del sector. Scripts concretos.]

## RESTRICCIONES
[Qué NO debe hacer, temas que debe evitar, información que no puede compartir, límites claros.]

## CIERRE Y SIGUIENTE PASO
[Cómo terminar la conversación, qué acción concreta debe generar, cómo hacer seguimiento.]`

    const userPrompt = `DATOS DEL AGENTE:
- Nombre: ${agentData.agentName}
- Tipo de negocio: ${agentData.businessType}
- Cliente ideal: ${agentData.targetAudience}
- Objetivo principal: ${agentData.mainObjective}
- Personalidad: ${agentData.personality}
${agentData.objections ? `- Objeciones comunes: ${agentData.objections}` : ''}
- Flujo / información adicional: ${agentData.additionalInfo}

Plataforma: ${platform.toUpperCase()}
Tipo de interacción: ${interactionType}

${formatInstructions}

Escribe ÚNICAMENTE el prompt final, listo para copiar y usar. Sin explicaciones, sin introducciones.`

    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''

    return res.status(200).json({ success: true, content })
  } catch (error: unknown) {
    // Se distingue el tipo de fallo: antes cualquier cosa era un 500 con el
    // mensaje crudo del SDK, y el alumno solo veía "status code 500". Sin logs
    // largos ni Sentry conectado, eso dejaba la causa imposible de saber.
    const e = error as {
      status?: number
      message?: string
      error?: { error?: { type?: string; message?: string } }
    }
    const tipo = e?.error?.error?.type
    await reportarError(error, {
      endpoint: 'prompt-generator',
      status: e?.status,
      tipo,
      detalle: e?.error?.error?.message,
    })
    console.error('[prompt-generator] Falló:', {
      status: e?.status,
      tipo,
      message: e?.message,
      detalle: e?.error?.error?.message,
    })

    if (e?.status === 429) {
      return res.status(429).json({
        error: 'Hay mucha demanda de IA ahora mismo. Espera un minuto y vuelve a darle a generar.',
      })
    }
    if (e?.status === 529 || e?.status === 503) {
      return res.status(503).json({
        error: 'La IA está sobrecargada en este momento. Vuelve a intentarlo en un minuto.',
      })
    }
    if (e?.status === 400 || e?.status === 401 || e?.status === 403) {
      // Cuenta/credenciales: el alumno no puede hacer nada, y soporte sí.
      return res.status(502).json({
        error: 'La IA no está disponible ahora mismo por un problema de configuración. Avisa a soporte.',
      })
    }
    return res.status(500).json({
      error: e?.message || 'No se pudo generar el prompt. Vuelve a intentarlo.',
    })
  }
}
