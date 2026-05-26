import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, toolAnswers } = req.body;
    let finalPrompt = prompt;

    if (!finalPrompt && toolAnswers) {
      const { siteType, colors, additional } = toolAnswers;
      finalPrompt = `Eres un copywriter experto en marketing digital. Crea el copy completo para un sitio web tipo "${siteType}" en español.

Paleta de colores sugerida: ${colors}.
Requisitos adicionales: ${additional || "Ninguno"}.

IMPORTANTE: NO generes HTML, CSS ni código. Solo texto estructurado con estas secciones claramente separadas:

## HEADLINE
(Título principal impactante, máximo 10 palabras)

## SUBTÍTULO
(Subtítulo persuasivo que amplíe el headline, 1-2 oraciones)

## PROPUESTA DE VALOR
(3-5 beneficios clave en formato de lista, orientados al cliente)

## CTA PRINCIPAL
(Texto del botón de llamada a la acción + frase de apoyo debajo)

## TESTIMONIOS
(3 testimonios ficticios pero realistas: nombre, cargo, cita)

## FOOTER
(Tagline de cierre + frase de copyright)

Escribe en tono persuasivo, directo y orientado a resultados. Adapta el lenguaje al tipo de sitio indicado.`;
    }

    if (!finalPrompt) return res.status(400).json({ error: "Prompt requerido" });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: finalPrompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "";
    res.status(200).json({ success: true, content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
