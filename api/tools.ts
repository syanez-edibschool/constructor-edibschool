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
  'calendario':     6000, // 4 semanas × contenido detallado (reducido para evitar 504)
  'imagenes':      10000, // 6 prompts largos con todos los specs
  'carruseles':    10000, // 8 carruseles × 7 slides
  'emails':         8000, // múltiples emails con A/B subjects y bodies completos
  'website':        8000, // varía por siteType pero secciones largas
  'contrato':       6000, // texto legal completo
  'casos':          6000, // 10 casos detallados
  'tracker':        5000, // 6+ meses de números
  'vsl':            4096, // 7 secciones cortas
  'reels':          6000, // 3 guiones ultra detallados (en markdown completo)
  'story':          6000, // 5 stories ultra detalladas (en markdown completo)
  'copy':           4096, // legacy compat
  'precios':        5000, // 3 paquetes + oferta irresistible + notas
  'propuesta':      4096, // texto formato
  'chat-agent':     8000, // blueprint completo (system prompt + flujo + intents + integración)
}
const DEFAULT_MAX_TOKENS = 4096

// Modelo por tool — Haiku ~3-5x más rápido y barato, Sonnet para los complejos
const SONNET = 'claude-sonnet-4-6'
const HAIKU  = 'claude-haiku-4-5-20251001'
const TOOL_MODEL: Record<string, string> = {
  'clone-winner': SONNET, // razonamiento + análisis profundo
  'calendario':   HAIKU,  // velocidad: 4 semanas de contenido sin necesitar razonamiento profundo
  'imagenes':     SONNET, // prompts MJ con sintaxis técnica
  'carruseles':   SONNET, // 8 narrativas distintas
  'emails':       SONNET, // copy persuasivo, A/B subjects
  'website':      SONNET, // copy de conversión largo
  'casos':        SONNET, // 10 casos reales con números
  'contrato':     SONNET, // texto legal preciso
  // Haiku para tools simples/estructurados — mucho más rápido
  'vsl':          HAIKU,
  'reels':        SONNET,  // ahora producen markdown muy detallado
  'story':        SONNET,  // 5 stories con guion + visual + sticker, requiere creatividad
  'copy':         HAIKU,
  'precios':      SONNET,  // 3 paquetes + oferta irresistible con razonamiento
  'propuesta':    HAIKU,
  'tracker':      HAIKU,
  'chat-agent':   SONNET,  // blueprint técnico, system prompt complejo
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

    reels: `Actúa como un INGENIERO DE PROMPTS senior + viral content director con 10M+ de seguidores experto en Reels e IA. Tu rol es producir prompts/guiones de máxima precisión, estructura y detalle.
${ctx}

⚠️ MUY IMPORTANTE: Si el contexto contiene un CALENDARIO ya generado, DEBES tomar 3 ideas/títulos de ese calendario como base para los 3 guiones de Reels. NO inventes temas si ya hay un calendario. Mantén coherencia narrativa.

PARÁMETROS DEL USUARIO:
- Tipo de reel: ${toolAnswers.tipo || 'Educativo'}
- Estilo de hook: ${toolAnswers.hook || 'Dato sorprendente'}
- Duración: ${toolAnswers.duracion || '30 segundos'}
- Edición: ${toolAnswers.edicion || 'Cuts rápidos + texto'}
- Mensaje a comunicar: ${toolAnswers.mensaje || 'no especificado'}
- CTA: ${toolAnswers.cta || 'Seguir la cuenta'}

Crea 3 guiones VIRALES de Reels. Cada guion ULTRA DETALLADO con esta estructura obligatoria:

# GUION N — [TÍTULO ESPECÍFICO TOMADO DEL CALENDARIO]

## CONTEXTO (1-2 líneas)
- De qué pieza del calendario viene + ángulo

## HOOK (segundo 0-3)
- [TEXTO EN PANTALLA grande]: 4-7 palabras impactantes
- [VOZ EN OFF]: frase de gancho
- [ESCENA]: descripción visual exacta (qué se ve, ángulo, b-roll)

## DESARROLLO (segundo 3 a duración-3)
- [TEXTO EN PANTALLA]: aparece y desaparece, frase por frase
- [VOZ EN OFF]: guion hablado completo, palabra por palabra
- [ESCENA]: cada cambio de plano descrito (transiciones, b-roll, cuts)
- [SFX/MÚSICA]: tipo y momento exacto

## CTA (últimos 3 segundos)
- [TEXTO EN PANTALLA]: CTA visual claro
- [VOZ EN OFF]: instrucción directa

## CAPTION/COPY PARA POSTEAR
- 3 líneas: hook escrito + valor + CTA
- 5-7 hashtags estratégicos

## ALTERNATIVA DE HOOK (B-test)
- Una variación del hook inicial para A/B testing

Devuelve SOLO JSON: { "scripts": ["GUION 1 COMPLETO en formato markdown como el anterior", "GUION 2 COMPLETO...", "GUION 3 COMPLETO..."] }`,

    story: `Actúa como un INGENIERO DE PROMPTS senior + director creativo de Stories de Instagram especialista en venta de demos/llamadas gratuitas. Generas guiones ultra detallados y persuasivos.
${ctx}

⚠️ MUY IMPORTANTE: Si el contexto contiene un CALENDARIO ya generado, toma los TITULARES de Stories que están en el calendario como base de las 5 historias. Coherencia total con el calendario.

PARÁMETROS DEL USUARIO:
- Tono: ${toolAnswers.tono || 'Cercano y directo'}
- Audiencia: ${toolAnswers.audiencia || 'lead tibio que ya nos sigue'}
- Objeción clave a derribar: ${toolAnswers.objecion || 'no tengo tiempo / es caro'}
- Beneficio principal de la demo: ${toolAnswers.beneficio || 'plan personalizado en 30 min'}

OBJETIVO ÚNICO: Vender una DEMO GRATUITA DE 30 MINUTOS. La secuencia de 5 stories debe maximizar el % que agenda la demo.

Estructura OBLIGATORIA — Secuencia de 5 stories conectadas:

# STORY 1 — HOOK + PROBLEMA
- TEXTO EN PANTALLA: 5-10 palabras que detengan el scroll
- DESCRIPCIÓN VISUAL: tipo de foto/video (selfie, b-roll, mockup, screen capture, etc.)
- COPY HABLADO si aplica (1-2 frases)
- ELEMENTOS GRÁFICOS de Instagram a usar (sticker emoji, pregunta, encuesta, etc.)
- DURACIÓN sugerida (3s, 5s, 15s)

# STORY 2 — AGITACIÓN / CONSECUENCIA
- TEXTO EN PANTALLA
- VISUAL
- COPY HABLADO
- STICKER/ELEMENTO interactivo (encuesta "¿te pasa?" Sí/No)
- DURACIÓN

# STORY 3 — REVELACIÓN / NUEVA POSIBILIDAD
- TEXTO EN PANTALLA
- VISUAL (caso, screen, antes/después)
- COPY HABLADO
- ELEMENTO (cita, dato impactante, prueba social)
- DURACIÓN

# STORY 4 — OFERTA: DEMO GRATUITA 30 MIN
- TEXTO EN PANTALLA con ANCLA: "Plan personalizado de 30 min — gratis"
- VISUAL: lo que el usuario se llevará de la demo (3-4 bullets)
- COPY HABLADO: por qué es gratis y por qué solo X plazas
- OBJECIÓN ANTICIPADA derribada (1 línea)
- DURACIÓN

# STORY 5 — CTA + URGENCIA + STICKER DE LINK
- TEXTO EN PANTALLA con CTA literal: "Toca aquí" / "Link arriba"
- VISUAL: dirige la atención al link/swipe up
- STICKER de link con texto exacto a configurar
- COPY HABLADO de cierre con urgencia real
- DURACIÓN

## EXTRAS OBLIGATORIOS
- COPY del DM automático si responden el sticker
- 2 variaciones del HOOK de Story 1 para A/B
- Sugerencia del mejor HORARIO de publicación

Devuelve SOLO JSON: { "copies": ["STORY 1 COMPLETO en markdown", "STORY 2...", "STORY 3...", "STORY 4...", "STORY 5..."] }`,

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

    carruseles: `Actúa como un INGENIERO DE PROMPTS senior + estratega de Instagram con 500+ carruseles virales creados para agencias y coaches. Produces prompts/guiones de máxima precisión y detalle.
${ctx}

⚠️ MUY IMPORTANTE: Si el contexto contiene un CALENDARIO ya generado, DEBES tomar al menos 6 titulares/ideas del calendario como base para los 8 carruseles. Mantén coherencia narrativa total con el calendario.

PARÁMETROS:
- Objetivo: ${toolAnswers.objetivo || 'Educar sobre problema'}
- Número de slides: ${toolAnswers.slides || '7 slides'}
- Tema: ${toolAnswers.tema || 'no especificado'}
- CTA final: ${toolAnswers.cta || 'Guardar este carrusel'}
- Estilo de texto: ${toolAnswers.estilo || 'Bullet points cortos'}

Crea 8 carruseles ULTRA DETALLADOS. Cada carrusel debe tener esta estructura obligatoria:

# CARRUSEL N — [TÍTULO específico del calendario o nicho]
## CONTEXTO
- De qué pieza del calendario viene + objetivo psicológico

## SLIDE 1 — HOOK VISUAL
- TEXTO PRINCIPAL: 4-8 palabras impactantes
- SUBTEXTO: contexto breve
- DESCRIPCIÓN VISUAL: qué imagen/diseño usar (composición, color dominante, elementos gráficos)
- TIPOGRAFÍA: estilo recomendado

## SLIDE 2 a (N-1) — DESARROLLO PROGRESIVO
Para CADA slide:
- TÍTULO del slide
- TEXTO COMPLETO (incluye copy palabra por palabra)
- DESCRIPCIÓN VISUAL específica (qué dibujar/diseñar)
- TRANSICIÓN al siguiente slide (gancho narrativo)

## SLIDE FINAL — CTA
- TEXTO CTA exacto
- ELEMENTO VISUAL que refuerza el CTA
- INSTRUCCIÓN clara de acción

## CAPTION PARA INSTAGRAM
- Primera línea (gancho que aparece sin "ver más")
- Cuerpo de 4-6 líneas con valor
- CTA final
- 5-8 hashtags estratégicos

Devuelve SOLO JSON: { "carousels": ["CARRUSEL 1 COMPLETO en markdown como arriba", "CARRUSEL 2...", "...8 carruseles"] }`,

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

    precios: `Actúa como un PRICING STRATEGIST senior especializado en agencias de IA, con experiencia cerrando primeros clientes y escalando MRR. Aplicas el framework: SETUP inicial + FIJO MENSUAL ASEQUIBLE + opción "PROPUESTA IRRESISTIBLE" para primeras ventas.
${ctx}

PARÁMETROS:
- Servicio central: ${toolAnswers.servicio || 'automatización con IA'}
- Horas por cliente: ${toolAnswers.horas || '5-8h/semana'}
- Experiencia: ${toolAnswers.experiencia || '2-3 años'}
- Mercado: ${toolAnswers.mercado || 'España/Europa'}
- Modelo preferido: ${toolAnswers.modelo || 'Setup + mensualidad fija'}
- Diferencial: ${toolAnswers.diferencial || 'especialización en nicho'}
- Precio mínimo aceptable/mes: ${toolAnswers.minimo || '€300/mes'}

OBJETIVO: Construir una estructura de precios donde el COBRO INICIAL (setup) genera flujo de caja inmediato y el FIJO MENSUAL es lo más asequible posible para que el cliente diga sí sin pensar (objeción "precio" derribada). Adicionalmente, crea UNA "PROPUESTA IRRESISTIBLE" — un precio agresivamente bajo SOLO para las primeras ventas que sea casi imposible decir que no, para conseguir casos de éxito.

DEBES generar EXACTAMENTE 3 paquetes (Starter, Growth, Enterprise) + 1 "OFERTA IRRESISTIBLE":

CADA paquete debe tener:
- "setup": cargo inicial único (instalación, onboarding, configuración) — genera caja al firmar
- "monthly": cuota mensual fija INTENCIONALMENTE ASEQUIBLE (relativa al mercado del cliente)
- Razonamiento del por qué este precio funciona psicológicamente

La OFERTA IRRESISTIBLE: 50-60% más barata que Starter, con condiciones claras ("solo para los primeros 5 clientes", "se devuelve si no hay resultado en X días", "doble garantía", etc.) — pensada como herramienta de cierre con leads tibios/fríos.

Devuelve SOLO JSON:
{
  "packages": [
    {
      "name": "Starter",
      "setup": "€XXX único",
      "monthly": "€XXX/mes",
      "price": "€XXX setup + €XXX/mes",
      "description": "Descripción breve y persuasiva",
      "features": ["feature 1 específico", "feature 2", "feature 3", "feature 4"],
      "ideal": "Ideal para...",
      "psychology": "Por qué este pricing convierte (1-2 frases)"
    },
    { "name": "Growth", "setup": "...", "monthly": "...", "price": "...", "description": "...", "features": [...], "ideal": "...", "psychology": "..." },
    { "name": "Enterprise", "setup": "...", "monthly": "...", "price": "...", "description": "...", "features": [...], "ideal": "...", "psychology": "..." }
  ],
  "irresistible_offer": {
    "name": "Oferta Irresistible (primeras 5 ventas)",
    "setup": "€XX único",
    "monthly": "€XX/mes (3 primeros meses) → luego Starter",
    "price": "€XX + €XX/mes (3 meses)",
    "description": "Por qué esta oferta es imposible decir que no",
    "conditions": ["condición 1 (límite plazas)", "condición 2 (garantía)", "condición 3 (plazo)"],
    "features": ["lo mismo que Starter", "+bonus 1", "+bonus 2"],
    "why_it_works": "Explicación psicológica del por qué cerrar leads tibios/fríos con esta oferta",
    "pitch_script": "Frase exacta para usar al cerrar: 'Mira, normalmente esto cuesta X, pero como sos de los primeros...'"
  },
  "strategy_notes": [
    "Nota 1 sobre cuándo usar cada paquete",
    "Nota 2 sobre upselling de Starter → Growth",
    "Nota 3 sobre cuándo NO usar la Oferta Irresistible"
  ]
}`,

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

    'chat-agent': `Actúa como un INGENIERO DE PROMPTS senior + arquitecto de Agentes Conversacionales con experiencia desplegando bots en WhatsApp, Instagram, web y multi-canal. Generas blueprints técnicos completos y system prompts production-ready.
${ctx}

PARÁMETROS DEL USUARIO:
- Objetivo principal del agente: ${toolAnswers.objetivo || 'Calificar leads'}
- Plataforma de despliegue: ${toolAnswers.plataforma || 'WhatsApp Business'}
- Tono: ${toolAnswers.tono || 'Cercano y amigable'}
- Flujo conversacional clave: ${toolAnswers.flujo || 'saludo → necesidad → calificar → ofrecer demo'}
- Restricciones / qué NO hacer: ${toolAnswers.restricciones || 'no dar precios sin calificar primero'}

Crea un BLUEPRINT COMPLETO del agente IA con esta estructura exacta:

# 1. SYSTEM PROMPT MAESTRO (para Claude / GPT / Gemini)
El system prompt completo, listo para copy-paste, que define:
- Identidad y rol del agente
- Personalidad y tono específico
- Objetivos primarios y secundarios
- Reglas estrictas (lo que SIEMPRE / NUNCA debe hacer)
- Variables del usuario que debe recolectar
- Protocolo de escalación a humano
Mínimo 400 palabras.

# 2. FLUJO CONVERSACIONAL (state machine)
Diagrama textual con cada estado:
- ESTADO 0: Saludo inicial (incluye mensaje exacto)
- ESTADO 1: Identificar intención (qué preguntar)
- ESTADO 2-N: cada paso del flujo del usuario
- ESTADO FINAL: Cierre + handoff
Cada estado incluye: input esperado, mensaje del agente, condiciones de transición.

# 3. BIBLIOTECA DE RESPUESTAS (intents principales)
Mínimo 10 intents con respuesta exacta:
- Saludo
- Pregunta por precio (sin haber calificado)
- Pregunta por precio (después de calificar)
- Comparación con competencia
- Objeción "es caro"
- Objeción "no tengo tiempo"
- Pedir testimonios/casos
- Pedir hablar con humano
- Cierre exitoso (agendamiento)
- Fuera de horario / agente offline

# 4. PROMPTS DE SISTEMA SECUNDARIOS
- Prompt de CLASIFICACIÓN (de lead frío/tibio/caliente)
- Prompt de RESUMEN de conversación (para CRM)
- Prompt de PRÓXIMA MEJOR ACCIÓN (qué proponer next)

# 5. INTEGRACIÓN TÉCNICA
- Variables a pasar (nombre, email, teléfono, etc.)
- Webhooks recomendados (CRM, calendario, email)
- Eventos a trackear para analytics
- Recomendación de stack (Make.com / n8n / código custom)

# 6. KPIs Y MÉTRICAS DE ÉXITO
- Tasa de conversación → demo agendada (target: X%)
- Tiempo promedio hasta agendar (target: X min)
- % escalado a humano
- CSAT estimado

# 7. CHECKLIST DE PRUEBAS PRE-LANZAMIENTO
10 escenarios de prueba con resultados esperados.

Devuelve SOLO JSON: { "content": "BLUEPRINT COMPLETO en formato markdown con TODAS las 7 secciones de arriba, ultra detallado y listo para implementar" }`,

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

    'clone-winner': `Actúa como un INGENIERO DE PROMPTS senior + growth strategist + investigador de mercado con 15+ años analizando top creators y negocios digitales. Tu objetivo es realizar el ANÁLISIS COMPETITIVO MÁS COMPLETO, DETALLADO Y ACCIONABLE posible, listo para que el usuario implemente en su negocio.
${ctx}

COMPETIDOR A ANALIZAR EN ESTA LLAMADA:
- Handle/Nombre: ${toolAnswers.handle || '@competitor'}
- Plataforma: ${toolAnswers.platform || 'Instagram'}
- Website/Landing: ${toolAnswers.url || 'no proporcionado'}

⚠️ INSTRUCCIONES CRÍTICAS:
1. NO seas genérico. Devuelve datos REALISTAS y específicos (números reales del nicho).
2. Para CADA hallazgo, incluye razonamiento ("por qué") + acción concreta para el usuario ("qué hacer con esto").
3. Diferenciación: Por cada táctica del competidor, explica cómo el usuario puede REPLICARLA Y SUPERARLA (no solo copiar).
4. Profundiza en COPY (hooks, CTAs, mensaje central), en VISUAL (paleta, tipografía, fotografía), en SCHEDULE (frecuencia, hora, día), en OFERTA (estructura de precio, garantías, bonos), en CONTENIDO (mix de formatos, temas, ángulos).
5. Si la URL fue proporcionada, simula análisis profundo de la landing/web (estructura, copy, CTAs, social proof, formularios).
6. El frontend mostrará tabla comparativa entre varios competidores — sé consistente en estructura.

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

      // Summary corto de cada tool generado (solo lo más relevante, para no inflar el prompt)
      const otherToolsSummary = otherTools
        .filter(t => t.tool_id !== 'clone-winner' && t.tool_id !== 'calendario')
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
