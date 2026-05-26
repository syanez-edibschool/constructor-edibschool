import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const TOOLS = [
  {
    id: 'calendario',
    icon: '📅',
    title: 'Calendario de Contenido',
    desc: '8 piezas/semana, 4 semanas completas',
    time: '~3 min',
    color: 'rgba(0,217,255,0.15)',
    border: 'rgba(0,217,255,0.3)',
  },
  {
    id: 'vsl',
    icon: '🎬',
    title: 'Prompts VSL',
    desc: 'Script completo de 2:45 min para ventas',
    time: '~2 min',
    color: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'reels',
    icon: '📱',
    title: 'Prompts Reels',
    desc: '3 guiones de reels virales para redes',
    time: '~2 min',
    color: 'rgba(236,72,153,0.15)',
    border: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'copy',
    icon: '📝',
    title: 'Prompts Copy',
    desc: '5 ad copies listos para publicar',
    time: '~1 min',
    color: 'rgba(0,217,255,0.15)',
    border: 'rgba(0,217,255,0.3)',
  },
  {
    id: 'imagenes',
    icon: '🖼️',
    title: 'Prompts Imágenes',
    desc: '5 prompts detallados para DALL-E / Midjourney',
    time: '~1 min',
    color: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'carruseles',
    icon: '📸',
    title: 'Prompts Carruseles',
    desc: '8 prompts de carruseles Instagram',
    time: '~2 min',
    color: 'rgba(236,72,153,0.15)',
    border: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'website',
    icon: '🌐',
    title: 'Sitio Web en IA',
    desc: 'Landing page completa HTML + Tailwind CSS',
    time: '~3 min',
    color: 'rgba(0,217,255,0.15)',
    border: 'rgba(0,217,255,0.3)',
  },
  {
    id: 'propuesta',
    icon: '📄',
    title: 'Propuesta Comercial',
    desc: 'Documento profesional listo para enviar',
    time: '~2 min',
    color: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'precios',
    icon: '💰',
    title: 'Generador de Precios',
    desc: '3 paquetes con estructura de precios',
    time: '~1 min',
    color: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.3)',
  },
  {
    id: 'pitch',
    icon: '🎤',
    title: 'Pitch Deck',
    desc: '8 slides de presentación de ventas',
    time: '~3 min',
    color: 'rgba(0,217,255,0.15)',
    border: 'rgba(0,217,255,0.3)',
  },
  {
    id: 'emails',
    icon: '✉️',
    title: 'Email Automático',
    desc: '3 secuencias de email marketing',
    time: '~2 min',
    color: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'ofertas',
    icon: '🎁',
    title: 'Ofertas / Promociones',
    desc: 'Templates de ofertas irresistibles',
    time: '~1 min',
    color: 'rgba(236,72,153,0.15)',
    border: 'rgba(236,72,153,0.3)',
  },
  {
    id: 'contrato',
    icon: '📋',
    title: 'Contrato Cliente',
    desc: 'Contrato profesional editable',
    time: '~2 min',
    color: 'rgba(0,217,255,0.15)',
    border: 'rgba(0,217,255,0.3)',
  },
  {
    id: 'tracker',
    icon: '💹',
    title: 'Tracker Ingresos',
    desc: 'Dashboard financiero de tu agencia',
    time: 'Setup ~1 min',
    color: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.3)',
  },
  {
    id: 'casos',
    icon: '📚',
    title: 'Biblioteca Casos de Uso',
    desc: '50+ casos de uso reales por industria',
    time: 'Explorar',
    color: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.3)',
  },
]

export default function ToolsMenu() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-dark">
      <div className="fixed top-0 left-0 w-full h-96 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.07) 0%, transparent 100%)' }} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/6"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-white/40 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          <span className="text-xl font-black gradient-text ml-4">◆ Constructor</span>
          <div className="flex-1" />
          <Button3DLink onClick={() => navigate(`/proyecto/${id}/download`)}>
            📦 Descargar todo
          </Button3DLink>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">
            ¿Qué deseas <span className="gradient-text">generar</span>?
          </h1>
          <p className="text-white/50 mb-10">Selecciona una herramienta para comenzar. Todo se personaliza con tu nicho.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {TOOLS.map((tool, i) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => navigate(`/proyecto/${id}/tools/${tool.id}`)}
                className="rounded-2xl p-5 cursor-pointer flex flex-col gap-3 group"
                style={{
                  background: tool.color,
                  border: `1px solid ${tool.border}`,
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = `0 20px 50px rgba(0,0,0,0.4), 0 0 30px ${tool.border}`
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = 'none'
                }}
              >
                <span className="text-4xl">{tool.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-1 text-sm group-hover:text-cyan transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-white/40 leading-relaxed">{tool.desc}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">{tool.time}</span>
                  <span className="text-xs text-white/50 group-hover:text-cyan transition-colors font-mono">→</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  )
}

function Button3DLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm px-4 py-2 rounded-xl font-medium transition-all duration-200"
      style={{
        background: 'rgba(0,217,255,0.1)',
        border: '1px solid rgba(0,217,255,0.3)',
        color: '#00D9FF',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'rgba(0,217,255,0.2)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'rgba(0,217,255,0.1)'
      }}
    >
      {children}
    </button>
  )
}
