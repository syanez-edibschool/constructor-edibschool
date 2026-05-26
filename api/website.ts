import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, toolAnswers } = req.body;

    let finalPrompt = prompt;

    if (!finalPrompt && toolAnswers) {
      const { siteType, colors, additional } = toolAnswers;
      finalPrompt = `Crea el contenido completo para un sitio web tipo "${siteType}" en español.
Paleta de colores: ${colors}.
Requisitos adicionales: ${additional || "Ninguno"}.
Genera secciones completas: headline principal, subtítulo, beneficios, CTA, testimonios y footer.
Formato profesional y persuasivo orientado a conversión.`;
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
    console.error("Website error:", error);
    res.status(500).json({ error: error.message });
  }
}
