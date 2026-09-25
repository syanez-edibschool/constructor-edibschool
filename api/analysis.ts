import Anthropic from "@anthropic-ai/sdk"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { reportarError } from "../src/lib/reportarError.js"
import type { VercelRequest, VercelResponse } from "@vercel/node"

function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

function parseJSON<T = any>(raw: string): T {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (objMatch) cleaned = objMatch[0]
    else if (arrMatch) cleaned = arrMatch[0]
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`JSON parse falló. Primeros 300 chars: ${raw.slice(0, 300)}`)
  }
}

async function generate(anthropic: Anthropic, prompt: string, opts?: { model?: string; maxTokens?: number }) {
  const res = await anthropic.messages.create({
    model: opts?.model ?? 'claude-haiku-4-5-20251001', // Haiku por defecto: 3-5x más rápido
    max_tokens: opts?.maxTokens ?? 2048,
    system: 'Devuelves SOLO JSON válido y completo. NO incluyas texto antes ni después. NO uses bloques de código markdown. Respetas EXACTAMENTE la forma pedida: donde se pide un texto devuelves una cadena plana, NUNCA un objeto ni un array con subcampos. Escribes en español con ortografía impecable: las tildes son OBLIGATORIAS y también se escriben en MAYÚSCULAS (ANÁLISIS, DIAGNÓSTICO, ÉXITO, MÁS, QUÉ, CÓMO), y respetas las tildes diacríticas y los signos ¿ ¡.',
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content[0].type === 'text' ? res.content[0].text : ''
}

/**
 * El avatar y la competencia se generaban SOLO desde las respuestas, sin ver el
 * nicho. Por eso, al corregir el nicho, quedaban apuntando al anterior. Estos
 * prompts aceptan el nicho para poder alinearlos. Sin nicho el texto es el mismo
 * de siempre, así que la generación inicial no cambia.
 */
const bloqueNicho = (nicho?: Record<string, unknown>): string =>
  nicho
    ? `
NICHO YA DEFINIDO (manda: todo lo que generes debe ser de ESTE nicho):
${JSON.stringify(nicho)}
`
    : ''

/**
 * Esquemas JSON de cada bloque, UNA sola vez. El fallo de «Actualizar con
 * feedback» (sep 2026) vino justo de tenerlos duplicados: generar pasaba el
 * esquema completo y actualizar solo nombraba los campos en prosa. El modelo se
 * inventaba la forma interna —`nombre` en vez de `name` dentro de cada
 * competidor— y la pantalla, que lee `name`, pintaba las tarjetas vacías.
 * Generar y actualizar deben usar SIEMPRE estas constantes.
 */
const ESQUEMA_NICHO = `{
  "sector": "nombre del sector específico",
  "micronicho": "descripción del micronicho exacto",
  "tam": "rango de potenciales clientes (ej: 15,000-20,000)",
  "ticket": "rango de precio mensual recomendado (ej: €2,500-4,500/mes)",
  "trend": "crecimiento anual estimado (ej: ↑ 22% anual)",
  "momento": "¿Es buen momento para entrar? (1 oración)",
  "razon": "Explicación de 2-3 oraciones de por qué este nicho es ideal ahora mismo para una agencia de IA"
}`

const ESQUEMA_AVATAR = `{
  "name": "nombre ficticio realista",
  "age": "rango de edad (ej: 38-45 años)",
  "position": "cargo/posición exacta",
  "experience": "años de experiencia en el sector",
  "income": "rango de ingresos mensuales",
  "goals": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "pains": ["dolor 1", "dolor 2", "dolor 3"],
  "narrative": "Historia de 3-4 oraciones en primera persona que describe UN DÍA en su vida, sus frustraciones, y por qué necesita ayuda de IA"
}`

const ESQUEMA_COMPETENCIA = `{
  "competitors": [
    {
      "name": "nombre realista de competidor tipo",
      "price": "rango de precio que cobran",
      "strengths": ["fortaleza 1", "fortaleza 2"],
      "weaknesses": ["debilidad 1", "debilidad 2"],
      "gap": "oportunidad específica contra este competidor (1 oración)"
    }
  ],
  "positioning": "Posicionamiento único recomendado de 1-2 oraciones para diferenciarse",
  "opportunity": "La mayor oportunidad de mercado que existe ahora mismo (2 oraciones)"
}`

const promptAvatar = (ctx: string, nicho?: Record<string, unknown>) => `
Basado en estas respuestas del emprendedor:
${ctx}
${bloqueNicho(nicho)}
Crea un avatar de cliente ideal VÍVIDO y detallado en JSON:
${ESQUEMA_AVATAR}`

const promptCompetencia = (ctx: string, nicho?: Record<string, unknown>) => `
Basado en estas respuestas del emprendedor:
${ctx}
${bloqueNicho(nicho)}
Genera un análisis de competencia en JSON:
${ESQUEMA_COMPETENCIA}
Incluye exactamente 3 competidores.`

/** Filas de las 3 tablas, con la misma forma que ya se guardaba. */
const filasDeLosTres = (
  db: SupabaseClient,
  projectId: string,
  nicho: Record<string, unknown>,
  avatar: Record<string, unknown>,
  competencia: Record<string, unknown>,
) => [
  db.from('project_nicho').upsert({
    project_id: projectId,
    sector: nicho.sector,
    micronicho: nicho.micronicho,
    tam: nicho.tam,
    ticket: nicho.ticket,
    trend: nicho.trend,
    momento: nicho.momento,
    data_json: JSON.stringify(nicho),
  }, { onConflict: 'project_id' }),
  db.from('project_avatar').upsert({
    project_id: projectId,
    name: avatar.name,
    age: avatar.age,
    data_json: JSON.stringify(avatar),
  }, { onConflict: 'project_id' }),
  db.from('project_competencia').upsert({
    project_id: projectId,
    data_json: JSON.stringify(competencia),
  }, { onConflict: 'project_id' }),
]

/**
 * Contenido ya guardado de un bloque. Las correcciones con feedback lo
 * necesitan: sin ver la versión actual el modelo no puede «mantener» nada y
 * rehace el bloque de cero. Así cambiaba el nombre del avatar sin pedirlo, o
 * volvían palabras que el alumno había prohibido expresamente.
 */
async function guardado(
  db: SupabaseClient,
  tabla: 'project_nicho' | 'project_avatar' | 'project_competencia',
  projectId: string,
): Promise<Record<string, unknown> | undefined> {
  const { data } = await db.from(tabla).select('data_json').eq('project_id', projectId).maybeSingle()
  const bruto = data?.data_json
  if (!bruto) return undefined
  try {
    return (typeof bruto === 'string' ? JSON.parse(bruto) : bruto) as Record<string, unknown>
  } catch {
    return undefined
  }
}

/** Nicho ya guardado, para que las correcciones de avatar/competencia lo respeten. */
const nichoGuardado = (db: SupabaseClient, projectId: string) => guardado(db, 'project_nicho', projectId)

/**
 * Prompt de «Actualizar con feedback». Parte de la versión ACTUAL y pide el
 * MISMO esquema que la generación: faltaban las dos cosas, y por eso el
 * feedback vaciaba listas y tarjetas y no respetaba los «mantén».
 */
const promptFeedback = (o: {
  que: string
  feedback: string
  actual?: Record<string, unknown>
  ctx: string
  nicho?: Record<string, unknown>
  esquema: string
  extra?: string
}) => `
El usuario quiere corregir ${o.que}. Su feedback:
"${o.feedback}"
${o.actual ? `
VERSIÓN ACTUAL, la que el usuario está viendo y quiere corregir:
${JSON.stringify(o.actual)}

REGLAS PARA APLICAR EL FEEDBACK:
- Parte de la VERSIÓN ACTUAL. Cambia SOLO lo que pide el feedback; todo lo demás se queda IGUAL, palabra por palabra.
- Si el feedback pide «mantener» algo, ese algo no se toca.
- Si el feedback prohíbe algo (una palabra, un canal, una promesa, una cifra), no puede aparecer en NINGÚN campo.
` : ''}
ESE FEEDBACK MANDA sobre las respuestas originales de abajo.
Respuestas originales: ${o.ctx}
${bloqueNicho(o.nicho)}
Devuelve el JSON con EXACTAMENTE esta forma. Las claves van en inglés, tal cual están aquí, aunque el feedback esté en español:
${o.esquema}${o.extra ? `\n${o.extra}` : ''}`

const textoLleno = (v: unknown) => (typeof v === 'string' && v.trim() !== '') || typeof v === 'number'
const listaLlena = (v: unknown) =>
  Array.isArray(v) && v.length > 0 && v.every((x) => (typeof x === 'string' && x.trim() !== '') || typeof x === 'number')

/**
 * Qué le falta a una respuesta para tener la forma que pinta la pantalla de
 * revisión. Solo se exige lo que la pantalla enseña: `experience` y
 * `opportunity` se guardan pero no se muestran, así que no se exigen.
 */
const faltasNicho = (n: any): string[] =>
  ['sector', 'micronicho', 'tam', 'ticket', 'trend', 'momento', 'razon'].filter((k) => !textoLleno(n?.[k]))

const faltasAvatar = (a: any): string[] => [
  ...['name', 'age', 'position', 'income', 'narrative'].filter((k) => !textoLleno(a?.[k])),
  ...['goals', 'pains'].filter((k) => !listaLlena(a?.[k])),
]

const faltasCompetencia = (c: any): string[] => {
  if (!Array.isArray(c?.competitors) || c.competitors.length === 0) return ['competitors']
  const f: string[] = []
  c.competitors.forEach((x: any, i: number) => {
    for (const k of ['name', 'price', 'gap']) if (!textoLleno(x?.[k])) f.push(`competitors[${i}].${k}`)
    for (const k of ['strengths', 'weaknesses']) if (!listaLlena(x?.[k])) f.push(`competitors[${i}].${k}`)
  })
  if (!textoLleno(c?.positioning)) f.push('positioning')
  return f
}

/** La IA devolvió algo sin la forma que pinta la pantalla, incluso tras reintentar. */
class ErrorDeForma extends Error {
  constructor(readonly faltas: string[]) {
    super(`Respuesta de la IA sin la forma esperada: ${faltas.join(', ')}`)
  }
}

/**
 * Genera, parsea y COMPRUEBA la forma antes de dar nada por bueno. Si falta algo
 * que la pantalla pinta, reintenta una vez diciéndole al modelo qué le faltó.
 * Si vuelve a fallar lanza ErrorDeForma y NO se guarda nada: es preferible
 * avisar al alumno que pisarle el análisis con tarjetas vacías.
 *
 * Solo se capturan los fallos de PARSEO. Los de la API de Anthropic (límite,
 * credenciales, caída) se propagan tal cual al catch del handler, como antes.
 */
async function generarConForma(
  anthropic: Anthropic,
  prompt: string,
  faltasDe: (x: any) => string[],
): Promise<Record<string, unknown>> {
  const intentar = async (p: string): Promise<{ dato?: Record<string, unknown>; faltas: string[] }> => {
    const raw = await generate(anthropic, p)
    let dato: Record<string, unknown>
    try {
      dato = parseJSON<Record<string, unknown>>(raw)
    } catch {
      return { faltas: ['JSON válido'] }
    }
    return { dato, faltas: faltasDe(dato) }
  }
  const primero = await intentar(prompt)
  if (primero.dato && primero.faltas.length === 0) return primero.dato
  const segundo = await intentar(`${prompt}

TU RESPUESTA ANTERIOR NO TENÍA LA FORMA PEDIDA. Faltaban o venían vacíos: ${primero.faltas.join(', ')}.
Devuelve el JSON COMPLETO, con EXACTAMENTE las claves del esquema (en inglés, tal cual) y todos esos campos rellenos.`)
  if (segundo.dato && segundo.faltas.length === 0) return segundo.dato
  throw new ErrorDeForma(segundo.faltas)
}

const TABLAS = ['project_nicho', 'project_avatar', 'project_competencia']

function erroresDeGuardado(results: PromiseSettledResult<{ error: unknown }>[]): string[] {
  return results
    .map((r, i) => {
      if (r.status === 'rejected') return `Error al guardar ${TABLAS[i]}: ${(r.reason as Error)?.message ?? r.reason}`
      if (r.value?.error) return `Error Supabase en ${TABLAS[i]}: ${JSON.stringify(r.value.error)}`
      return null
    })
    .filter((x): x is string => Boolean(x))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const operation = req.query.operation as string
  const projectId = req.query.projectId as string

  if (!projectId || !operation) {
    return res.status(400).json({ error: 'projectId y operation requeridos' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  const token = authHeader.split(' ')[1]
  const db = getDb(token)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })

  try {
    // ── Fetch project answers for context ─────────────────────────────────────
    const { data: questionsRow } = await db
      .from('project_questions')
      .select('answers_json')
      .eq('project_id', projectId)
      .single()

    const answers = questionsRow?.answers_json || {}
    // El nicho escrito por el alumno MANDA sobre las opciones de lista cerrada.
    // Va delante y fuera del JSON para que no lo tape el resto del contexto.
    const nichoLibre = String(
      (answers as Record<string, unknown>)?.nicho_libre ?? '',
    ).trim()
    const reglaNicho = nichoLibre
      ? `NICHO EXACTO, EN PALABRAS DEL ALUMNO: "${nichoLibre}"
` +
        `ESTA FRASE MANDA: si contradice cualquier opción marcada abajo, gana la frase. ` +
        `Todo lo que generes debe ser específico de ESE nicho, nunca de la industria genérica.

`
      : ''
    // El veredicto del semáforo se guarda junto a las respuestas, pero NO se le
    // manda al modelo: pedirle que analice un nicho mientras lee "está saturado"
    // le haría contradecirse en el mismo análisis que se le pide justificar.
    const { nicho_veredicto: _veredictoFuera, ...respuestasIA } =
      (answers ?? {}) as Record<string, unknown>
    const ctx = reglaNicho + JSON.stringify(respuestasIA)

    // ── GENERATE nicho + avatar + competencia ─────────────────────────────────
    if (operation === 'generate') {
      const [nichoRaw, avatarRaw, compRaw] = await Promise.all([
        generate(anthropic, `
Basado en estas respuestas de un emprendedor que quiere crear una agencia de IA:
${ctx}

Genera un análisis de nicho detallado en formato JSON:
${ESQUEMA_NICHO}`),

        generate(anthropic, promptAvatar(ctx)),
        generate(anthropic, promptCompetencia(ctx)),
      ])

      const nicho = parseJSON(nichoRaw)
      const avatar = parseJSON(avatarRaw)
      const competencia = parseJSON(compRaw)

      const results = await Promise.allSettled(filasDeLosTres(db, projectId, nicho, avatar, competencia))
      const errors = erroresDeGuardado(results)

      if (errors.length > 0) {
        console.error('[analysis/generate] Save errors:', errors)
        return res.status(500).json({
          error: 'Error al guardar análisis',
          details: errors,
          nicho,
          avatar,
          competencia,
        })
      }

      return res.status(200).json({ nicho, avatar, competencia })
    }

    // ── UPDATE nicho: rehace TAMBIÉN avatar y competencia ─────────────────────
    // Antes solo se regeneraba el nicho, así que tras corregirlo el avatar y los
    // competidores seguían apuntando al nicho ANTERIOR. Y como estrategia,
    // captación y calendario leen los tres bloques, el alumno seguía trabajando
    // con un contexto incoherente: es el "queda reducido y no me sirve".
    if (operation === 'update-nicho') {
      const { feedback } = req.body
      const nicho = await generarConForma(anthropic, promptFeedback({
        que: 'el análisis de nicho',
        feedback,
        actual: await nichoGuardado(db, projectId),
        ctx,
        esquema: ESQUEMA_NICHO,
      }), faltasNicho)

      // Con el nicho nuevo en mano se rehacen los otros dos ALINEADOS a él.
      const [avatar, competencia] = await Promise.all([
        generarConForma(anthropic, promptAvatar(ctx, nicho), faltasAvatar),
        generarConForma(anthropic, promptCompetencia(ctx, nicho), faltasCompetencia),
      ])

      const results = await Promise.allSettled(filasDeLosTres(db, projectId, nicho, avatar, competencia))
      const errores = erroresDeGuardado(results)
      if (errores.length > 0) {
        console.error('[analysis/update-nicho] Save errors:', errores)
        return res.status(500).json({ error: 'Error al guardar el nicho corregido', details: errores })
      }
      return res.status(200).json({ nicho, avatar, competencia })
    }

    // ── UPDATE avatar ─────────────────────────────────────────────────────────
    if (operation === 'update-avatar') {
      const { feedback } = req.body
      const [actual, nicho] = await Promise.all([
        guardado(db, 'project_avatar', projectId),
        nichoGuardado(db, projectId),
      ])
      const avatar = await generarConForma(anthropic, promptFeedback({
        que: 'el avatar',
        feedback,
        actual,
        ctx,
        nicho,
        esquema: ESQUEMA_AVATAR,
      }), faltasAvatar)
      const result = await db.from('project_avatar').upsert({
        project_id: projectId,
        name: avatar.name,
        age: avatar.age,
        data_json: JSON.stringify(avatar),
      }, { onConflict: 'project_id' })
      if (result.error) {
        console.error('[analysis/update-avatar] Save error:', result.error)
        return res.status(500).json({ error: 'Error al guardar avatar', details: result.error })
      }
      return res.status(200).json({ avatar })
    }

    // ── UPDATE competencia ────────────────────────────────────────────────────
    if (operation === 'update-competencia') {
      const { feedback } = req.body
      const [actual, nicho] = await Promise.all([
        guardado(db, 'project_competencia', projectId),
        nichoGuardado(db, projectId),
      ])
      const competencia = await generarConForma(anthropic, promptFeedback({
        que: 'el análisis de competencia',
        feedback,
        actual,
        ctx,
        nicho,
        esquema: ESQUEMA_COMPETENCIA,
        extra: 'Incluye exactamente 3 competidores, salvo que el feedback pida expresamente otro número.',
      }), faltasCompetencia)
      const result = await db.from('project_competencia').upsert({
        project_id: projectId,
        data_json: JSON.stringify(competencia),
      }, { onConflict: 'project_id' })
      if (result.error) {
        console.error('[analysis/update-competencia] Save error:', result.error)
        return res.status(500).json({ error: 'Error al guardar competencia', details: result.error })
      }
      return res.status(200).json({ competencia })
    }

    return res.status(400).json({ error: `Operación desconocida: ${operation}` })
  } catch (error: any) {
    // No se guardó nada: se avisa en claro en vez de devolver un 500 genérico.
    if (error instanceof ErrorDeForma) {
      console.warn(`[analysis/${operation}] forma inválida tras reintentar:`, error.faltas)
      await reportarError(error, { endpoint: 'analysis', operation, projectId, tipo: 'forma-ia', faltas: error.faltas })
      return res.status(422).json({
        error: 'La IA no devolvió el análisis completo, así que no hemos cambiado nada. Vuelve a intentarlo; si se repite, prueba a escribir el cambio con otras palabras.',
        faltas: error.faltas,
      })
    }
    console.error(`[analysis/${operation}]`, error)
    await reportarError(error, {
      endpoint: 'analysis',
      operation,
      projectId,
      status: error?.status,
      tipo: error?.error?.error?.type,
    })
    return res.status(500).json({
      error: error.message || 'Error en análisis',
      operation,
      projectId,
      hint: 'Visita /api/health desde el navegador para verificar configuración de Vercel',
    })
  }
}
