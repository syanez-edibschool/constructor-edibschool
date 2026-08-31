import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { reportarError } from '../src/lib/reportarError.js'

// ─────────────────────────────────────────────────────────────────────────────
// Semáforo del nicho. El alumno escribe su nicho con sus palabras y aquí se
// evalúa contra los criterios de la clase de nichos.
//
// NUNCA bloquea: devuelve un veredicto para que el alumno decida con criterio.
// Un rojo no le impide seguir — su negocio puede estar ya en ese nicho.
//
// Llamada APARTE de la generación del análisis a propósito: ese prompt le pide
// a la IA "explica por qué este nicho es ideal", así que un modelo ya preparado
// para vender el nicho nunca diría que es malo. Aquí el prompt es escéptico y
// solo ve la frase del nicho, sin nada que le empuje a aprobarlo.
//
// Haiku y respuesta corta: cuesta céntimas y tarda ~2 s.
// ─────────────────────────────────────────────────────────────────────────────

// ── Criterio de la formación. Cambiar estos números ES cambiar el criterio ────
const TICKET_MINIMO_EUR = 500      // menos de esto al mes = no sostiene una agencia
const NEGOCIOS_MINIMOS = 500       // menos negocios alcanzables = nicho demasiado pequeño

// Ancla para que el modelo puntúe como puntúa la formación, no a su libre albedrío.
const NICHOS_RECOMENDADOS = [
  'clínicas dentales', 'clínicas de estética y medicina estética', 'fisioterapia y rehabilitación',
  'psicología y terapia de pareja', 'nutrición y coaching de peso', 'clínicas veterinarias',
  'ópticas', 'audiología', 'abogados de familia y extranjería', 'asesorías fiscales y contables',
  'arquitectura e interiorismo', 'ingenierías y peritajes', 'notarías y gestorías',
  'agencias de seguros', 'reformas integrales', 'climatización y placas solares',
  'fontanería y urgencias 24h', 'empresas de mudanzas', 'paisajismo y jardinería',
  'control de plagas', 'agencias inmobiliarias pequeñas', 'gestión de alquiler turístico',
  'brókers hipotecarios', 'promotoras pequeñas', 'academias de idiomas',
  'centros de refuerzo y oposiciones', 'autoescuelas', 'formadores y cursos online',
  'gimnasios y boxes de crossfit', 'centros de yoga y pilates',
  'peluquerías y barberías de gama alta', 'spas y balnearios', 'escuelas infantiles',
  'logística y última milla', 'talleres y mecánica especializada',
  'distribuidores y mayoristas locales', 'empresas de limpieza profesional',
]

type Semaforo = 'verde' | 'ambar' | 'rojo'

interface Veredicto {
  semaforo: Semaforo
  titular: string
  motivos: string[]
  recomendacion: string
}

/** La IA a veces envuelve el JSON en ``` o añade texto: se extrae el objeto. */
function parseJSON(texto: string): Record<string, unknown> {
  const limpio = texto.replace(/```json|```/g, '').trim()
  const desde = limpio.indexOf('{')
  const hasta = limpio.lastIndexOf('}')
  if (desde === -1 || hasta === -1) throw new Error('sin JSON')
  return JSON.parse(limpio.slice(desde, hasta + 1)) as Record<string, unknown>
}

const texto = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** Recorta sin partir palabras: cortar a pelo dejaba frases a medias. */
function recortar(s: string, max: number): string {
  if (s.length <= max) return s
  const cortado = s.slice(0, max)
  const espacio = cortado.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? cortado.slice(0, espacio) : cortado).trimEnd()}…`
}

function normalizar(raw: Record<string, unknown>): Veredicto {
  const s = texto(raw.semaforo).toLowerCase()
  const semaforo: Semaforo = s === 'verde' ? 'verde' : s === 'rojo' ? 'rojo' : 'ambar'
  const motivos = (Array.isArray(raw.motivos) ? raw.motivos : [])
    .map((m) => recortar(texto(m), 220))
    .filter(Boolean)
    .slice(0, 4)
  return {
    semaforo,
    titular: recortar(texto(raw.titular), 160),
    motivos,
    recomendacion: recortar(texto(raw.recomendacion), 460),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const nicho = texto(req.body?.nicho).trim().slice(0, 500)
  if (nicho.length < 12) {
    return res.status(400).json({ error: 'Escribe algo más concreto sobre tu nicho.' })
  }

  // Sesión obligatoria: este endpoint gasta IA, no puede quedar abierto.
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' })

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!url || !anonKey || !process.env.ANTHROPIC_API_KEY) {
    console.error('[evaluar-nicho] Faltan variables de entorno')
    return res.status(500).json({ error: 'Evaluación no configurada.' })
  }

  const { data: userData, error: userErr } = await createClient(url, anonKey)
    .auth.getUser(authHeader.split(' ')[1])
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Sesión no válida' })

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 })
    const respuesta = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:
        'Evalúas nichos de mercado para agencias de IA con criterio comercial y ESCÉPTICO. ' +
        'No animas ni vendes: si el nicho es flojo lo dices claro. Devuelves SOLO JSON válido, ' +
        'sin markdown ni texto alrededor. Escribes en español con tildes obligatorias.',
      messages: [{
        role: 'user',
        content: `Evalúa este nicho para montar una agencia que vende contenido y agentes de IA comerciales:

NICHO DEL ALUMNO: "${nicho}"

Cuatro criterios, todos obligatorios:
1. DOLOR claro y urgente: ¿pierde dinero HOY por este problema, o puede convivir con él?
2. PRESUPUESTO real: ¿puede pagar ${TICKET_MINIMO_EUR}-1500 EUR/mes de forma sostenida?
3. SATURACIÓN: ¿hay ya muchas agencias especializadas compitiendo ahí?
4. TAMAÑO: ¿hay al menos ${NEGOCIOS_MINIMOS} negocios así alcanzables, o es demasiado pequeño?

Como referencia, estos nichos SÍ cumplen el criterio de la formación:
${NICHOS_RECOMENDADOS.join(', ')}.
No es una lista cerrada: un nicho que no esté ahí puede ser válido si cumple los cuatro
criterios, y uno parecido a los de la lista puede fallar si es demasiado pequeño o local.

Devuelve exactamente este JSON:
{
  "semaforo": "verde | ambar | rojo",
  "titular": "veredicto en una frase de menos de 15 palabras",
  "motivos": ["2 a 4 motivos, MÁXIMO 25 PALABRAS CADA UNO, uno por criterio, con cifras cuando puedas"],
  "recomendacion": "1 o 2 frases, máximo 40 palabras: cómo afinar el nicho para que funcione mejor"
}

Criterio del semáforo: verde = cumple los cuatro. ambar = cumple pero con un pero
importante. rojo = falla el dolor, el presupuesto o está claramente saturado.`,
      }],
    })

    const bruto = respuesta.content[0]?.type === 'text' ? respuesta.content[0].text : ''
    return res.status(200).json({ veredicto: normalizar(parseJSON(bruto)) })
  } catch (e) {
    // Que falle la evaluación NO puede impedir que el alumno siga: el front lo
    // trata como "sin veredicto" y no muestra nada.
    console.error('[evaluar-nicho] Falló:', e instanceof Error ? e.message : e)
    const err = e as { status?: number; error?: { error?: { type?: string } } }
    await reportarError(e, { endpoint: 'evaluar-nicho', status: err?.status, tipo: err?.error?.error?.type })
    return res.status(502).json({ error: 'No se pudo evaluar el nicho ahora mismo.' })
  }
}
