import { Router, Response } from 'express'
import JSZip from 'jszip'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { supabaseAdmin } from '../services/supabaseService'

const router = Router()
router.use(requireAuth as any)

router.get('/:id/download/zip', async (req: AuthRequest, res: Response) => {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .single()

    if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return }

    const { data: tools } = await supabaseAdmin
      .from('project_tools')
      .select('tool_id, result_json')
      .eq('project_id', req.params.id)

    const zip = new JSZip()
    const toolFiles: Record<string, { folder: string; filename: string; extractor: (r: unknown) => string }> = {
      calendario: { folder: 'calendario', filename: 'calendario.txt', extractor: (r: unknown) => {
        const d = r as { weeks: Array<{ week: number; days: Array<{ day: string; type: string; content: string }> }> }
        return d.weeks?.map(w => `SEMANA ${w.week}\n${w.days?.map(d => `${d.day}: [${d.type}] ${d.content}`).join('\n')}`).join('\n\n') || ''
      }},
      vsl: { folder: 'prompts', filename: 'vsl-script.txt', extractor: (r: unknown) => {
        const d = r as { sections: Array<{ label: string; timing: string; content: string }> }
        return d.sections?.map(s => `[${s.label} - ${s.timing}]\n${s.content}`).join('\n\n') || ''
      }},
      reels: { folder: 'prompts', filename: 'reels-guiones.txt', extractor: (r: unknown) => {
        const d = r as { scripts: string[] }
        return d.scripts?.join('\n\n---\n\n') || ''
      }},
      copy: { folder: 'prompts', filename: 'ad-copies.txt', extractor: (r: unknown) => {
        const d = r as { copies: string[] }
        return d.copies?.join('\n\n---\n\n') || ''
      }},
      imagenes: { folder: 'prompts', filename: 'prompts-imagenes.txt', extractor: (r: unknown) => {
        const d = r as { prompts: string[] }
        return d.prompts?.join('\n\n') || ''
      }},
      carruseles: { folder: 'prompts', filename: 'carruseles.txt', extractor: (r: unknown) => {
        const d = r as { carousels: string[] }
        return d.carousels?.join('\n\n---\n\n') || ''
      }},
      website: { folder: 'sitio-web', filename: 'index.html', extractor: (r: unknown) => {
        const d = r as { html: string }
        return d.html || ''
      }},
      propuesta: { folder: 'propuesta', filename: 'propuesta-comercial.txt', extractor: (r: unknown) => {
        const d = r as { content: string }
        return d.content || ''
      }},
      precios: { folder: 'propuesta', filename: 'paquetes-precios.txt', extractor: (r: unknown) => {
        const d = r as { packages: Array<{ name: string; price: string; description: string; features: string[] }> }
        return d.packages?.map(p => `${p.name} — ${p.price}\n${p.description}\n${p.features?.join('\n')}`).join('\n\n') || ''
      }},
      pitch: { folder: 'pitch-deck', filename: 'pitch-deck.txt', extractor: (r: unknown) => {
        const d = r as { slides: Array<{ number: number; title: string; content: string; notes: string }> }
        return d.slides?.map(s => `SLIDE ${s.number}: ${s.title}\n\n${s.content}\n\nNotas: ${s.notes}`).join('\n\n---\n\n') || ''
      }},
      emails: { folder: 'emails', filename: 'secuencias-email.txt', extractor: (r: unknown) => {
        const d = r as { sequences: Array<{ name: string; emails: Array<{ subject: string; body: string }> }> }
        return d.sequences?.map(s => `${s.name}\n\n${s.emails?.map((e, i) => `Email ${i+1}\nAsunto: ${e.subject}\n\n${e.body}`).join('\n\n')}`).join('\n\n===\n\n') || ''
      }},
      contrato: { folder: 'contratos', filename: 'contrato-servicios.txt', extractor: (r: unknown) => {
        const d = r as { content: string }
        return d.content || ''
      }},
      estrategia: { folder: 'estrategia', filename: 'plan-90-dias.txt', extractor: (r: unknown) => {
        const d = r as { months: Array<{ month: number; title: string; goals: string[]; actions: string[]; kpis: string[] }> }
        return d.months?.map(m => `MES ${m.month}: ${m.title}\n\nObjetivos:\n${m.goals?.map(g => `  • ${g}`).join('\n')}\n\nAcciones:\n${m.actions?.map(a => `  • ${a}`).join('\n')}\n\nKPIs:\n${m.kpis?.map(k => `  • ${k}`).join('\n')}`).join('\n\n---\n\n') || ''
      }},
    }

    for (const tool of (tools || [])) {
      const cfg = toolFiles[tool.tool_id]
      if (!cfg) continue
      const content = cfg.extractor(tool.result_json)
      zip.folder(cfg.folder)?.file(cfg.filename, content)
    }

    zip.file('README.txt', `CONSTRUCTOR — AGENCIA DE IA
Proyecto: ${project.name}
Generado: ${new Date().toLocaleDateString('es-ES')}

CONTENIDO DEL PAQUETE:
- calendario/     → Plan de contenido 4 semanas
- prompts/        → VSL, Reels, Copy, Imágenes, Carruseles
- sitio-web/      → Landing page HTML (abre en navegador)
- propuesta/      → Propuesta comercial + Precios
- pitch-deck/     → Presentación de ventas
- emails/         → Secuencias de email marketing
- contratos/      → Contrato de servicios
- estrategia/     → Plan 90 días

¡Listo para lanzar tu agencia de IA!
`)

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="constructor-${project.name.replace(/\s+/g, '-')}.zip"`,
      'Content-Length': buffer.length,
    })
    res.send(buffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al generar ZIP' })
  }
})

export default router
