import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Button3D from '../components/ui/Button3D'
import ProgressBar3D from '../components/ui/ProgressBar3D'
import { saveAnswers } from '../services/projectsService'

interface Question {
  id: string
  text: string
  type: 'select' | 'radio'
  options: string[]
  section: string
}

const QUESTIONS: Question[] = [
  // Sección 1: Nicho Base
  { id: 'industry', section: 'Nicho Base', text: '¿A qué industria sirve tu agencia?', type: 'select', options: ['Fitness & Wellness', 'Estética & Belleza', 'Inmobiliaria', 'SaaS / Tecnología', 'E-commerce', 'Educación', 'Legal', 'Salud & Clínicas', 'Consultoría', 'Otro'] },
  { id: 'model', section: 'Nicho Base', text: '¿Modelo de negocio?', type: 'radio', options: ['B2B (empresas)', 'B2C (consumidores)', 'Ambos'] },
  { id: 'size', section: 'Nicho Base', text: '¿Tamaño de tu cliente ideal?', type: 'select', options: ['Solopreneur (1 persona)', '2-10 empleados', '11-50 empleados', '51-200 empleados', '200+ empleados'] },
  { id: 'geography', section: 'Nicho Base', text: '¿Geografía objetivo?', type: 'select', options: ['Local (ciudad)', 'Regional', 'Nacional', 'Mercado hispano global', 'Global'] },
  { id: 'problem', section: 'Nicho Base', text: '¿Cuál es el problema principal que resuelves?', type: 'select', options: ['Baja conversión de leads', 'Falta de tiempo / automatización', 'No están creciendo', 'No tienen sistemas', 'Competencia muy fuerte'] },
  { id: 'experience', section: 'Nicho Base', text: '¿Años de experiencia de tu cliente ideal?', type: 'select', options: ['0-3 años (nuevo)', '3-7 años (creciendo)', '7-15 años (establecido)', '15+ años (veterano)'] },
  { id: 'tech_level', section: 'Nicho Base', text: '¿Nivel tecnológico de tu cliente?', type: 'select', options: ['Nada (resistente a tecnología)', 'Básico (usa email y Excel)', 'Intermedio (CRM, apps básicas)', 'Avanzado (tech-savvy)'] },
  { id: 'urgency', section: 'Nicho Base', text: '¿Urgencia del problema que tienen?', type: 'radio', options: ['Baja (puede esperar)', 'Media (en 3-6 meses)', 'Alta (en 1-3 meses)', 'Crítica (ya!) '] },
  // Sección 2: Avatar
  { id: 'avatar_age', section: 'Avatar', text: '¿Edad de tu decisor ideal?', type: 'select', options: ['25-35 años', '35-45 años', '45-55 años', '55+ años'] },
  { id: 'avatar_gender', section: 'Avatar', text: '¿Género predominante del decisor?', type: 'radio', options: ['Masculino', 'Femenino', 'Mixto'] },
  { id: 'avatar_income', section: 'Avatar', text: '¿Ingresos mensuales de tu cliente ideal?', type: 'select', options: ['€1,000-3,000/mes', '€3,000-8,000/mes', '€8,000-20,000/mes', '€20,000+/mes'] },
  { id: 'avatar_goal', section: 'Avatar', text: '¿Cuál es su objetivo principal?', type: 'select', options: ['Escalar ingresos rápidamente', 'Tener más tiempo libre', 'Dominar su mercado local', 'Crear un sistema estable', 'Salir de su zona de comfort'] },
  { id: 'avatar_pain', section: 'Avatar', text: '¿Mayor dolor emocional que siente?', type: 'select', options: ['Frustración por estancamiento', 'Miedo a quedarse obsoleto', 'Estrés por falta de sistema', 'Vergüenza ante competidores', 'Incertidumbre del futuro'] },
  { id: 'avatar_dream', section: 'Avatar', text: '¿Su sueño definitivo?', type: 'select', options: ['Negocio que funciona solo', 'Ser referente en su industria', 'Libertad financiera total', 'Escalar a múltiples locales', 'Vender el negocio eventualmente'] },
  { id: 'avatar_objection', section: 'Avatar', text: '¿Mayor objeción para comprar servicios de IA?', type: 'select', options: ['Demasiado caro', 'No entiendo cómo funciona', 'No tengo tiempo de implementar', 'Ya probé algo así y no funcionó', 'Mi industria es diferente'] },
  { id: 'avatar_decision', section: 'Avatar', text: '¿Cómo toma decisiones de compra?', type: 'select', options: ['Basado en casos de éxito', 'Basado en precio/ROI', 'Por recomendación de confianza', 'Necesita mucha información primero', 'Decisión emocional rápida'] },
  // Sección 3: Competencia
  { id: 'comp_quantity', section: 'Competencia', text: '¿Cuántos competidores directos conoces?', type: 'radio', options: ['Ninguno (soy pionero)', '1-3 competidores', '4-10 competidores', 'Mercado muy saturado'] },
  { id: 'comp_type', section: 'Competencia', text: '¿Tipo principal de competencia?', type: 'select', options: ['Agencias de marketing tradicional', 'Freelancers y consultores', 'Plataformas SaaS', 'Agencias de IA especializadas', 'El cliente haciéndolo internamente'] },
  { id: 'comp_price', section: 'Competencia', text: '¿Rango de precios de la competencia?', type: 'select', options: ['€200-500/mes (bajo)', '€500-1,500/mes (medio)', '€1,500-5,000/mes (alto)', '€5,000+/mes (premium)'] },
  { id: 'comp_weakness', section: 'Competencia', text: '¿Principal debilidad de la competencia?', type: 'select', options: ['No personalizan para el nicho', 'Demasiado lento para entregar', 'No tienen soporte post-venta', 'Muy técnicos, poca estrategia', 'No demuestran ROI claro'] },
  { id: 'comp_strength', section: 'Competencia', text: '¿Principal fortaleza de la competencia?', type: 'select', options: ['Marca reconocida', 'Precio más bajo', 'Más casos de éxito', 'Equipo más grande', 'Tecnología más avanzada'] },
  { id: 'diff_factor', section: 'Competencia', text: '¿Tu mayor diferenciador vs. competencia?', type: 'select', options: ['Especialización ultra nicho', 'Resultados garantizados', 'Precio/valor superior', 'Implementación más rápida', 'Soporte 1:1 premium'] },
  { id: 'market_trend', section: 'Competencia', text: '¿Tendencia del mercado en tu nicho?', type: 'select', options: ['Creciendo rápidamente', 'Estable y maduro', 'En transición/disrupción', 'Saturándose', 'Emergente (muy nuevo)'] },
  { id: 'market_reg', section: 'Competencia', text: '¿Nivel de regulación en tu industria objetivo?', type: 'radio', options: ['Baja (poca regulación)', 'Media (algunas restricciones)', 'Alta (muy regulada)'] },
  // Sección 4: Propuesta
  { id: 'service_main', section: 'Propuesta', text: '¿Qué tipo de servicio principal ofreces?', type: 'select', options: ['Automatización de procesos', 'Generación de contenido IA', 'Chatbots y atención al cliente', 'Análisis de datos e insights', 'Solución integral (todo lo anterior)'] },
  { id: 'delivery', section: 'Propuesta', text: '¿Cómo entregas tu servicio?', type: 'select', options: ['100% hecho por mí (done-for-you)', 'Enseño y acompaño (done-with-you)', 'Solo formación (do-it-yourself)', 'Mixto según el cliente'] },
  { id: 'result_time', section: 'Propuesta', text: '¿En cuánto tiempo ven resultados tus clientes?', type: 'select', options: ['1-2 semanas', '1 mes', '2-3 meses', '3-6 meses'] },
  { id: 'ticket', section: 'Propuesta', text: '¿Precio mensual objetivo por cliente?', type: 'select', options: ['€500-1,000/mes', '€1,000-2,500/mes', '€2,500-5,000/mes', '€5,000-10,000/mes', '€10,000+/mes'] },
  // Sección 5: Contenido
  { id: 'content_style', section: 'Contenido', text: '¿Estilo de comunicación que prefieres?', type: 'select', options: ['Profesional y serio', 'Cercano y empático', 'Directo y orientado a datos', 'Inspiracional y visionario', 'Educativo y didáctico'] },
  { id: 'content_channel', section: 'Contenido', text: '¿Canal principal de adquisición?', type: 'select', options: ['LinkedIn', 'Instagram', 'YouTube', 'Email marketing', 'Referencias y boca a boca'] },
]

const SECTIONS = [...new Set(QUESTIONS.map((q) => q.section))]

export default function Questions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentSection, setCurrentSection] = useState(0)
  const [saving, setSaving] = useState(false)

  const sectionQuestions = QUESTIONS.filter((q) => q.section === SECTIONS[currentSection])
  const isLastSection = currentSection === SECTIONS.length - 1
  const sectionAnswered = sectionQuestions.every((q) => answers[q.id])
  const totalAnswered = QUESTIONS.filter((q) => answers[q.id]).length
  const progress = Math.round((totalAnswered / QUESTIONS.length) * 100)
  const allAnswered = QUESTIONS.every((q) => answers[q.id])

  // Find first section with unanswered questions
  const firstIncompleteSectionIndex = SECTIONS.findIndex((sec) =>
    QUESTIONS.filter((q) => q.section === sec).some((q) => !answers[q.id])
  )

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleNext = async () => {
    if (!sectionAnswered) {
      toast.error(`Responde todas las preguntas de "${SECTIONS[currentSection]}"`)
      return
    }
    if (!isLastSection) {
      setCurrentSection((s) => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Final submit: validate ALL 30 before sending
    if (!allAnswered) {
      const missing = SECTIONS[firstIncompleteSectionIndex]
      toast.error(`Faltan respuestas en la sección "${missing}". Vuelve y complétala.`, { duration: 5000 })
      setCurrentSection(firstIncompleteSectionIndex)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const unansweredCount = QUESTIONS.filter((q) => !answers[q.id]).length
    if (unansweredCount > 0) {
      toast.error(`Faltan ${unansweredCount} preguntas por responder`)
      return
    }
    setSaving(true)
    try {
      await saveAnswers(id!, answers)
      navigate(`/proyecto/${id}/review-niche`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[Questions] Error al guardar:', msg)
      toast.error(`Error al guardar: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0B30', color: '#fff' }}>
      <div className="fixed top-0 left-0 w-full h-64 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(131,87,246,0.07) 0%, transparent 100%)' }} />

      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-white/6"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate('/dashboard')} className="text-white/40 hover:text-white text-sm transition-colors flex items-center gap-1">
              ← Dashboard
            </button>
            <span className="text-sm font-semibold text-white/60">
              Sección {currentSection + 1}/{SECTIONS.length} — <span className="text-cyan">{SECTIONS[currentSection]}</span>
            </span>
          </div>
          <ProgressBar3D value={progress} label="Progreso total" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Section title */}
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-2xl font-bold gradient-text mb-2">{SECTIONS[currentSection]}</h2>
          <p className="text-white/40 text-sm mb-8">{sectionQuestions.length} preguntas en esta sección</p>

          <div className="flex flex-col gap-6">
            <AnimatePresence mode="wait">
              {sectionQuestions.map((q, qi) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: qi * 0.06, duration: 0.4 }}
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p className="font-semibold text-white mb-4 leading-relaxed">
                    <span className="text-cyan/60 text-sm font-normal mr-2">
                      {QUESTIONS.indexOf(q) + 1}.
                    </span>
                    {q.text}
                  </p>

                  {q.type === 'radio' ? (
                    <div className="flex flex-col gap-3">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => handleAnswer(q.id, opt)}
                            className="radio-3d"
                          />
                          <span className={`text-sm transition-colors ${answers[q.id] === opt ? 'text-cyan' : 'text-white/60 group-hover:text-white/80'}`}>
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      className="input-3d select-3d w-full rounded-xl px-4 py-3 text-sm"
                    >
                      <option value="" disabled>Selecciona una opción...</option>
                      {q.options.map((opt) => (
                        <option key={opt} value={opt} style={{ background: '#1a1a2e' }}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <Button3D
              variant="secondary"
              onClick={() => {
                if (currentSection > 0) {
                  setCurrentSection((s) => s - 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                } else {
                  navigate('/dashboard')
                }
              }}
            >
              ← Atrás
            </Button3D>

            <Button3D
              onClick={handleNext}
              loading={saving}
              disabled={!sectionAnswered || (isLastSection && !allAnswered)}
              size="lg"
            >
              {isLastSection
                ? allAnswered
                  ? 'GENERAR ANÁLISIS →'
                  : `Faltan ${QUESTIONS.length - totalAnswered} preguntas`
                : `Siguiente: ${SECTIONS[currentSection + 1]} →`}
            </Button3D>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
