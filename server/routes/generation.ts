import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { createUserClient } from '../services/supabaseService'
import { generateWithClaude } from '../services/anthropicService'

const router = Router()
router.use(requireAuth as any)

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

function getToken(req: AuthRequest): string {
  return req.headers.authorization!.split(' ')[1]
}

async function getProjectAnswers(projectId: string, userId: string, token: string) {
  const db = createUserClient(token)

  const { data: project } = await db
    .from('projects')
    .select('name, description')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  const { data: questionsRow } = await db
    .from('project_questions')
    .select('answers_json')
    .eq('project_id', projectId)
    .single()

  return { project, answers: questionsRow?.answers_json || {} }
}

// POST /projects/:id/generate-nicho-avatar-competencia
router.post('/:id/generate-nicho-avatar-competencia', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { project, answers } = await getProjectAnswers(req.params.id, req.userId!, token)
    const ctx = JSON.stringify(answers)

    const [nichoRaw, avatarRaw, compRaw] = await Promise.all([
      generateWithClaude(`
        Basado en estas respuestas de un emprendedor que quiere crear una agencia de IA:
        ${ctx}

        Genera un análisis de nicho detallado en formato JSON:
        {
          "sector": "nombre del sector específico",
          "micronicho": "descripción del micronicho exacto",
          "tam": "rango de potenciales clientes (ej: 15,000-20,000)",
          "ticket": "rango de precio mensual recomendado (ej: €2,500-4,500/mes)",
          "trend": "crecimiento anual estimado (ej: ↑ 22% anual)",
          "momento": "¿Es buen momento para entrar? (1 oración)",
          "razon": "Explicación de 2-3 oraciones de por qué este nicho es ideal ahora mismo para una agencia de IA"
        }
      `),
      generateWithClaude(`
        Basado en estas respuestas del emprendedor:
        ${ctx}

        Crea un avatar de cliente ideal VÍVIDO y detallado en JSON:
        {
          "name": "nombre ficticio realista",
          "age": "rango de edad (ej: 38-45 años)",
          "position": "cargo/posición exacta",
          "experience": "años de experiencia en el sector",
          "income": "rango de ingresos mensuales",
          "goals": ["objetivo 1", "objetivo 2", "objetivo 3"],
          "pains": ["dolor 1", "dolor 2", "dolor 3"],
          "narrative": "Historia de 3-4 oraciones en primera persona que describe UN DÍA en su vida, sus frustraciones, y por qué necesita ayuda de IA"
        }
      `),
      generateWithClaude(`
        Basado en estas respuestas del emprendedor:
        ${ctx}

        Genera un análisis de competencia en JSON:
        {
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
        }

        Incluye exactamente 3 competidores.
      `),
    ])

    const nicho = parseJSON(nichoRaw)
    const avatar = parseJSON(avatarRaw)
    const competencia = parseJSON(compRaw)

    // Save to DB — non-blocking, don't fail the request if tables don't exist yet
    await Promise.allSettled([
      db.from('project_nicho').upsert({ project_id: req.params.id, ...nicho, data_json: nicho }, { onConflict: 'project_id' }),
      db.from('project_avatar').upsert({ project_id: req.params.id, ...avatar, data_json: avatar }, { onConflict: 'project_id' }),
      db.from('project_competencia').upsert({
        project_id: req.params.id, competitors_json: competencia.competitors,
        positioning: competencia.positioning, data_json: competencia
      }, { onConflict: 'project_id' }),
    ])

    res.json({ nicho, avatar, competencia })
  } catch (err: any) {
    console.error('[generate-nicho-avatar-competencia]', err?.message || err)
    res.status(500).json({ error: 'Error al generar análisis', detail: err?.message })
  }
})

// PUT /projects/:id/update-nicho
router.put('/:id/update-nicho', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { feedback } = req.body
    const { answers } = await getProjectAnswers(req.params.id, req.userId!, token)
    const raw = await generateWithClaude(`
      El usuario quiere modificar el análisis de nicho. Feedback: "${feedback}"
      Respuestas originales: ${JSON.stringify(answers)}
      Genera un nuevo nicho JSON con los mismos campos: sector, micronicho, tam, ticket, trend, momento, razon.
    `)
    const nicho = parseJSON(raw)
    await db.from('project_nicho').upsert({ project_id: req.params.id, ...nicho, data_json: nicho }, { onConflict: 'project_id' })
    res.json({ nicho })
  } catch { res.status(500).json({ error: 'Error al actualizar nicho' }) }
})

// PUT /projects/:id/update-avatar
router.put('/:id/update-avatar', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { feedback } = req.body
    const { answers } = await getProjectAnswers(req.params.id, req.userId!, token)
    const raw = await generateWithClaude(`
      El usuario quiere modificar el avatar. Feedback: "${feedback}"
      Respuestas originales: ${JSON.stringify(answers)}
      Genera un nuevo avatar JSON con los mismos campos: name, age, position, experience, income, goals, pains, narrative.
    `)
    const avatar = parseJSON(raw)
    await db.from('project_avatar').upsert({ project_id: req.params.id, ...avatar, data_json: avatar }, { onConflict: 'project_id' })
    res.json({ avatar })
  } catch { res.status(500).json({ error: 'Error al actualizar avatar' }) }
})

// PUT /projects/:id/update-competencia
router.put('/:id/update-competencia', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { feedback } = req.body
    const { answers } = await getProjectAnswers(req.params.id, req.userId!, token)
    const raw = await generateWithClaude(`
      El usuario quiere modificar el análisis de competencia. Feedback: "${feedback}"
      Respuestas originales: ${JSON.stringify(answers)}
      Genera un nuevo análisis JSON con: competitors (3), positioning, opportunity.
    `)
    const competencia = parseJSON(raw)
    await db.from('project_competencia').upsert({
      project_id: req.params.id, competitors_json: competencia.competitors,
      positioning: competencia.positioning, data_json: competencia
    }, { onConflict: 'project_id' })
    res.json({ competencia })
  } catch { res.status(500).json({ error: 'Error al actualizar competencia' }) }
})

// GET /projects/:id/tools/:toolId — check if output already exists
router.get('/:id/tools/:toolId', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db    = createUserClient(token)
    const { data } = await db
      .from('project_tools')
      .select('result_json, updated_at')
      .eq('project_id', req.params.id)
      .eq('tool_id', req.params.toolId)
      .maybeSingle()

    if (data) {
      res.json({ exists: true, result: data.result_json, updated_at: data.updated_at })
    } else {
      res.json({ exists: false })
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar herramienta' })
  }
})

// PATCH /projects/:id/tools/calendario/update-day — update a single day in the calendar
router.patch('/:id/tools/calendario/update-day', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db    = createUserClient(token)
    const { weekIndex, dayIndex, updates } = req.body as { weekIndex: number; dayIndex: number; updates: Record<string, string> }

    const { data } = await db
      .from('project_tools')
      .select('result_json')
      .eq('project_id', req.params.id)
      .eq('tool_id', 'calendario')
      .single()

    if (!data) { res.status(404).json({ error: 'Calendario no encontrado' }); return }

    const content = data.result_json as { weeks: Array<{ week: number; days: unknown[] }> }
    if (content.weeks?.[weekIndex]?.days?.[dayIndex] != null) {
      content.weeks[weekIndex].days[dayIndex] = {
        ...(content.weeks[weekIndex].days[dayIndex] as object),
        ...updates,
      }
    }

    await db.from('project_tools')
      .update({ result_json: content, updated_at: new Date().toISOString() })
      .eq('project_id', req.params.id)
      .eq('tool_id', 'calendario')

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar día' })
  }
})

// DELETE /projects/:id/tools/calendario/day — remove a single day from the calendar
router.delete('/:id/tools/calendario/day', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db    = createUserClient(token)
    const { weekIndex, dayIndex } = req.body as { weekIndex: number; dayIndex: number }

    const { data } = await db
      .from('project_tools')
      .select('result_json')
      .eq('project_id', req.params.id)
      .eq('tool_id', 'calendario')
      .single()

    if (!data) { res.status(404).json({ error: 'Calendario no encontrado' }); return }

    const content = data.result_json as { weeks: Array<{ week: number; days: unknown[] }> }
    content.weeks?.[weekIndex]?.days?.splice(dayIndex, 1)

    await db.from('project_tools')
      .update({ result_json: content, updated_at: new Date().toISOString() })
      .eq('project_id', req.params.id)
      .eq('tool_id', 'calendario')

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar día' })
  }
})

// PATCH /projects/:id/tools/tracker/update-month — update a single month in the tracker
router.patch('/:id/tools/tracker/update-month', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db    = createUserClient(token)
    const { monthIndex, month } = req.body as {
      monthIndex: number
      month: {
        ingresos: Record<string, number>
        gastos: Record<string, number>
        profit: number
        margen: number
        nota?: string
      }
    }

    const { data } = await db
      .from('project_tools')
      .select('result_json')
      .eq('project_id', req.params.id)
      .eq('tool_id', 'tracker')
      .single()

    if (!data) { res.status(404).json({ error: 'Tracker no encontrado' }); return }

    const content = data.result_json as {
      months: Array<Record<string, unknown>>
      summary: Record<string, number>
    }

    content.months[monthIndex] = { ...content.months[monthIndex], ...month }

    // Recalculate summary
    const allMonths = content.months as Array<{ ingresos: { total: number }; gastos: { total: number }; profit: number; margen: number }>
    const totalIngresos = allMonths.reduce((s, m) => s + (m.ingresos?.total || 0), 0)
    const totalGastos   = allMonths.reduce((s, m) => s + (m.gastos?.total  || 0), 0)
    const totalProfit   = allMonths.reduce((s, m) => s + (m.profit || 0), 0)
    const margenPromedio = totalIngresos > 0 ? Math.round((totalProfit / totalIngresos) * 100) : 0

    content.summary = { total_ingresos: totalIngresos, total_gastos: totalGastos, total_profit: totalProfit, margen_promedio: margenPromedio }

    await db.from('project_tools')
      .update({ result_json: content, updated_at: new Date().toISOString() })
      .eq('project_id', req.params.id)
      .eq('tool_id', 'tracker')

    res.json({ ok: true, summary: content.summary })
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar mes' })
  }
})

// Generic tool generator — POST /projects/:id/tools/:toolId
router.post('/:id/tools/:toolId', async (req: AuthRequest, res: Response) => {
  try {
    const token = getToken(req)
    const db = createUserClient(token)
    const { toolId } = req.params
    const toolAnswers: Record<string, string> = req.body.toolAnswers || {}
    const { answers } = await getProjectAnswers(req.params.id, req.userId!, token)

    const [nichoRow, avatarRow, compRow] = await Promise.all([
      db.from('project_nicho').select('data_json').eq('project_id', req.params.id).single(),
      db.from('project_avatar').select('data_json').eq('project_id', req.params.id).single(),
      db.from('project_competencia').select('data_json').eq('project_id', req.params.id).single(),
    ])

    const projectCtx = `
PERFIL DEL NEGOCIO (del cuestionario inicial):
- Nicho: ${JSON.stringify(nichoRow.data?.data_json || answers)}
- Avatar ideal: ${JSON.stringify(avatarRow.data?.data_json || {})}
- Análisis de competencia: ${JSON.stringify(compRow.data?.data_json || {})}
`
    const toolCtx = Object.keys(toolAnswers).length > 0
      ? `\nPARAMETROS ESPECÍFICOS (del usuario para esta herramienta):\n${Object.entries(toolAnswers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : ''

    const ctx = projectCtx + toolCtx

    const prompts: Record<string, string> = {
      calendario: `Eres un senior content strategist con 15 años de experiencia en marketing digital para agencias de IA.
${ctx}

Crea un calendario de contenido de 4 semanas ultra personalizado basado en:
- Frecuencia: ${toolAnswers.frecuencia || '3x/semana'}
- Plataformas: ${toolAnswers.plataformas || 'Instagram, LinkedIn'}
- Temas principales: ${toolAnswers.temas || 'automatización, productividad, IA'}
- Horario de publicación: ${toolAnswers.horario || 'Tardes (17-19h)'}
- Tipo de contenido: ${toolAnswers.tipo_contenido || 'Educativo'}
- Fase de la audiencia: ${toolAnswers.fase_audiencia || 'Tibia'}

Cada pieza debe ser ESPECÍFICA (no genérica): incluye el ángulo exacto, el hook y por qué funciona para este nicho.
Devuelve SOLO JSON: { "weeks": [{ "week": 1, "days": [{ "day": "Lunes", "type": "Reel|Carrusel|Story|Post|Video|Email", "content": "Descripción específica del contenido con ángulo y hook", "timing": "18:00h" }] }] }
Genera semanas 1, 2, 3 y 4. Cada semana 7-8 piezas de contenido.`,

      vsl: `Eres el mejor copywriter de Video Sales Letters del mundo hispanohablante, con 200+ VSLs creados.
${ctx}

Crea un script VSL de ventas de alta conversión con estos parámetros específicos:
- Dolor profundo del cliente: ${toolAnswers.dolor || 'no especificado'}
- Resultado prometido: ${toolAnswers.resultado || 'no especificado'}
- Objeciones a destruir: ${toolAnswers.objeciones || 'no especificado'}
- Autoridad/credenciales: ${toolAnswers.autoridad || 'no especificado'}
- Garantía ofrecida: ${toolAnswers.garantia || 'no especificado'}
- CTA final: ${toolAnswers.cta || 'Agendar llamada gratuita'}
- Tono: ${toolAnswers.tono || 'Cercano y empático'}

El script debe ser ESPECÍFICO, NO genérico. Usa el dolor real del avatar, la autoridad real del creador.
Devuelve SOLO JSON: { "sections": [{ "label": "HOOK (0-5s)", "timing": "0-5s", "content": "texto exacto del script" }, { "label": "PROBLEMA Y AGITACIÓN (5-30s)", "timing": "5-30s", "content": "..." }, { "label": "HISTORIA Y AUTORIDAD (30-90s)", "timing": "30-90s", "content": "..." }, { "label": "SOLUCIÓN (90-150s)", "timing": "90-150s", "content": "..." }, { "label": "PRUEBA SOCIAL (150-180s)", "timing": "150-180s", "content": "..." }, { "label": "OFERTA Y GARANTÍA (180-210s)", "timing": "180-210s", "content": "..." }, { "label": "CTA FINAL (210-165s)", "timing": "210s+", "content": "..." }] }`,

      reels: `Eres un creador de contenido viral con 10M+ de seguidores experto en Reels e IA.
${ctx}

Crea 3 guiones de Reels VIRALES con estos parámetros:
- Tipo de reel: ${toolAnswers.tipo || 'Educativo'}
- Estilo de hook: ${toolAnswers.hook || 'Dato sorprendente'}
- Duración: ${toolAnswers.duracion || '30 segundos'}
- Edición: ${toolAnswers.edicion || 'Cuts rápidos + texto'}
- Mensaje a comunicar: ${toolAnswers.mensaje || 'no especificado'}
- CTA: ${toolAnswers.cta || 'Seguir la cuenta'}

Cada guion debe incluir: HOOK (primeros 3 segundos), DESARROLLO, CTA. Indica qué texto aparece en pantalla con [TEXTO:].
Devuelve SOLO JSON: { "scripts": ["GUION 1:\\n[ESCENA: descripción]\\n[TEXTO: texto pantalla]\\nVoz en off: texto hablado\\n\\n[ESCENA 2]...", "GUION 2:...", "GUION 3:..."] }`,

      copy: `Eres un growth hacker y copywriter especialista en paid ads con 100M+ en ad spend gestionado.
${ctx}

Crea 5 ad copies de alta conversión con:
- Tipo de copy: ${toolAnswers.tipo || 'Pain'}
- Plataforma: ${toolAnswers.plataforma || 'Facebook Ads'}
- Temperatura audiencia: ${toolAnswers.temperatura || 'Fría'}
- Objeción #1 a romper: ${toolAnswers.objecion || 'no especificado'}
- Beneficio más irresistible: ${toolAnswers.beneficio || 'no especificado'}
- Objetivo de campaña: ${toolAnswers.objetivo || 'Leads'}

Cada copy: HEADLINE (máx 40 caracteres) + CUERPO (3-4 líneas) + CTA específico. Sé directo, específico, sin clichés.
Devuelve SOLO JSON: { "copies": ["COPY 1\\n\\nHEADLINE: texto\\n\\nCUERPO:\\ntexto\\n\\nCTA: texto", "COPY 2:...", "COPY 3:...", "COPY 4:...", "COPY 5:..."] }`,

      imagenes: `You are a world-class AI image generation expert specializing in dark luxury aesthetics (Apple, Rolex, Netflix, Lamborghini visual language). Expert in Midjourney v6, DALL-E 3, and Stable Diffusion XL.
${ctx}

Brand context:
- Industry: ${toolAnswers.tema || 'digital agency / AI services'}
- Visual style preference: ${toolAnswers.estilo || 'Dark luxury, minimalist premium'}
- Brand colors: ${toolAnswers.colores || 'deep black, electric cyan, white'}
- Target audience: ${toolAnswers.audiencia || 'high-ticket entrepreneurs and executives'}
- Image types needed: ${toolAnswers.tipo_imagen || 'Varied (product + scene + result)'}

Generate 6 image prompts with DARK LUXURY aesthetic as primary direction:
- Cinematic quality, dramatic lighting, deep blacks with accent highlights
- Post-vertical 1080x1440px (3:4 portrait) as PRIMARY format — optimized for Instagram feed posts
- Premium materials: brushed metal, frosted glass, leather, carbon fiber textures
- Atmosphere: aspirational, exclusive, high-production-value
- People: confident, diverse, sharp-dressed professionals in premium environments

Cover these types (one each):
1. HERO — product/service shown in premium dark environment with dramatic lighting
2. LIFESTYLE — person using the service in luxury/professional setting
3. RESULTADO — dramatic before/after or transformation visualization
4. AMBIENTE — premium workspace, office, or aspirational location
5. DATO — clean typographic/data visualization on dark background
6. EMOCION — abstract concept conveying success, power, transformation

ALL prompts in ENGLISH. Each prompt must include: subject, environment, lighting, mood, composition, technical specs.

Return ONLY JSON:
{
  "prompts": [
    {
      "titulo": "Nombre descriptivo en español",
      "descripcion": "Para qué sirve esta imagen (1-2 frases en español)",
      "tipo": "Hero|Lifestyle|Resultado|Ambiente|Dato|Emoción",
      "prompt": "cinematic dark luxury [subject], [environment], dramatic moody lighting, deep shadows with [accent color] highlights, ultra-sharp detail, premium texture, bokeh background, 3:4 portrait composition optimized for vertical feed post, shot on Phase One IQ4, editorial quality, hyperrealistic --ar 3:4 --v 6.1 --style raw --q 2",
      "negative_prompt": "bright background, flat lighting, amateur, stock photo look, overexposed, cluttered, cheap, watermark, text overlay, low quality, 1:1 square",
      "formato": "Post vertical 1080×1440px (3:4)"
    }
  ]
}`,

      carruseles: `Eres un estratega de Instagram con 500+ carruseles virales creados para agencias y coaches.
${ctx}

Crea 8 estructuras de carrusel con:
- Objetivo: ${toolAnswers.objetivo || 'Educar sobre problema'}
- Número de slides: ${toolAnswers.slides || '7 slides'}
- Tema: ${toolAnswers.tema || 'no especificado'}
- CTA final: ${toolAnswers.cta || 'Guardar este carrusel'}
- Estilo de texto: ${toolAnswers.estilo || 'Bullet points cortos'}

Cada carrusel: SLIDE 1 (hook/título), SLIDES 2-6 (contenido progresivo), SLIDE FINAL (CTA). Sé específico con el contenido de cada slide.
Devuelve SOLO JSON: { "carousels": ["CARRUSEL 1: [Título]\\n\\nSlide 1: texto hook\\nSlide 2: texto\\n...\\nSlide final: CTA específico", "CARRUSEL 2:...", "...8 carruseles"] }`,

      website: (() => {
        const siteType = toolAnswers.siteType || 'landing-leads'
        const colors   = toolAnswers.colors    || 'azul y blanco'
        const extra    = toolAnswers.additional || ''

        const siteTypePrompts: Record<string, string> = {
          'landing-leads': `Eres el mejor copywriter de landing pages de captación de leads de habla hispana.
${ctx}

Crea el copy completo de una landing page de captación de leads con estas secciones:

SECCIÓN 1 — PUV (Propuesta Única de Valor)
- Titular impactante (quién eres, para quién, qué resultado)
- Subtítulo persuasivo
- Botón CTA → WhatsApp / Llamada

SECCIÓN 2 — Dolores del Avatar
- 4-5 problemas reales y específicos del avatar
- Consecuencias de no resolverlos

SECCIÓN 3 — Deseos del Avatar
- Resultado aspiracional que quieren
- Cómo se quieren sentir
- Impacto en su negocio/vida

SECCIÓN 4 — ¿Por qué conmigo y no con otro?
- Presentación breve y diferenciadora
- Enfoque único / método propio
- Prueba de autoridad

SECCIÓN 5 — Mi Proceso de Trabajo
- Paso 1, Paso 2, Paso 3 (proceso propio del usuario)
- Qué puede esperar el cliente

SECCIÓN 6 — CTA FINAL
- Copy del botón WhatsApp
- Copy del botón Agendar llamada
- Cierre persuasivo de urgencia

Paleta de colores sugerida: ${colors}
Requisitos adicionales: ${extra}

Devuelve SOLO JSON: { "siteType": "landing-leads", "content": "COPY COMPLETO\\n\\n[todas las secciones bien formateadas con headers y copy específico basado en el avatar y nicho reales]" }`,

          'landing-venta': `Eres el mejor copywriter de high-ticket sales pages del mundo hispanohablante.
${ctx}

Crea el copy completo de una landing page de venta directa con:

SECCIÓN 1 — Hero + USP
- Titular que convierte (beneficio + diferenciador)
- Subtítulo con promesa específica
- CTA primario con microcopy

SECCIÓN 2 — Problema + Solución
- El pain point principal (específico, visceral)
- Por qué las soluciones genéricas fallan
- Tu solución diferenciada

SECCIÓN 3 — Beneficios (NO features)
- 5-6 beneficios emocionales y concretos
- Resultados esperados con números

SECCIÓN 4 — Sobre el Creador / Autoridad
- Credenciales relevantes
- Historia de origen
- Resultados propios y de clientes

SECCIÓN 5 — Testimonios (estructura)
- 3 testimonios tipo (antes→ después con números)

SECCIÓN 6 — Pricing (estructura)
- 3 paquetes (Starter, Pro, Premium)
- Justificación de valor de cada uno

SECCIÓN 7 — CTA Final + Risk Reversal
- Garantía / reducción de riesgo
- Urgencia real
- Botón final

Paleta de colores: ${colors}
Requisitos adicionales: ${extra}

Devuelve SOLO JSON: { "siteType": "landing-venta", "content": "COPY COMPLETO\\n\\n[todas las secciones]" }`,

          'blog-seo': `Eres el mejor SEO strategist y content planner del mercado hispanohablante.
${ctx}

Crea una estrategia completa de blog/SEO con:

PARTE 1 — Keywords Objetivo (clasificadas por funnel)
- TOFU (awareness): 5 keywords con volumen estimado
- MOFU (consideration): 5 keywords transaccionales
- BOFU (decision): 5 keywords de compra

PARTE 2 — Pillar Page (artículo de autoridad)
- Título, estructura H1/H2/H3
- 2500+ palabras de outline
- Keywords a incluir

PARTE 3 — 7 Cluster Articles
- Título + keyword objetivo + outline de 1200 palabras cada uno

PARTE 4 — Calendario de Publicación (12 semanas)
- Qué publicar cada semana
- Frecuencia y distribución

PARTE 5 — Link Building
- Estrategia de backlinks específica para el nicho
- Guest posting targets
- Internal linking structure

Paleta de colores para el blog: ${colors}
Requisitos adicionales: ${extra}

Devuelve SOLO JSON: { "siteType": "blog-seo", "content": "ESTRATEGIA COMPLETA\\n\\n[todas las partes]" }`,

          'portfolio': `Eres un especialista en portfolio de servicios creativos y de consultoría.
${ctx}

Crea el copy completo de un portfolio/showcase con:

SECCIÓN 1 — Hero
- Titular de posicionamiento (quién eres + para quién + qué logras)
- Subtítulo con diferenciador
- CTA para contacto

SECCIÓN 2 — Proyectos (estructura para 5 casos)
Por cada caso:
- Nombre del proyecto / cliente (anonimizado)
- El desafío que tenían
- Tu solución específica
- Resultados con números
- Quote del cliente

SECCIÓN 3 — Metodología
- Proceso en 3-5 pasos
- Qué hace diferente tu proceso
- Qué puede esperar el cliente

SECCIÓN 4 — Métricas Clave
- Proyectos completados, ROI promedio, tiempo de entrega

SECCIÓN 5 — Testimonios (3 testimonios tipo)

SECCIÓN 6 — CTA para contacto
- Copy para formulario de contacto o Calendly

Paleta de colores: ${colors}
Requisitos adicionales: ${extra}

Devuelve SOLO JSON: { "siteType": "portfolio", "content": "COPY COMPLETO\\n\\n[todas las secciones]" }`,

          'community': `Eres el mejor growth marketer especialista en comunidades y membership sites.
${ctx}

Crea el copy completo de una página de venta de comunidad/membership con:

SECCIÓN 1 — Hero
- Qué es la comunidad (específico, no genérico)
- Para quién es
- El resultado prometido

SECCIÓN 2 — El Problema que Resuelve
- Por qué estar solo falla
- Costos de no tener una comunidad de referencia

SECCIÓN 3 — Qué Recibes (beneficios reales)
- Acceso a X
- Llamadas semanales de Y
- Recursos de Z
- Red de N personas

SECCIÓN 4 — Para Quién ES / NO ES
- Perfil ideal del miembro
- Anti-avatar (a quién no sirve)

SECCIÓN 5 — Historia del Fundador
- Por qué creé esto
- Qué me faltaba a mí

SECCIÓN 6 — Testimonios de Miembros
- 3 historias de transformación

SECCIÓN 7 — Pricing + CTA
- Mensual vs Anual
- Garantía
- Botón de acceso

Paleta de colores: ${colors}
Requisitos adicionales: ${extra}

Devuelve SOLO JSON: { "siteType": "community", "content": "COPY COMPLETO\\n\\n[todas las secciones]" }`,
        }

        return siteTypePrompts[siteType] || siteTypePrompts['landing-leads']
      })(),

      propuesta: `Eres un consultor senior de ventas B2B con 20 años cerrando contratos de 5 y 6 cifras.
${ctx}

Crea una propuesta comercial profesional y persuasiva con:
- Servicio propuesto: ${toolAnswers.servicio || 'automatización con IA'}
- Duración: ${toolAnswers.duracion || '3 meses'}
- Entregables: ${toolAnswers.deliverables || 'no especificados'}
- Inversión: ${toolAnswers.inversion || 'a definir'}
- Resultado prometido: ${toolAnswers.resultado || 'aumento de productividad'}
- Forma de pago: ${toolAnswers.pago || 'Mensual'}

La propuesta debe ser PERSUASIVA: enfocada en valor/ROI, no en características técnicas. Incluye: Resumen ejecutivo, El problema, La solución, Entregables, Timeline, Inversión, Garantía, Próximos pasos.
Devuelve SOLO JSON: { "content": "PROPUESTA COMERCIAL\\n\\n[texto completo bien estructurado con todas las secciones]" }`,

      precios: `Eres un pricing strategist especialista en agencias de servicios digitales y SaaS.
${ctx}

Crea 3 paquetes de precios estratégicos con:
- Servicio central: ${toolAnswers.servicio || 'automatización con IA'}
- Horas por cliente: ${toolAnswers.horas || '5-8h/semana'}
- Experiencia: ${toolAnswers.experiencia || '2-3 años'}
- Mercado: ${toolAnswers.mercado || 'España/Europa'}
- Modelo preferido: ${toolAnswers.modelo || 'Retainer mensual'}
- Diferencial: ${toolAnswers.diferencial || 'especialización en nicho'}
- Precio mínimo: ${toolAnswers.minimo || '€1,000/mes'}

Los 3 paquetes (Starter, Growth, Enterprise) deben tener pricing estratégico (ancla, middle, premium). Justifica cada precio con valor entregado.
Devuelve SOLO JSON: { "packages": [{ "name": "Starter", "price": "€X,XXX/mes", "description": "descripción del paquete", "features": ["feature específica 1", "feature 2", "feature 3", "feature 4"], "ideal": "Ideal para..." }] }
Los 3 paquetes: Starter, Growth, Enterprise.`,

      pitch: `Eres un pitch coach que ha ayudado a levantar +50M€ en inversión y cerrar contratos millonarios.
${ctx}

Crea un pitch deck de 8 slides poderoso para:
- Audiencia: ${toolAnswers.audiencia || 'Clientes potenciales'}
- Objetivo: ${toolAnswers.objetivo || 'Cerrar venta'}
- Duración: ${toolAnswers.duracion || '10-15 minutos'}
- Datos disponibles: ${toolAnswers.datos || 'no especificados'}
- Problema central: ${toolAnswers.problema || 'no especificado'}
- Diferenciador: ${toolAnswers.diferenciador || 'no especificado'}
- CTA final: ${toolAnswers.cta || 'Agendar siguiente reunión'}

Cada slide: título impactante + contenido específico (bullets, estadísticas, copy real) + speaker notes (qué decir exactamente).
Devuelve SOLO JSON: { "slides": [{ "number": 1, "title": "título", "content": "contenido detallado", "notes": "qué decir al presentar" }] }
Slides: 1-El Problema, 2-El Costo de No Actuar, 3-La Solución, 4-Cómo Funciona, 5-Para Quién, 6-Resultados/Prueba Social, 7-Inversión, 8-Próximos Pasos`,

      emails: `Eres el mejor email marketer de habla hispana, especialista en automatizaciones de alta conversión.
${ctx}

Crea una secuencia de emails completa con:
- Tipo de secuencia: ${toolAnswers.tipo || 'Bienvenida/Nurturing'}
- Número de emails: ${toolAnswers.num || '5 emails'}
- Cadencia: ${toolAnswers.cadencia || 'Cada 2-3 días'}
- Objetivo final: ${toolAnswers.objetivo || 'agendar llamada'}
- Objeción principal a resolver: ${toolAnswers.objecion || 'no especificada'}
- Tono: ${toolAnswers.tono || 'Cercano y personal'}

Cada email: subject line (A/B: 2 opciones) + body completo (personalizable con variables). Progresión psicológica clara entre emails.
Devuelve SOLO JSON: { "sequences": [{ "name": "nombre de la secuencia", "emails": [{ "subject": "asunto del email (A: opción A | B: opción B)", "body": "body completo del email con [NOMBRE], [EMPRESA] como variables" }] }] }`,

      ofertas: `Eres un growth hacker especialista en ofertas irresistibles y copywriting de conversión directa.
${ctx}

Crea 3 ofertas irresistibles con:
- Tipo de oferta: ${toolAnswers.tipo || 'Descuento especial'}
- Objetivo: ${toolAnswers.objetivo || 'Captar nuevos clientes'}
- Duración: ${toolAnswers.duracion || '1 semana'}
- Contenido de la oferta: ${toolAnswers.contenido || 'no especificado'}
- Urgencia real: ${toolAnswers.urgencia || 'cupos limitados'}

Cada oferta: título impactante + copy completo (problema → solución → oferta → urgencia → CTA → post-script). Lista para copiar y usar en cualquier canal.
Devuelve SOLO JSON: { "offers": ["OFERTA 1\\n\\nTÍTULO: texto\\n\\nHEY [NOMBRE]:\\n\\ncopy completo de la oferta...", "OFERTA 2:...", "OFERTA 3:..."] }`,

      contrato: `Eres un abogado especialista en contratos de servicios digitales y tecnología.
${ctx}

Crea un contrato de servicios profesional y protector con:
- Tipo de servicio: ${toolAnswers.servicio || 'automatización con IA'}
- Duración: ${toolAnswers.duracion || '3 meses'}
- Inversión y pago: ${toolAnswers.inversion || 'a definir'}
- Entregables: ${toolAnswers.deliverables || 'no especificados'}
- Propiedad intelectual: ${toolAnswers.ip || 'El cliente'}
- Jurisdicción: ${toolAnswers.jurisdiccion || 'España'}

Incluye: partes, objeto, alcance, duración, precio, forma de pago, entregables, derechos de IP, confidencialidad, limitación responsabilidad, terminación, resolución de disputas, firmas.
Devuelve SOLO JSON: { "content": "CONTRATO DE PRESTACIÓN DE SERVICIOS\\n\\n[texto legal completo bien estructurado]" }`,

      tracker: `Eres un CFO de agencias digitales especialista en modelado financiero y proyecciones.
${ctx}

Crea un tracker financiero mensual detallado con proyecciones para:
- Ingreso mensual promedio actual: ${toolAnswers.ingreso_mensual || '5000'}
- Gastos fijos mensuales: ${toolAnswers.gastos_fijos || '1200'}
- Gastos variables mensuales: ${toolAnswers.gastos_variables || '300'}
- Proyección de crecimiento: ${toolAnswers.crecimiento_anual || '20%'} anual
- Período de análisis: ${toolAnswers.periodo || '6'} meses

Proyecta el crecimiento mes a mes de forma REALISTA. Desglosa ingresos en categorías (servicios, productos, otros) y gastos en categorías (software, hosting, marketing, personal, otros).
Los números deben ser coherentes y el crecimiento progresivo.

Devuelve SOLO JSON:
{
  "months": [
    {
      "month": "Enero",
      "year": 2024,
      "ingresos": { "servicios": número, "productos": número, "otros": número, "total": número },
      "gastos": { "software": número, "hosting": número, "marketing": número, "personal": número, "otros": número, "total": número },
      "profit": número,
      "margen": número (porcentaje con 2 decimales),
      "nota": "insight clave de este mes en 1 frase"
    }
  ],
  "summary": {
    "total_ingresos": número,
    "total_gastos": número,
    "total_profit": número,
    "margen_promedio": número
  }
}
Genera exactamente ${toolAnswers.periodo || '6'} meses con progresión de crecimiento lógica.`,

      casos: `Eres un investigador de casos de uso de IA empresarial con acceso a los mejores casos del mundo.
${ctx}

Genera 10 casos de uso de IA ultra específicos y accionables para:
- Industria: ${toolAnswers.industria || 'el nicho del usuario'}
- Tipo de resultado buscado: ${toolAnswers.resultado || 'automatización'}
- Tamaño de empresa: ${toolAnswers.tamano || 'Pequeña empresa'}
- Área de IA: ${toolAnswers.area || 'Automatización de ventas'}

Cada caso debe ser REAL y ESPECÍFICO: nombre ficticio de empresa, problema concreto, solución de IA exacta con herramientas mencionadas, resultado medible en números.
Devuelve SOLO JSON: { "cases": [{ "title": "título específico del caso", "problem": "problema concreto que tenían", "solution": "cómo exactamente lo resolvió con IA (herramientas específicas)", "result": "resultado medible: % ahorro, € generados, horas recuperadas" }] }`,

      'clone-winner': `You are a senior growth strategist and social media intelligence analyst with 15+ years analyzing top creators and online businesses.

Business context:
${ctx}

COMPETITOR TO ANALYZE:
- Handle/Name: ${toolAnswers.handle || '@competitor'}
- Platform: ${toolAnswers.platform || 'Instagram'}
- Website/Landing: ${toolAnswers.url || 'not provided'}

Based on this competitor profile AND the user's business context, generate a DEEP competitive intelligence analysis. Infer realistic data based on the handle/niche described. Be SPECIFIC with numbers.

Return ONLY JSON:
{
  "handle": "${toolAnswers.handle || '@competitor'}",
  "platform": "${toolAnswers.platform || 'Instagram'}",
  "executive_summary": {
    "estimated_followers": "string (ej: 150K)",
    "engagement_rate": "string (ej: 8.2%)",
    "posts_per_week": número,
    "estimated_revenue_monthly": "string (ej: $45K-60K/mes)",
    "content_volume": "string (ej: 11 posts/semana)",
    "key_success_factors": ["factor 1", "factor 2", "factor 3"]
  },
  "content_mix": [
    { "type": "tipo de contenido", "percentage": número, "engagement_rate": número, "is_winner": booleano, "why_it_works": "explicación" }
  ],
  "your_content_mix": [
    { "type": "tipo adaptado a tu caso", "percentage": número, "reasoning": "por qué este % para ti" }
  ],
  "schedule": {
    "posts_per_week": número,
    "best_hours": ["18:00", "12:00"],
    "best_days": ["Lunes", "Miércoles", "Viernes"],
    "your_recommendation": {
      "posts_per_week": número,
      "schedule": { "Lunes": "tipo de post", "Martes": "tipo de post", "Miércoles": "tipo de post", "Jueves": "tipo de post", "Viernes": "tipo de post", "Sábado": "tipo de post" },
      "reasoning": "por qué este horario para ti"
    }
  },
  "aesthetics": {
    "color_palette": ["color 1", "color 2", "color 3"],
    "typography_style": "descripción",
    "photo_style": ["característica 1", "característica 2", "característica 3"],
    "your_recommendation": {
      "palette": ["color 1 adaptado", "color 2"],
      "style": "descripción del estilo adaptado",
      "differentiation": "cómo diferenciarte visualmente"
    }
  },
  "copy_analysis": {
    "top_hooks": [{ "hook": "texto del hook", "count": número, "type": "curiosidad|dolor|sorpresa|urgencia" }],
    "top_ctas": [{ "cta": "texto CTA", "usage_pct": número }],
    "tone_of_voice": "descripción del tono",
    "your_hooks": [{ "hook": "hook adaptado a tu negocio", "why": "por qué funciona para ti" }],
    "your_ctas": [{ "cta": "CTA adaptada", "context": "cuándo usarla" }],
    "key_differentiation": "tu copy diferenciador vs ellos en 1-2 frases"
  },
  "landing_page": {
    "headline": "headline estimado",
    "subheadline": "subheadline estimado",
    "social_proof": "descripción prueba social",
    "cta_text": "texto botón CTA",
    "form_fields": número,
    "guarantee": "descripción garantía si la tiene",
    "your_improvements": ["mejora 1 que deberías aplicar", "mejora 2", "mejora 3"]
  },
  "score": {
    "overall": número (0-100),
    "market_difference": número (0-100),
    "adaptability": número (0-100),
    "timeline_months": número,
    "summary": "una frase sobre la viabilidad de clonar esta estrategia"
  },
  "implementation_plan": {
    "week1": { "title": "Setup y Preparación", "hours": número, "tasks": ["tarea específica 1", "tarea 2", "tarea 3", "tarea 4", "tarea 5"] },
    "week2": { "title": "Publicación Consistente", "hours": número, "tasks": ["tarea 1", "tarea 2", "tarea 3"] },
    "week3": { "title": "Medir y Optimizar", "hours": número, "tasks": ["tarea 1", "tarea 2", "tarea 3"] },
    "month1_results": {
      "engagement_improvement": "ej: 2% → 6-8%",
      "followers_growth": "ej: +300-500 orgánico",
      "leads_per_week": "ej: 3-5 leads/semana",
      "estimated_revenue": "ej: $5K-10K"
    }
  }
}`,
    }

    const prompt = prompts[toolId]
    if (!prompt) {
      res.status(404).json({ error: 'Herramienta no encontrada' })
      return
    }

    const raw = await generateWithClaude(prompt)

    const result = parseJSON(raw) as Record<string, unknown>

    // Ensure siteType is preserved (AI may omit it even if instructed)
    if (toolId === 'website' && toolAnswers.siteType) {
      result.siteType = toolAnswers.siteType
    }

    await db.from('project_tools').upsert({
      project_id: req.params.id,
      tool_id: toolId,
      result_json: result,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,tool_id' })

    res.json({ result })
  } catch (err) {
    console.error('[Tool generation error]', err)
    res.status(500).json({ error: 'Error al generar herramienta' })
  }
})

export default router
