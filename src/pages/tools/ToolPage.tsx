import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Button3D from '../../components/ui/Button3D'
import LoadingSpinner3D from '../../components/ui/LoadingSpinner3D'
import { api } from '../../services/api'

interface ToolConfig {
  id: string
  icon: string
  title: string
  desc: string
  endpoint: string
  renderResult: (data: unknown) => React.ReactNode
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('¡Copiado al portapapeles!')
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function PromptsResult({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="glass rounded-xl p-5 group">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="text-xs text-cyan font-semibold">{label} {i + 1}</span>
            <button
              onClick={() => copyText(item)}
              className="text-xs text-white/30 hover:text-cyan transition-colors opacity-0 group-hover:opacity-100"
            >
              📋 Copiar
            </button>
          </div>
          <p className="text-sm text-white/80 leading-relaxed font-mono whitespace-pre-wrap">{item}</p>
        </div>
      ))}
    </div>
  )
}

function CalendarioResult({ weeks }: { weeks: Array<{ week: number; days: Array<{ day: string; type: string; content: string; timing: string }> }> }) {
  const [activeWeek, setActiveWeek] = useState(0)
  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {weeks.map((w, i) => (
          <button
            key={i}
            onClick={() => setActiveWeek(i)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeWeek === i ? 'bg-cyan/20 border border-cyan/40 text-cyan' : 'bg-white/4 border border-white/10 text-white/50 hover:text-white'}`}
          >
            Semana {w.week}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {weeks[activeWeek]?.days.map((day, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 flex items-start gap-4"
          >
            <div className="w-20 flex-shrink-0">
              <p className="text-xs font-bold text-cyan">{day.day}</p>
              <p className="text-xs text-white/30 mt-0.5">{day.timing}</p>
            </div>
            <div className="flex-1">
              <span className="text-xs bg-purple/20 text-purple border border-purple/30 px-2 py-0.5 rounded-full">
                {day.type}
              </span>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">{day.content}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const TOOL_CONFIGS: Record<string, Omit<ToolConfig, 'id'>> = {
  calendario: {
    icon: '📅',
    title: 'Calendario de Contenido',
    desc: '4 semanas de contenido personalizado para tu nicho',
    endpoint: 'calendario',
    renderResult: (data: unknown) => {
      const d = data as { weeks: Array<{ week: number; days: Array<{ day: string; type: string; content: string; timing: string }> }> }
      return <CalendarioResult weeks={d.weeks} />
    },
  },
  vsl: {
    icon: '🎬',
    title: 'Script VSL',
    desc: 'Video Sales Letter de 2:45 min con estructura probada',
    endpoint: 'vsl',
    renderResult: (data: unknown) => {
      const d = data as { sections: Array<{ label: string; timing: string; content: string }> }
      return (
        <div className="flex flex-col gap-4">
          {d.sections?.map((s, i) => (
            <div key={i} className="glass rounded-xl p-5 group">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold text-cyan">{s.label}</span>
                  <span className="text-xs text-white/30 ml-3">{s.timing}</span>
                </div>
                <button onClick={() => copyText(s.content)} className="text-xs text-white/30 hover:text-cyan transition-colors opacity-0 group-hover:opacity-100">
                  📋 Copiar
                </button>
              </div>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-mono">{s.content}</p>
            </div>
          ))}
          <div className="flex gap-3 mt-2">
            <button onClick={() => copyText(d.sections.map(s => `[${s.label}]\n${s.content}`).join('\n\n'))}
              className="flex-1 btn-secondary rounded-xl py-3 text-sm">📋 Copiar todo</button>
            <button onClick={() => downloadText(d.sections.map(s => `[${s.label} - ${s.timing}]\n${s.content}`).join('\n\n'), 'vsl-script.txt')}
              className="flex-1 btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar</button>
          </div>
        </div>
      )
    },
  },
  reels: {
    icon: '📱',
    title: 'Guiones de Reels',
    desc: '3 guiones virales para Instagram/TikTok',
    endpoint: 'reels',
    renderResult: (data: unknown) => {
      const d = data as { scripts: string[] }
      return <PromptsResult items={d.scripts} label="Reel" />
    },
  },
  copy: {
    icon: '📝',
    title: 'Ad Copies',
    desc: '5 copies de publicidad persuasivos',
    endpoint: 'copy',
    renderResult: (data: unknown) => {
      const d = data as { copies: string[] }
      return <PromptsResult items={d.copies} label="Copy" />
    },
  },
  imagenes: {
    icon: '🖼️',
    title: 'Prompts de Imágenes',
    desc: '5 prompts detallados para DALL-E / Midjourney',
    endpoint: 'imagenes',
    renderResult: (data: unknown) => {
      const d = data as { prompts: string[] }
      return <PromptsResult items={d.prompts} label="Prompt" />
    },
  },
  carruseles: {
    icon: '📸',
    title: 'Guiones de Carruseles',
    desc: '8 estructuras de carrusel para Instagram',
    endpoint: 'carruseles',
    renderResult: (data: unknown) => {
      const d = data as { carousels: string[] }
      return <PromptsResult items={d.carousels} label="Carrusel" />
    },
  },
  website: {
    icon: '🌐',
    title: 'Landing Page HTML',
    desc: 'Código completo HTML + Tailwind CSS',
    endpoint: 'website',
    renderResult: (data: unknown) => {
      const d = data as { html: string }
      return (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-xl p-5 overflow-hidden">
            <pre className="text-xs text-white/70 font-mono overflow-x-auto whitespace-pre-wrap max-h-96">
              {d.html}
            </pre>
          </div>
          <div className="flex gap-3">
            <button onClick={() => copyText(d.html)} className="flex-1 btn-secondary rounded-xl py-3 text-sm">📋 Copiar HTML</button>
            <button onClick={() => downloadText(d.html, 'landing-page.html')} className="flex-1 btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar</button>
          </div>
        </div>
      )
    },
  },
  propuesta: {
    icon: '📄',
    title: 'Propuesta Comercial',
    desc: 'Documento completo listo para enviar',
    endpoint: 'propuesta',
    renderResult: (data: unknown) => {
      const d = data as { content: string }
      return (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-xl p-6">
            <pre className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-sans">{d.content}</pre>
          </div>
          <div className="flex gap-3">
            <button onClick={() => copyText(d.content)} className="flex-1 btn-secondary rounded-xl py-3 text-sm">📋 Copiar</button>
            <button onClick={() => downloadText(d.content, 'propuesta-comercial.txt')} className="flex-1 btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar</button>
          </div>
        </div>
      )
    },
  },
  precios: {
    icon: '💰',
    title: 'Paquetes de Precios',
    desc: '3 paquetes con estructura de precios optimizada',
    endpoint: 'precios',
    renderResult: (data: unknown) => {
      const d = data as { packages: Array<{ name: string; price: string; description: string; features: string[]; ideal: string }> }
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {d.packages?.map((pkg, i) => (
            <div key={i} className={`glass rounded-2xl p-6 flex flex-col gap-3 ${i === 1 ? 'border-cyan/40 bg-cyan/5' : ''}`}>
              {i === 1 && <span className="text-xs text-cyan font-bold bg-cyan/10 px-3 py-1 rounded-full w-fit">MÁS POPULAR</span>}
              <h3 className="font-bold text-white text-lg">{pkg.name}</h3>
              <p className="text-3xl font-black gradient-text">{pkg.price}</p>
              <p className="text-sm text-white/50">{pkg.description}</p>
              <div className="flex-1 flex flex-col gap-2">
                {pkg.features?.map((f, j) => (
                  <p key={j} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-cyan mt-0.5">✓</span>{f}
                  </p>
                ))}
              </div>
              <p className="text-xs text-white/30 border-t border-white/8 pt-3">{pkg.ideal}</p>
            </div>
          ))}
        </div>
      )
    },
  },
  pitch: {
    icon: '🎤',
    title: 'Pitch Deck',
    desc: '8 slides de presentación de ventas',
    endpoint: 'pitch',
    renderResult: (data: unknown) => {
      const d = data as { slides: Array<{ number: number; title: string; content: string; notes: string }> }
      return (
        <div className="flex flex-col gap-4">
          {d.slides?.map((slide, i) => (
            <div key={i} className="glass rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-lg bg-purple/20 text-purple text-sm font-bold flex items-center justify-center">
                  {slide.number}
                </span>
                <h4 className="font-bold text-white">{slide.title}</h4>
              </div>
              <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed mb-3">{slide.content}</p>
              {slide.notes && (
                <p className="text-xs text-white/30 border-t border-white/8 pt-3">
                  💡 Nota: {slide.notes}
                </p>
              )}
            </div>
          ))}
          <button onClick={() => downloadText(d.slides.map(s => `SLIDE ${s.number}: ${s.title}\n\n${s.content}\n\nNotas: ${s.notes}`).join('\n\n---\n\n'), 'pitch-deck.txt')}
            className="btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar Pitch Deck</button>
        </div>
      )
    },
  },
  emails: {
    icon: '✉️',
    title: 'Secuencias de Email',
    desc: '3 secuencias de email marketing',
    endpoint: 'emails',
    renderResult: (data: unknown) => {
      const d = data as { sequences: Array<{ name: string; emails: Array<{ subject: string; body: string }> }> }
      return (
        <div className="flex flex-col gap-6">
          {d.sequences?.map((seq, si) => (
            <div key={si}>
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-purple/20 text-purple text-xs flex items-center justify-center">{si + 1}</span>
                {seq.name}
              </h3>
              <div className="flex flex-col gap-3">
                {seq.emails?.map((email, ei) => (
                  <div key={ei} className="glass rounded-xl p-5">
                    <p className="text-xs text-cyan mb-1">Email {ei + 1} — Asunto:</p>
                    <p className="font-semibold text-white mb-3">{email.subject}</p>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{email.body}</p>
                    <button onClick={() => copyText(`Asunto: ${email.subject}\n\n${email.body}`)}
                      className="mt-3 text-xs text-white/30 hover:text-cyan transition-colors">📋 Copiar email</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    },
  },
  ofertas: {
    icon: '🎁',
    title: 'Templates de Ofertas',
    desc: 'Ofertas irresistibles para captar clientes',
    endpoint: 'ofertas',
    renderResult: (data: unknown) => {
      const d = data as { offers: string[] }
      return <PromptsResult items={d.offers} label="Oferta" />
    },
  },
  contrato: {
    icon: '📋',
    title: 'Contrato de Servicios',
    desc: 'Contrato profesional completo',
    endpoint: 'contrato',
    renderResult: (data: unknown) => {
      const d = data as { content: string }
      return (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-xl p-6">
            <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed">{d.content}</pre>
          </div>
          <div className="flex gap-3">
            <button onClick={() => copyText(d.content)} className="flex-1 btn-secondary rounded-xl py-3 text-sm">📋 Copiar</button>
            <button onClick={() => downloadText(d.content, 'contrato-servicios.txt')} className="flex-1 btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar</button>
          </div>
        </div>
      )
    },
  },
  tracker: {
    icon: '💹',
    title: 'Tracker Financiero',
    desc: 'Sistema de seguimiento de ingresos y gastos',
    endpoint: 'tracker',
    renderResult: (data: unknown) => {
      const d = data as { content: string }
      return (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-xl p-6">
            <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono leading-relaxed">{d.content}</pre>
          </div>
          <button onClick={() => downloadText(d.content, 'tracker-financiero.csv')}
            className="btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar CSV</button>
        </div>
      )
    },
  },
  casos: {
    icon: '📚',
    title: 'Biblioteca de Casos de Uso',
    desc: '50+ casos de uso reales para tu nicho',
    endpoint: 'casos',
    renderResult: (data: unknown) => {
      const d = data as { cases: Array<{ title: string; problem: string; solution: string; result: string }> }
      return (
        <div className="flex flex-col gap-4">
          {d.cases?.map((c, i) => (
            <div key={i} className="glass rounded-xl p-5">
              <h4 className="font-bold text-white mb-3">{c.title}</h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-red-400 mb-1">Problema</p><p className="text-white/60">{c.problem}</p></div>
                <div><p className="text-cyan mb-1">Solución IA</p><p className="text-white/60">{c.solution}</p></div>
                <div><p className="text-green-400 mb-1">Resultado</p><p className="text-white/60">{c.result}</p></div>
              </div>
            </div>
          ))}
        </div>
      )
    },
  },
  estrategia: {
    icon: '📊',
    title: 'Estrategia Trimestral',
    desc: 'Plan de 90 días para tu agencia',
    endpoint: 'estrategia',
    renderResult: (data: unknown) => {
      const d = data as { months: Array<{ month: number; title: string; goals: string[]; actions: string[]; kpis: string[] }> }
      return (
        <div className="flex flex-col gap-6">
          {d.months?.map((m, i) => (
            <div key={i} className="glass rounded-xl p-5">
              <h3 className="font-bold text-white mb-4">Mes {m.month}: {m.title}</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-cyan mb-2">Objetivos</p>
                  {m.goals?.map((g, j) => <p key={j} className="text-white/60 mb-1">• {g}</p>)}
                </div>
                <div>
                  <p className="text-purple mb-2">Acciones clave</p>
                  {m.actions?.map((a, j) => <p key={j} className="text-white/60 mb-1">• {a}</p>)}
                </div>
                <div>
                  <p className="text-green-400 mb-2">KPIs</p>
                  {m.kpis?.map((k, j) => <p key={j} className="text-white/60 mb-1">• {k}</p>)}
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => downloadText(JSON.stringify(d, null, 2), 'estrategia-90-dias.json')}
            className="btn-secondary rounded-xl py-3 text-sm">⬇️ Descargar Plan</button>
        </div>
      )
    },
  },
}

export default function ToolPage() {
  const { id, toolId } = useParams<{ id: string; toolId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [generated, setGenerated] = useState(false)

  const config = toolId ? TOOL_CONFIGS[toolId] : null

  const generate = async () => {
    if (!config) return
    setLoading(true)
    try {
      const { data } = await api.post(`/projects/${id}/tools/${config.endpoint}`)
      setResult(data.result)
      setGenerated(true)
    } catch {
      toast.error('Error al generar. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!config) {
    return <div className="min-h-screen bg-dark flex items-center justify-center text-white/50">Herramienta no encontrada</div>
  }

  return (
    <div className="min-h-screen bg-dark">
      <div className="fixed top-0 left-0 w-full h-64 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(0,217,255,0.06) 0%, transparent 100%)' }} />

      <header className="sticky top-0 z-20 border-b border-white/6"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate(`/proyecto/${id}/tools`)} className="text-white/40 hover:text-white text-sm transition-colors">
            ← Herramientas
          </button>
          <span className="text-lg font-bold text-white ml-2">{config.icon} {config.title}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {!generated ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
            <div className="text-7xl mb-6">{config.icon}</div>
            <h1 className="text-3xl font-bold mb-3">{config.title}</h1>
            <p className="text-white/50 mb-8 max-w-md mx-auto">{config.desc}</p>
            {loading ? (
              <LoadingSpinner3D label={`Generando ${config.title}...`} />
            ) : (
              <Button3D size="lg" onClick={generate}>
                GENERAR AHORA →
              </Button3D>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold gradient-text">{config.title}</h1>
                <p className="text-white/50 text-sm">{config.desc}</p>
              </div>
              <Button3D variant="secondary" size="sm" onClick={generate} loading={loading}>
                ↺ Regenerar
              </Button3D>
            </div>
            {config.renderResult(result)}
          </motion.div>
        )}
      </main>
    </div>
  )
}
