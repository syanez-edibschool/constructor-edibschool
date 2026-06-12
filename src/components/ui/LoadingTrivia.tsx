import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  ListBulletIcon,
  BoltIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const STEPS = [
  {
    Icon: MagnifyingGlassIcon,
    title: 'Analizando tu proyecto...',
    desc: 'Revisamos tu nicho, avatar y contexto para personalizar el resultado',
  },
  {
    Icon: SparklesIcon,
    title: 'Generando con IA...',
    desc: 'Creamos contenido a la medida de tu negocio',
  },
  {
    Icon: ListBulletIcon,
    title: 'Dando estructura...',
    desc: 'Organizamos las ideas en un formato claro y accionable',
  },
  {
    Icon: BoltIcon,
    title: 'Afinando los detalles...',
    desc: 'Ajustamos el tono, los ganchos y las llamadas a la acción',
  },
  {
    Icon: CheckCircleIcon,
    title: 'Casi listo...',
    desc: 'Revisando que todo quede coherente y profesional',
  },
]

const FACTS = [
  'Los negocios que planifican 90 días crecen 3x más rápido que los que improvisan semana a semana.',
  'El 68% de los clientes elige una agencia por la rapidez de respuesta, no por el precio.',
  'Publicar con un calendario constante multiplica por 2 el alcance frente a publicar "cuando se puede".',
  'Una oferta clara y específica convierte hasta 4x mejor que una genérica.',
  'El 80% de las ventas necesita 5 o más seguimientos, pero la mayoría se rinde al segundo.',
  'Los carruseles educativos son el formato con más guardados en Instagram: ideales para autoridad.',
  'Responder a un lead en menos de 5 minutos multiplica por 9 la probabilidad de cerrarlo.',
  'Un nicho específico cobra hasta 3x más que un "hago de todo": la especialización paga.',
  'El video corto (Reels) tiene el mayor alcance orgánico de todas las redes.',
  'Automatizar el primer contacto libera ~10 horas a la semana para tareas que sí cierran ventas.',
]

interface LoadingTriviaProps {
  steps?: typeof STEPS
  fact?: string
}

export default function LoadingTrivia({ steps = STEPS, fact }: LoadingTriviaProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showFact, setShowFact] = useState(false)
  // Dato al azar: se fija una vez por carga y varía entre generaciones.
  const [chosenFact] = useState(() => fact || FACTS[Math.floor(Math.random() * FACTS.length)])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          setShowFact(true)
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 2500)
    return () => clearInterval(interval)
  }, [steps.length])

  const progress = Math.min(((currentStep + 1) / steps.length) * 100, 100)
  const { Icon, title, desc } = steps[currentStep]

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      {/* Spinner */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#8357F6',
              borderRightColor: '#C49DFF',
            }}
          />
          <div style={{
            position: 'absolute', inset: 6,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,rgba(131,87,246,.1),rgba(196,157,255,.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SparklesIcon style={{ width: 18, height: 18, color: 'var(--accent)' }} />
          </div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--card-bg)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-h)',
        borderRadius: 18,
        padding: '24px 28px',
      }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Progreso
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#8357F6,#C49DFF)' }}
            />
          </div>
        </div>

        {/* Current step */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(131,87,246,.15),rgba(196,157,255,.12))',
              border: '1px solid rgba(131,87,246,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: 20, height: 20, color: 'var(--accent)' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {title}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {desc}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === currentStep ? 20 : 6,
                background: i <= currentStep ? '#8357F6' : 'var(--border)',
              }}
              transition={{ duration: 0.3 }}
              style={{ height: 6, borderRadius: 999 }}
            />
          ))}
        </div>

        {/* Fact */}
        <AnimatePresence>
          {showFact && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(131,87,246,.06)',
                border: '1px solid rgba(131,87,246,.2)',
              }}
            >
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Dato
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                {chosenFact}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
