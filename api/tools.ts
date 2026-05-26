import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import type { VercelRequest, VercelResponse } from "@vercel/node"

// ─── Supabase client with user JWT (respects RLS) ──────────────────────────────
function getDb(token: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

function parseJSON<T>(raw: string): T {
  // Strip code fences
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  // If Claude prefixed/suffixed text, try to extract the JSON block
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (objMatch) cleaned = objMatch[0]
    else if (arrMatch) cleaned = arrMatch[0]
  }

  try {
    return JSON.parse(cleaned)
  } catch {
    // Detect truncation — el último carácter no es } o ]
    const lastChar = cleaned.trim().slice(-1)
    const looksTruncated = lastChar !== '}' && lastChar !== ']'
    const hint = looksTruncated
      ? 'Respuesta TRUNCADA — sube max_tokens para esta herramienta'
      : 'JSON malformado'
    throw new Error(`${hint}. Últimos 200 chars: ${cleaned.slice(-200)}`)
  }
}

// Per-tool max_tokens — los tools con JSON gigante necesitan más
const TOOL_MAX_TOKENS: Record<string, number> = {
  'clone-winner': 16000,  // schema enorme: executive_summary + content_mix + schedule + aesthetics + copy + landing + score + plan
  'calendario':    12000, // 4 semanas × 7-8 días de contenido detallado
  'imagenes':      10000, // 6 prompts largos con todos los specs
  'carruseles':    10000, // 8 carruseles × 7 slides
  'emails':         8000, // múltiples emails con A/B subjects y bodies completos
  'website':        8000, // varía por siteType pero secciones largas
  'contrato':       6000, // texto legal completo
  'casos':          6000, // 10 casos detallados
  'tracker':        5000, // 6+ meses de números
  'vsl':            4096, // 7 secciones cortas
  'reels':          4096, // 3 guiones
  'copy':           4096, // 5 ad copies
  'precios':        4096, // 3 paquetes
  'propuesta':      4096, // texto formato
}
const DEFAULT_MAX_TOKENS = 4096

// Modelo por tool — Haiku ~3-5x más rápido y barato, Sonnet para los complejos
const SONNET = 'claude-sonnet-4-6'
const HAIKU  = 'claude-haiku-4-5-20251001'
const TOOL_MODEL: Record<string, string> = {
  'clone-winner': SONNET, // razonamiento + análisis profundo
  'calendario':   SONNET, // 28 piezas únicas, necesita creatividad
  'imagenes':     SONNET, // prompts MJ con sintaxis técnica
  'carruseles':   SONNET, // 8 narrativas distintas
  'emails':       SONNET, // copy persuasivo, A/B subjects
  'website':      SONNET, // copy de conversión largo
  'casos':        SONNET, // 10 casos reales con números
  'contrato':     SONNET, // texto legal preciso
  // Haiku para tools simples/estructurados — mucho más rápido
  'vsl':          HAIKU,
  'reels':        HAIKU,
  'copy':         HAIKU,
  'precios':      HAIKU,
  'propuesta':    HAIKU,
  'tracker':      HAIKU,
}
const DEFAULT_MODEL = SONNET

// ─── Exact prompts from server/routes/generation.ts ───────────────────────────
function buildPrompt(
  toolId: string,
  ctx: string,
  toolAnswers: Record<string, string>
): string | null {
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

    imagenes: `Eres un director de arte senior especializado en diseño visual high ticket para Instagram, experto en cinematografía publicitaria, diseño editorial premium, branding de lujo y psicología visual de marketing.
${ctx}

CONTEXTO ESPECÍFICO DEL USUARIO:
- Tema/Industria: ${toolAnswers.tema || 'agencia digital / servicios IA'}
- Estilo visual preferido: ${toolAnswers.estilo || 'Dark luxury, premium minimalista'}
- Colores de marca: ${toolAnswers.colores || 'negro profundo, dorado metálico, blanco brillante'}
- Audiencia objetivo: ${toolAnswers.audiencia || 'emprendedores high-ticket'}
- Tipos de imagen: ${toolAnswers.tipo_imagen || 'Variado'}

Tu tarea: generar 6 prompts en ESPAÑOL para crear imágenes verticales de Instagram (1080×1440 px, 3:4) ultra premium, modernas y extremadamente impactantes. Cada prompt debe seguir esta plantilla completa.

PLANTILLA DE ESTRUCTURA QUE CADA PROMPT DEBE SEGUIR:

ESTILO VISUAL GENERAL:
- Apariencia de campaña publicitaria de lujo / poster cinematográfico / portada premium high ticket
- Inspiración: Apple ads, campañas Rolex, posters Netflix, branding agencias premium
- Transmite: autoridad, tensión emocional, urgencia, percepción premium, poder, inteligencia estratégica

PALETA DE COLORES:
- Negro profundo, gris carbón, dorado premium metálico, blanco brillante
- Sombras cinematográficas, iluminación cálida dramática, contrastes fuertes
- EVITAR: colores planos, pastel, cartoon, genérico, saturados baratos

COMPOSICIÓN (dividida en 2 partes):
- IZQUIERDA: texto grande e impactante, tipografía bold gigantesca, estructura vertical agresiva, palabras clave en dorado
- DERECHA: escena cinematográfica emocional, avatar humano realista, ambiente premium, iluminación dramática, storytelling visual, símbolos del nicho (marketing, ventas, llamadas, funnels, ROAS, Zoom calls, dinero, decisiones)

AVATAR HUMANO (cuando aplique):
- Realista, cinematográfico, emocional, elegante, estilo empresario/founder
- Ropa premium oscura, iluminación tipo película
- NO caricatura, NO anime, NO IA genérica sonriente
- Expresiones: frustración / tensión / concentración / poder / determinación

EFECTOS VISUALES:
- Partículas flotando, vidrios rompiéndose, flechas explotando, dashboards quebrados, gráficos destruidos
- Humo cinematográfico, glow dorado suave, motion blur sutil, sombras profundas, reflejos premium, iluminación volumétrica, sparks

TEXTO:
- Sans serif bold ultra moderna, muy pesada, alto contraste, estilo editorial
- Texto gigante, pocas palabras, alto espacio negativo
- Palabras importantes en DORADO premium, tamaño mayor

ELEMENTO DE IDENTIDAD (esquina superior izquierda SIEMPRE):
- Foto de perfil circular pequeña con borde dorado fino elegante (estilo Instagram badge)
- Nombre de usuario: ${toolAnswers.handle || '@tuagencia.io'} en tipografía minimalista blanca limpia

CALIDAD FINAL:
- Ultra high detail, 8k, cinematic composition, luxury advertising style, hyper realistic
- Dramatic lighting, editorial composition, premium business aesthetic, high contrast
- Instagram viral design, masterpiece composition

Genera los 6 prompts cubriendo estos tipos (uno cada uno):
1. HOOK — escena con dolor/problema del avatar (frustración + colapso visual)
2. AUTORIDAD — el creador/founder presentándose con poder (confianza + ambiente premium)
3. RESULTADO — transformación / antes-después / números de éxito con destrucción de obstáculos
4. EDUCATIVO — concepto/método explicado con narrativa visual potente
5. PRUEBA SOCIAL — testimonio o caso con cliente real en ambiente high ticket
6. CTA / OFERTA — urgencia + oferta clara con elementos dorados destacados

Devuelve SOLO JSON:
{
  "prompts": [
    {
      "titulo": "Nombre descriptivo en español",
      "tipo": "Hook|Autoridad|Resultado|Educativo|Prueba Social|CTA",
      "descripcion": "Para qué sirve esta imagen (1-2 frases)",
      "prompt": "PROMPT COMPLETO EN ESPAÑOL siguiendo TODA la plantilla anterior: estilo visual, paleta, composición izquierda/derecha, avatar humano (si aplica), efectos, texto con palabras clave en dorado, badge de identidad esquina superior izquierda con @${toolAnswers.handle || 'tuagencia.io'}, calidad cinematográfica 8k. Mínimo 250 palabras describiendo TODO: el sujeto, el ambiente, la iluminación, los elementos simbólicos del nicho, el texto que aparece, los colores específicos, el mood emocional.",
      "texto_imagen": "El texto exacto (3-6 palabras) que aparece dentro de la imagen, con la palabra clave a destacar en dorado entre asteriscos: ej: PIERDES *DINERO* CADA DÍA",
      "formato": "1080×1440px (3:4 vertical Instagram)"
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
      "margen": número,
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

    'clone-winner': `Eres un growth strategist senior con 15+ años analizando top creators y negocios digitales. Generas análisis competitivo profundo para clonar lo mejor de cada competidor.
${ctx}

COMPETIDOR A ANALIZAR EN ESTA LLAMADA:
- Handle/Nombre: ${toolAnswers.handle || '@competitor'}
- Plataforma: ${toolAnswers.platform || 'Instagram'}
- Website/Landing: ${toolAnswers.url || 'no proporcionado'}

IMPORTANTE: Este análisis será comparado con otros competidores del usuario. Devuelve datos REALISTAS y específicos (números reales del nicho, no genéricos). El frontend mostrará una tabla comparativa entre todos los competidores analizados — sé consistente en estructura.

Devuelve SOLO JSON:
{
  "handle": "${toolAnswers.handle || '@competitor'}",
  "platform": "${toolAnswers.platform || 'Instagram'}",
  "executive_summary": {
    "estimated_followers": "string (ej: 150K)",
    "engagement_rate": "string (ej: 8.2%)",
    "posts_per_week": number,
    "estimated_revenue_monthly": "string (ej: $45K-60K/mes)",
    "content_volume": "string (ej: 11 posts/semana)",
    "key_success_factors": ["factor 1", "factor 2", "factor 3"]
  },
  "content_mix": [
    { "type": "tipo de contenido", "percentage": number, "engagement_rate": number, "is_winner": boolean, "why_it_works": "explicación" }
  ],
  "your_content_mix": [
    { "type": "tipo adaptado a tu caso", "percentage": number, "reasoning": "por qué este % para ti" }
  ],
  "schedule": {
    "posts_per_week": number,
    "best_hours": ["18:00", "12:00"],
    "best_days": ["Lunes", "Miércoles", "Viernes"],
    "your_recommendation": {
      "posts_per_week": number,
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
    "top_hooks": [{ "hook": "texto del hook", "count": number, "type": "curiosidad|dolor|sorpresa|urgencia" }],
    "top_ctas": [{ "cta": "texto CTA", "usage_pct": number }],
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
    "form_fields": number,
    "guarantee": "descripción garantía si la tiene",
    "your_improvements": ["mejora 1 que deberías aplicar", "mejora 2", "mejora 3"]
  },
  "score": {
    "overall": number,
    "market_difference": number,
    "adaptability": number,
    "timeline_months": number,
    "summary": "una frase sobre la viabilidad de clonar esta estrategia"
  },
  "implementation_plan": {
    "week1": { "title": "Setup y Preparación", "hours": number, "tasks": ["tarea específica 1", "tarea 2", "tarea 3", "tarea 4", "tarea 5"] },
    "week2": { "title": "Publicación Consistente", "hours": number, "tasks": ["tarea 1", "tarea 2", "tarea 3"] },
    "week3": { "title": "Medir y Optimizar", "hours": number, "tasks": ["tarea 1", "tarea 2", "tarea 3"] },
    "month1_results": {
      "engagement_improvement": "ej: 2% → 6-8%",
      "followers_growth": "ej: +300-500 orgánico",
      "leads_per_week": "ej: 3-5 leads/semana",
      "estimated_revenue": "ej: $5K-10K"
    }
  }
}`,
  }

  return prompts[toolId] || null
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const projectId = req.query.projectId as string
  const toolId    = req.query.toolId as string

  let step = 'init'

  try {
    // ── Step 1: validate env vars ─────────────────────────────────────────────
    step = 'check-env'
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada en Vercel')
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no configuradas en Vercel')
    }

    // ── Step 2: validate request params ───────────────────────────────────────
    step = 'check-params'
    if (!projectId || !toolId) {
      return res.status(400).json({ error: 'projectId y toolId son requeridos', step, query: req.query })
    }

    // ── Step 3: validate auth ─────────────────────────────────────────────────
    step = 'check-auth'
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No hay header Authorization Bearer', step })
    }
    const token = authHeader.split(' ')[1]
    const db = getDb(token)

    // ── GET: check if tool output already exists ──────────────────────────────
    if (req.method === 'GET') {
      step = 'supabase-get'
      const { data, error } = await db
        .from('project_tools')
        .select('result_json, updated_at')
        .eq('project_id', projectId)
        .eq('tool_id', toolId)
        .maybeSingle()

      if (error) throw new Error(`Supabase GET error: ${error.message}`)
      if (data) {
        return res.status(200).json({ exists: true, result: data.result_json, updated_at: data.updated_at })
      }
      return res.status(200).json({ exists: false })
    }

    // ── POST: generate ────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      step = 'parse-body'
      const toolAnswers: Record<string, string> = req.body?.toolAnswers || {}

      // ── Step 4: fetch project context + TODOS los tools ya generados ────────
      step = 'supabase-fetch-context'
      const [nichoRow, avatarRow, compRow, questionsRow, otherToolsRes] = await Promise.all([
        db.from('project_nicho').select('data_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_avatar').select('data_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_competencia').select('data_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_questions').select('answers_json').eq('project_id', projectId).maybeSingle(),
        db.from('project_tools').select('tool_id, result_json').eq('project_id', projectId),
      ])

      const ctxErrors = [
        nichoRow.error && `nicho: ${nichoRow.error.message}`,
        avatarRow.error && `avatar: ${avatarRow.error.message}`,
        compRow.error && `competencia: ${compRow.error.message}`,
        questionsRow.error && `questions: ${questionsRow.error.message}`,
        otherToolsRes.error && `tools: ${otherToolsRes.error.message}`,
      ].filter(Boolean)
      if (ctxErrors.length > 0) {
        console.warn(`[tools/${toolId}] Context warnings:`, ctxErrors)
      }

      const answers = questionsRow.data?.answers_json || {}

      // Cross-tool context: resultados de OTROS tools ya generados
      const otherTools = (otherToolsRes.data || []).filter(t => t.tool_id !== toolId)
      const cloneWinner = otherTools.find(t => t.tool_id === 'clone-winner')?.result_json
      const calendario  = otherTools.find(t => t.tool_id === 'calendario')?.result_json
      const estrategia  = otherTools.find(t => t.tool_id === 'estrategia')?.result_json

      // Summary corto de cada tool generado (solo lo más relevante, para no inflar el prompt)
      const otherToolsSummary = otherTools
        .filter(t => t.tool_id !== 'clone-winner' && t.tool_id !== 'calendario' && t.tool_id !== 'estrategia')
        .map(t => `- ${t.tool_id}: ${JSON.stringify(t.result_json).slice(0, 300)}…`)
        .join('\n')

      const projectCtx = `
═══ CONTEXTO COMPLETO DEL PROYECTO ═══

📊 PERFIL DEL NEGOCIO (cuestionario inicial):
${JSON.stringify(answers, null, 2)}

🎯 NICHO IDENTIFICADO:
${JSON.stringify(nichoRow.data?.data_json || {}, null, 2)}

👤 AVATAR DEL CLIENTE IDEAL:
${JSON.stringify(avatarRow.data?.data_json || {}, null, 2)}

⚔️ ANÁLISIS DE COMPETENCIA:
${JSON.stringify(compRow.data?.data_json || {}, null, 2)}

${cloneWinner ? `🏆 CLONE GANADOR (análisis de competidor exitoso):
${JSON.stringify(cloneWinner, null, 2).slice(0, 2000)}
` : ''}
${calendario ? `📅 CALENDARIO YA GENERADO (úsalo para mantener coherencia con los temas/ángulos):
${JSON.stringify(calendario, null, 2).slice(0, 1500)}
` : ''}
${estrategia ? `📈 ESTRATEGIA 90D YA GENERADA (alinéate con el plan):
${JSON.stringify(estrategia, null, 2).slice(0, 1500)}
` : ''}
${otherToolsSummary ? `🛠️ OTRAS HERRAMIENTAS YA GENERADAS:
${otherToolsSummary}
` : ''}
═══════════════════════════════════════

INSTRUCCIÓN IMPORTANTE: Tu output DEBE ser coherente con TODO el contexto anterior. Usa el nicho, avatar, competencia y resultados previos para personalizar al máximo. NO generes contenido genérico.`

      const toolCtx = Object.keys(toolAnswers).length > 0
        ? `\nPARAMETROS ESPECÍFICOS (del usuario para esta herramienta):\n${Object.entries(toolAnswers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
        : ''

      const ctx = projectCtx + toolCtx

      // ── Step 5: build prompt ─────────────────────────────────────────────────
      step = 'build-prompt'
      const prompt = buildPrompt(toolId, ctx, toolAnswers)
      if (!prompt) {
        return res.status(404).json({ error: `Herramienta no encontrada: ${toolId}`, step })
      }

      // ── Step 6: call Anthropic ───────────────────────────────────────────────
      step = 'anthropic-call'
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const maxTokens = TOOL_MAX_TOKENS[toolId] ?? DEFAULT_MAX_TOKENS
      const model     = TOOL_MODEL[toolId] ?? DEFAULT_MODEL
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: 'Devuelves SOLO JSON válido y completo. NO incluyes texto antes ni después. NO uses bloques de código markdown. Asegúrate de cerrar todas las llaves, corchetes y comillas. Si el JSON sería demasiado largo, prioriza completarlo correctamente sobre añadir más detalle.',
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      if (!raw) {
        throw new Error('Anthropic devolvió respuesta vacía')
      }

      // Detectar truncación temprano para dar un error claro
      if (response.stop_reason === 'max_tokens') {
        throw new Error(`Claude truncó la respuesta al llegar al límite de ${maxTokens} tokens. Sube TOOL_MAX_TOKENS["${toolId}"].`)
      }

      // ── Step 7: parse JSON ───────────────────────────────────────────────────
      step = 'parse-json'
      const result = parseJSON<Record<string, unknown>>(raw)

      if (toolId === 'website' && toolAnswers.siteType) {
        result.siteType = toolAnswers.siteType
      }

      // ── Step 8: save to Supabase ─────────────────────────────────────────────
      step = 'supabase-save'
      const { error: saveErr } = await db.from('project_tools').upsert({
        project_id: projectId,
        tool_id: toolId,
        result_json: result,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,tool_id' })

      if (saveErr) {
        console.warn(`[tools/${toolId}] Save warning: ${saveErr.message}`)
      }

      return res.status(200).json({ result })
    }

    return res.status(405).json({ error: 'Method not allowed', step })
  } catch (error: any) {
    console.error(`[tools/${toolId}] [step=${step}]`, error)
    return res.status(500).json({
      error: error.message || 'Error al generar herramienta',
      step,
      toolId,
      projectId,
    })
  }
}
