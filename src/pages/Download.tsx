import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Button3D from '../components/ui/Button3D'
import { api } from '../services/api'
import {
  CalendarDaysIcon, PencilSquareIcon, GlobeAltIcon, DocumentTextIcon,
  MicrophoneIcon, EnvelopeIcon, ClipboardDocumentIcon, BookOpenIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'

type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>

export default function Download() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loadingZip, setLoadingZip] = useState(false)

  const handleZip = async () => {
    setLoadingZip(true)
    try {
      const response = await api.get(`/projects/${id}/download/zip`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `constructor-proyecto-${id}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('¡Descarga iniciada!')
    } catch {
      toast.error('Error al generar ZIP. Asegúrate de haber generado herramientas.')
    } finally {
      setLoadingZip(false)
    }
  }

  const CONTENTS: { Icon: IconComp; label: string; desc: string }[] = [
    { Icon: CalendarDaysIcon,        label: 'calendario/', desc: 'Calendario 4 semanas' },
    { Icon: PencilSquareIcon,        label: 'prompts/', desc: 'VSL, Reels, Copy, Imágenes' },
    { Icon: GlobeAltIcon,            label: 'sitio-web/', desc: 'Landing page HTML' },
    { Icon: DocumentTextIcon,        label: 'propuesta/', desc: 'Propuesta comercial' },
    { Icon: MicrophoneIcon,          label: 'pitch-deck/', desc: 'Pitch deck 8 slides' },
    { Icon: EnvelopeIcon,            label: 'emails/', desc: 'Secuencias de email' },
    { Icon: ClipboardDocumentIcon,   label: 'contratos/', desc: 'Contrato de servicios' },
    { Icon: BookOpenIcon,            label: 'README.txt', desc: 'Instrucciones completas' },
  ]

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(131,87,246,0.06) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-2xl w-full"
      >
        <div className="text-center mb-10">
          <div className="mb-4 flex justify-center">
            <ArchiveBoxArrowDownIcon style={{ width: 64, height: 64, color: 'rgba(131,87,246,0.8)' }} />
          </div>
          <h1 className="text-4xl font-black mb-3 gradient-text">Tu Agencia de IA</h1>
          <p className="text-white/50">Todo listo para lanzar. Descarga todos tus materiales en un click.</p>
        </div>

        {/* Contents */}
        <div className="glass rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-white/80 mb-4 text-sm uppercase tracking-wider">El paquete incluye:</h3>
          <div className="grid grid-cols-2 gap-3">
            {CONTENTS.map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <item.Icon style={{ width: 18, height: 18, color: 'rgba(131,87,246,0.7)', flexShrink: 0 }} />
                <div>
                  <p className="font-mono text-cyan/80 text-xs">{item.label}</p>
                  <p className="text-white/40 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Download buttons */}
        <div className="flex flex-col gap-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button3D
              fullWidth
              size="lg"
              loading={loadingZip}
              onClick={handleZip}
              className="py-5 text-lg"
            >
              DESCARGAR ZIP COMPLETO
            </Button3D>
          </motion.div>

          <button
            onClick={() => navigate(`/proyecto/${id}/tools`)}
            className="btn-secondary rounded-xl py-4 text-sm font-medium"
          >
            ← Volver a herramientas
          </button>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          Todos los materiales son personalizados con tu nicho, avatar y posicionamiento.
        </p>
      </motion.div>
    </div>
  )
}
