import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CalendarDaysIcon, FilmIcon, DevicePhoneMobileIcon, PencilSquareIcon,
  PhotoIcon, ViewColumnsIcon, GlobeAltIcon, DocumentTextIcon,
  BanknotesIcon, EnvelopeIcon,
  DocumentCheckIcon, ChartBarIcon, MapIcon,
  DocumentDuplicateIcon, CpuChipIcon,
  CheckIcon, ArrowPathIcon, SparklesIcon, DocumentArrowDownIcon, Bars3Icon,
  PaperAirplaneIcon, ChatBubbleLeftRightIcon, PhoneIcon,
} from '@heroicons/react/24/outline'
import { useIsMobile } from '../hooks/useIsMobile'
import { toText } from '../lib/aiText'
import { api } from '../services/api'
import { getProject } from '../services/projectsService'
import { exportToPDF, exportToWord } from '../services/exportContent'
import { saveToHistory } from '../services/toolHistory'
import HistoryPanel from '../components/Tools/HistoryPanel'
import ContratoEditable from '../components/Tools/ContratoEditable'

// Herramientas de contenido con pestaña de historial
const HISTORY_TOOLS = new Set(['story', 'carruseles', 'imagenes', 'vsl', 'reels', 'emails'])
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../hooks/useAuth'
import Sidebar          from '../components/Dashboard/Sidebar'
import DashboardHeader  from '../components/Dashboard/Header'
import LoadingTrivia                                from '../components/ui/LoadingTrivia'
import CalendarVisual,    { type CalendarWeek }   from '../components/Tools/CalendarVisual'
import TrackerFinanciero                            from '../components/Tools/TrackerFinanciero'
import PromptsImagenes,   { type ImagenPrompt }   from '../components/Tools/PromptsImagenes'
import CloneTheWinner                               from '../components/Tools/CloneTheWinner'
import SitioWeb                                    from '../components/Tools/SitioWeb'
import PropuestaComercial                          from '../components/Tools/PropuestaComercial'
import Estrategia90D                               from '../components/Tools/Estrategia90D'
import PromptGenerator                             from '../components/Tools/PromptGenerator'

// ─── Types ────────────────────────────────────────────────────────────────────
type IconComp = React.ComponentType<React.SVGProps<SVGSVGElement>>
interface Q { id: string; label: string; type: 'text' | 'textarea' | 'select'; placeholder?: string; options?: string[] }
interface ToolDef { id: string; Icon: IconComp; title: string; short: string; cat: string; desc: string; qs: Q[] }
type Phase = 'checking' | 'questions' | 'generating' | 'done'
interface ToolState { phase: Phase; answers: Record<string, string>; result: unknown; savedAt?: string }

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS: ToolDef[] = [
  {
    id: 'calendario', Icon: CalendarDaysIcon, title: 'Calendario de Contenido', short: 'Calendario', cat: 'contenido',
    desc: 'Calendario visual de 4 semanas personalizado para tu audiencia.',
    qs: [
      { id: 'frecuencia',    label: '¿Con qué frecuencia publicarás?',                       type: 'select', options: ['1x/semana','3x/semana','5x/semana','Diario'] },
      { id: 'plataformas',   label: '¿En qué plataformas? (separa por coma)',                 type: 'text',   placeholder: 'Instagram, TikTok, LinkedIn' },
      { id: 'temas',         label: '¿Cuáles son tus 3 temas principales de contenido?',     type: 'textarea', placeholder: 'Ej: automatización de ventas, casos de éxito con IA, productividad' },
      { id: 'horario',       label: '¿Mejor horario para tu audiencia?',                     type: 'select', options: ['Mañanas (7-9h)','Mediodía (12-14h)','Tardes (17-19h)','Noches (20-22h)'] },
      { id: 'tipo_contenido',label: '¿Tipo de contenido que más resuena?',                   type: 'select', options: ['Educativo/Tutorial','Entretenimiento','Ventas directas','Casos reales','Motivacional'] },
      { id: 'fase_audiencia',label: '¿En qué fase está tu audiencia?',                       type: 'select', options: ['Fría (no me conocen)','Tibia (me siguen pero no compran)','Caliente (listos para comprar)'] },
      { id: 'objetivo',      label: '¿Tu objetivo de contenido en 30 días?',                 type: 'text',   placeholder: 'Ej: conseguir 3 clientes, crecer 500 seguidores' },
    ],
  },
  {
    id: 'vsl', Icon: FilmIcon, title: 'Prompts VSL', short: 'VSL', cat: 'ventas',
    desc: 'Script de Video Sales Letter + 3 variaciones de copy.',
    qs: [
      { id: 'dolor',      label: '¿Cuál es el DOLOR MÁS PROFUNDO de tu cliente ideal?',                type: 'textarea', placeholder: 'Ej: trabajan 60h/semana, pierden clientes por lentitud' },
      { id: 'resultado',  label: '¿Qué resultado específico entregas y en qué tiempo?',                 type: 'text',     placeholder: 'Ej: 3x más leads en 45 días o devolvemos el dinero' },
      { id: 'objeciones', label: '¿Las 3 principales objeciones de tu cliente?',                       type: 'textarea', placeholder: 'Ej: 1) Es caro, 2) No confío en la IA' },
      { id: 'autoridad',  label: '¿Por qué te creerían a TI?',                                         type: 'textarea', placeholder: 'Ej: 5 años en el sector, 47 clientes' },
      { id: 'garantia',   label: '¿Qué garantía específica ofreces?',                                  type: 'text',     placeholder: 'Ej: si no ves resultados en 60 días, devolvemos el 100%' },
      { id: 'cta',        label: '¿CTA final del VSL?',                                                type: 'select',   options: ['Agendar llamada gratuita','Comprar ahora','Registrarse gratis','Ver demo en vivo'] },
      { id: 'tono',       label: '¿Tono del VSL?',                                                     type: 'select',   options: ['Profesional y serio','Cercano y empático','Energético y motivacional','Directo y urgente'] },
    ],
  },
  {
    id: 'reels', Icon: DevicePhoneMobileIcon, title: 'Guion Reels', short: 'Reels', cat: 'contenido',
    desc: '3 guiones de reels virales con hook, edición y caption.',
    qs: [
      { id: 'tipo',     label: '¿Tipo de reel?',                 type: 'select', options: ['Educativo/Tutorial','Transformación antes/después','Behind-the-scenes','Trending/Viral','Desmontando mitos'] },
      { id: 'hook',     label: '¿Estilo de hook inicial?',       type: 'select', options: ['Pregunta provocadora','Dato sorprendente','Historia personal','Afirmación polémica'] },
      { id: 'duracion', label: '¿Duración objetivo?',            type: 'select', options: ['15 segundos','30 segundos','60 segundos'] },
      { id: 'edicion',  label: '¿Estilo de edición?',            type: 'select', options: ['Cuts rápidos + texto en pantalla','Narración continua','Solo texto (sin voz)','B-roll con voz en off'] },
      { id: 'mensaje',  label: '¿Qué mensaje quieres comunicar?',type: 'textarea', placeholder: 'Ej: cómo mi agencia ahorra 10h/semana a mis clientes usando IA' },
      { id: 'cta',      label: '¿CTA final?',                    type: 'select', options: ['Seguir la cuenta','Comentar algo','Link en bio','Enviar DM','Guardar este video'] },
    ],
  },
  {
    id: 'story', Icon: PencilSquareIcon, title: 'Prompts Story (Demo Gratis)', short: 'Story', cat: 'contenido',
    desc: '5 stories de Instagram para vender una demo gratuita de 30 minutos.',
    qs: [
      { id: 'tono',       label: '¿Qué tono usar?',                                                type: 'select', options: ['Cercano y directo','Profesional pero cálido','Energético/Motivacional','Storytelling personal'] },
      { id: 'audiencia',  label: '¿Quién va a ver estas stories?',                                 type: 'select', options: ['Lead frío (no me conoce)','Lead tibio (me sigue)','Cliente potencial caliente'] },
      { id: 'objecion',   label: '¿Cuál es la objeción principal a derribar?',                     type: 'text',   placeholder: 'Ej: "no tengo tiempo", "es caro", "ya probé otras agencias"' },
      { id: 'beneficio',  label: '¿Beneficio principal que se llevan de la demo de 30 min?',      type: 'text',   placeholder: 'Ej: plan personalizado de automatización + auditoría rápida' },
      { id: 'urgencia',   label: '¿Por qué hay urgencia / por qué pocas plazas?',                  type: 'text',   placeholder: 'Ej: solo 5 plazas esta semana, próxima cohorte en 30 días' },
    ],
  },
  {
    id: 'imagenes', Icon: PhotoIcon, title: 'Prompts Imágenes IA', short: 'Imágenes', cat: 'contenido',
    desc: '5+ prompts en inglés para DALL-E, Midjourney y Stable Diffusion. Tipos variados: producto, escena, resultado.',
    qs: [
      { id: 'tipo_imagen', label: '¿Qué tipo de imágenes necesitas?',        type: 'select', options: ['Variado (producto + escena + resultado)','Solo producto/servicio','Solo personas/lifestyle','Solo escenas y ambientes','Datos y resultados visuales'] },
      { id: 'tema',        label: '¿Tema / industria principal?',            type: 'text',   placeholder: 'Ej: fitness online, consultoría tech, agencia de IA' },
      { id: 'estilo',      label: '¿Estilo visual?',                         type: 'select', options: ['Profesional y limpio','Minimalista','Vibrante y energético','Futurista/Tech','Cálido y humano'] },
      { id: 'colores',     label: '¿Colores predominantes de tu marca?',     type: 'text',   placeholder: 'Ej: cyan, azul oscuro, blanco' },
      { id: 'formato',     label: '¿Formato principal de las imágenes?',     type: 'select', options: ['Instagram 1:1','Stories 9:16','LinkedIn/YouTube 16:9','Portada web 16:9','Variado'] },
      { id: 'audiencia',   label: '¿A quién va dirigido el contenido?',      type: 'text',   placeholder: 'Ej: emprendedores 30-45, mujeres fitness, founders tech' },
    ],
  },
  {
    id: 'carruseles', Icon: ViewColumnsIcon, title: 'Prompts Carruseles', short: 'Carruseles', cat: 'contenido',
    desc: '8 estructuras de carrusel para Instagram.',
    qs: [
      { id: 'objetivo', label: '¿Objetivo del carrusel?',    type: 'select', options: ['Educar sobre un problema','Mostrar solución paso a paso','Casos de éxito','Tips/Hacks accionables'] },
      { id: 'slides',   label: '¿Cuántos slides?',           type: 'select', options: ['5 slides','7 slides','10 slides'] },
      { id: 'tema',     label: '¿Tema específico?',          type: 'textarea', placeholder: 'Ej: "Las 5 razones por las que tu competencia ya usa IA y tú no"' },
      { id: 'cta',      label: '¿CTA final?',                type: 'select', options: ['Guardar este carrusel','Seguir para más','Agendar llamada','Comentar "INFO"'] },
      { id: 'estilo',   label: '¿Estilo del texto?',         type: 'select', options: ['Bullet points cortos','Storytelling narrativo','Datos y estadísticas','Preguntas y respuestas'] },
    ],
  },
  {
    id: 'website', Icon: GlobeAltIcon, title: 'Sitio Web con IA', short: 'Sitio Web', cat: 'estrategia',
    desc: 'Mega-prompt para Claude Code que genera tu landing page completa.',
    qs: [
      { id: 'tipo',          label: '¿Tipo de sitio web?',                type: 'select', options: ['Landing de captación de leads','Sales page (compra directa)','Portfolio/Credenciales','Página corporativa completa'] },
      { id: 'secciones',     label: '¿Qué secciones debe tener?',         type: 'textarea', placeholder: 'Ej: Hero, Problema, Solución, Beneficios, CTA' },
      { id: 'colores',       label: '¿Paleta de colores y estilo visual?', type: 'text',   placeholder: 'Ej: oscuro y minimalista con azul eléctrico' },
      { id: 'headline',      label: '¿Headline principal de la web?',      type: 'text',   placeholder: 'Ej: "Automatiza tu agencia con IA y recupera 20h/semana"' },
      { id: 'cta',           label: '¿CTA principal?',                    type: 'select', options: ['Agendar llamada gratis','Comprar ahora','Descargar recurso gratuito','Ver demo en vivo'] },
      { id: 'integraciones', label: '¿Integraciones necesarias?',         type: 'select', options: ['Formulario simple','Calendly embebido','WhatsApp flotante','Formulario + Analytics'] },
    ],
  },
  {
    id: 'propuesta', Icon: DocumentTextIcon, title: 'Propuesta Comercial', short: 'Propuesta', cat: 'ventas',
    desc: 'Documento de propuesta profesional listo para enviar a prospectos.',
    qs: [
      { id: 'servicio',     label: '¿Qué servicio propones exactamente?',   type: 'textarea', placeholder: 'Ej: implementación de chatbot de ventas' },
      { id: 'duracion',     label: '¿Duración del servicio?',               type: 'select', options: ['1 mes piloto','3 meses','6 meses','12 meses','Indefinido (retainer)'] },
      { id: 'deliverables', label: '¿Qué entregables específicos incluye?', type: 'textarea', placeholder: 'Ej: chatbot configurado, 30 días soporte, informe mensual' },
      { id: 'inversion',    label: '¿Inversión del cliente?',               type: 'text',   placeholder: 'Ej: €2,500/mes o €5,000 pago único' },
      { id: 'resultado',    label: '¿Qué resultado específico prometes?',   type: 'text',   placeholder: 'Ej: reducir tiempo de respuesta en 80%' },
      { id: 'pago',         label: '¿Forma de pago?',                       type: 'select', options: ['Mensual','50% adelanto + 50% al mes','Trimestral','Anual con descuento'] },
    ],
  },
  {
    id: 'precios', Icon: BanknotesIcon, title: 'Generador de Precios', short: 'Precios', cat: 'ventas',
    desc: '3 paquetes (Starter/Pro/Enterprise) con justificación estratégica.',
    qs: [
      { id: 'servicio',      label: '¿Cuál es tu servicio central?',              type: 'text',   placeholder: 'Ej: automatización de marketing con IA para clínicas' },
      { id: 'horas',         label: '¿Horas/semana que dedicas por cliente?',     type: 'text',   placeholder: 'Ej: 5-8 horas/semana' },
      { id: 'experiencia',   label: '¿Años de experiencia en el nicho?',          type: 'select', options: ['Menos de 1 año','1-2 años','3-5 años','5-10 años','10+ años'] },
      { id: 'mercado',       label: '¿En qué mercado operas?',                    type: 'select', options: ['España/Europa','Latinoamérica (LATAM)','USA/Reino Unido','Mercado global mixto'] },
      { id: 'modelo',        label: '¿Modelo de negocio preferido?',              type: 'select', options: ['Retainer mensual fijo','Proyecto fijo (one-off)','Setup + retainer mensual','Comisión sobre resultados'] },
      { id: 'diferencial',   label: '¿Tu mayor diferencial vs competencia?',      type: 'text',   placeholder: 'Ej: única agencia en sector salud con IA' },
      { id: 'minimo',        label: '¿Precio mínimo aceptable/mes?',              type: 'text',   placeholder: 'Ej: €1,500/mes' },
    ],
  },
  {
    id: 'emails', Icon: EnvelopeIcon, title: 'Secuencias de Email', short: 'Emails', cat: 'operaciones',
    desc: '5 emails completos de una secuencia de automatización.',
    qs: [
      { id: 'tipo',     label: '¿Tipo de secuencia?',                        type: 'select', options: ['Bienvenida/Nurturing','Conversión directa a venta','Reactivación de ex-leads','Post-compra/Onboarding','Antes de webinar/evento'] },
      { id: 'num',      label: '¿Cuántos emails?',                           type: 'select', options: ['3 emails','5 emails','7 emails'] },
      { id: 'cadencia', label: '¿Días entre cada email?',                    type: 'select', options: ['Diario','Cada 2-3 días','Semanal'] },
      { id: 'objetivo', label: '¿Objetivo final de la secuencia?',           type: 'text',   placeholder: 'Ej: agendar llamada de diagnóstico' },
      { id: 'objecion', label: '¿Objeción principal a resolver?',            type: 'text',   placeholder: 'Ej: "no tengo tiempo", "no tengo presupuesto"' },
      { id: 'tono',     label: '¿Tono de los emails?',                       type: 'select', options: ['Cercano y personal','Profesional y formal','Storytelling narrativo','Directo y conciso'] },
    ],
  },
  {
    id: 'contrato', Icon: DocumentCheckIcon, title: 'Contrato Cliente', short: 'Contrato', cat: 'operaciones',
    desc: 'Contrato de servicios profesional con todas las cláusulas.',
    qs: [
      { id: 'servicio',      label: '¿Tipo de servicio a contratar?',        type: 'text',   placeholder: 'Ej: implementación y mantenimiento de sistema de automatización con IA' },
      { id: 'duracion',      label: '¿Duración del contrato?',               type: 'select', options: ['1 mes piloto','3 meses','6 meses','12 meses','Indefinido con preaviso de 30 días'] },
      { id: 'inversion',     label: '¿Inversión y forma de pago?',           type: 'text',   placeholder: 'Ej: €3,000/mes pagadero los 5 primeros días de cada mes' },
      { id: 'deliverables',  label: '¿Entregables específicos?',             type: 'textarea', placeholder: 'Ej: 1 chatbot, 3 automatizaciones, soporte 48h, informe mensual' },
      { id: 'ip',            label: '¿Quién retiene los derechos de materiales?', type: 'select', options: ['El cliente (transferencia total)','El proveedor (yo)','Propiedad compartida','Cliente tras pago completo'] },
      { id: 'jurisdiccion',  label: '¿País/jurisdicción aplicable?',         type: 'text',   placeholder: 'Ej: España, legislación española' },
    ],
  },
  {
    id: 'tracker', Icon: ChartBarIcon, title: 'Tracker Financiero', short: 'Tracker', cat: 'operaciones',
    desc: 'Tabla financiera mensual editable con gráfico de tendencia y auto-save.',
    qs: [
      { id: 'ingreso_mensual',  label: '¿Cuál es tu ingreso mensual promedio actual?',   type: 'text',   placeholder: 'Ej: 5000' },
      { id: 'gastos_fijos',     label: '¿Cuáles son tus gastos fijos mensuales?',         type: 'text',   placeholder: 'Ej: 1200 (software, herramientas, hosting)' },
      { id: 'gastos_variables', label: '¿Gastos variables aproximados?',                  type: 'text',   placeholder: 'Ej: 300 (marketing, freelancers ocasionales)' },
      { id: 'crecimiento_anual',label: '¿Proyección de crecimiento anual estimada?',      type: 'select', options: ['10% anual','20% anual','30% anual','50% anual','100%+ anual'] },
      { id: 'periodo',          label: '¿Período de análisis?',                           type: 'select', options: ['3','6','12'] },
    ],
  },
  {
    id: 'clone-winner', Icon: DocumentDuplicateIcon, title: 'Clonar al Ganador', short: 'Clonar', cat: 'estrategia',
    desc: 'Analiza al #1 de tu nicho con IA y clona su estrategia adaptada a tu negocio.',
    qs: [
      { id: 'handle',   label: '¿Handle / nombre del líder de tu nicho?',    type: 'text',   placeholder: 'Ej: @mariafitnessover40 o "María Fitness"' },
      { id: 'platform', label: '¿Plataforma principal de ese líder?',         type: 'select', options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Twitter/X'] },
      { id: 'url',      label: '¿URL de su web o landing? (opcional)',        type: 'text',   placeholder: 'Ej: mariafitnessover40.com' },
    ],
  },
  {
    id: 'prompt-generator', Icon: CpuChipIcon, title: 'Generador de Prompts', short: 'Prompts Agentes', cat: 'automatizacion',
    desc: 'Genera el prompt de sistema profesional para tu agente IA, adaptado a GHL, ManyChat, WhatsApp, Voiceflow y más.',
    qs: [],
  },
  {
    id: 'estrategia90d', Icon: MapIcon, title: 'Estrategia 90 Días', short: 'Estrategia 90D', cat: 'estrategia',
    desc: 'Plan de acción completo de 90 días para lanzar y escalar tu agencia de IA.',
    qs: [],
  },
  {
    id: 'email-frio', Icon: PaperAirplaneIcon, title: 'Email en Frío', short: 'Email Frío', cat: 'ventas',
    desc: '3 variantes de email en frío ultra personalizadas, anti-spam y con cumplimiento de datos.',
    qs: [
      { id: 'prospecto', label: '¿A quién le escribes? (nombre, empresa, cargo, industria)', type: 'textarea', placeholder: 'Ej: Laura Gómez, directora de marketing en una clínica dental de 8 empleados' },
      { id: 'senal',     label: '¿Qué señal/observación REAL usarás para abrir? (personalización)', type: 'textarea', placeholder: 'Ej: acaban de abrir segunda sede / publicó que quiere más pacientes / su web no capta leads' },
      { id: 'oferta',    label: '¿Qué ofreces exactamente?', type: 'text', placeholder: 'Ej: sistema de captación de pacientes con IA' },
      { id: 'resultado', label: '¿Qué resultado concreto entregas?', type: 'text', placeholder: 'Ej: 20-30 citas nuevas al mes en 60 días' },
      { id: 'cta',       label: '¿Objetivo del email?', type: 'select', options: ['Agendar llamada de 15 min','Que respondan al email','Enviar un caso/loom','Pedir permiso para enviar info'] },
      { id: 'tono',      label: '¿Tono?', type: 'select', options: ['Directo y ejecutivo','Cercano y humano','Consultivo (aporta valor)','Curioso y provocador'] },
      { id: 'region',    label: '¿Dónde está el prospecto? (cumplimiento)', type: 'select', options: ['Latinoamérica','España / UE (GDPR)','EE.UU. (CAN-SPAM)','Otro'] },
    ],
  },
  {
    id: 'dm-instagram', Icon: ChatBubbleLeftRightIcon, title: 'MD por Instagram (Frío)', short: 'MD Instagram', cat: 'ventas',
    desc: 'Secuencia de mensajes directos que inician conversación real sin parecer spam.',
    qs: [
      { id: 'prospecto', label: '¿A quién le escribes? (perfil, nicho, qué publica)', type: 'textarea', placeholder: 'Ej: coach fitness con 12k seguidores que vende planes online' },
      { id: 'senal',     label: '¿Qué viste en su perfil/contenido para personalizar?', type: 'textarea', placeholder: 'Ej: su último reel sobre la falta de tiempo de sus clientes' },
      { id: 'oferta',    label: '¿Qué ofreces?', type: 'text', placeholder: 'Ej: automatización de captación y seguimiento con IA' },
      { id: 'resultado', label: '¿Resultado concreto que entregas?', type: 'text', placeholder: 'Ej: duplicar clientes sin trabajar más horas' },
      { id: 'objetivo',  label: '¿Objetivo del primer contacto?', type: 'select', options: ['Iniciar conversación (sin vender)','Agendar llamada','Enviar un caso/loom','Invitar a un recurso gratis'] },
      { id: 'tono',      label: '¿Tono?', type: 'select', options: ['Cercano y natural','Admirador genuino','Directo pero respetuoso','De colega a colega'] },
    ],
  },
  {
    id: 'guion-llamadas', Icon: PhoneIcon, title: 'Guion de Llamadas', short: 'Guion Llamadas', cat: 'ventas',
    desc: 'Guion de venta consultivo por fases: apertura, descubrimiento, objeciones y cierre.',
    qs: [
      { id: 'tipo_llamada', label: '¿Tipo de llamada?', type: 'select', options: ['Llamada en frío (cold call)','Llamada agendada (discovery)','Seguimiento post-DM/email'] },
      { id: 'prospecto',    label: '¿A quién llamas? (cargo, empresa, industria)', type: 'textarea', placeholder: 'Ej: dueño de una agencia inmobiliaria de 5 agentes' },
      { id: 'dolor',        label: '¿Dolor/problema principal que resuelves?', type: 'textarea', placeholder: 'Ej: pierden leads por no responder a tiempo' },
      { id: 'oferta',       label: '¿Qué ofreces?', type: 'text', placeholder: 'Ej: asistente de IA que responde y agenda 24/7' },
      { id: 'resultado',    label: '¿Resultado concreto + plazo?', type: 'text', placeholder: 'Ej: +30% de citas en 45 días' },
      { id: 'objecion',     label: '¿Objeción más común que esperas?', type: 'text', placeholder: 'Ej: ya tenemos a alguien / es caro / no es el momento' },
      { id: 'cta',          label: '¿Objetivo de la llamada?', type: 'select', options: ['Agendar demo/llamada larga','Cerrar la venta','Enviar propuesta','Conseguir siguiente reunión'] },
      { id: 'region',       label: '¿Región? (cumplimiento de grabación)', type: 'select', options: ['Latinoamérica','España / UE','EE.UU.','Otro'] },
    ],
  },
]

const CATS = [{ id: 'contenido', label: 'Contenido' }, { id: 'ventas', label: 'Ventas' }, { id: 'operaciones', label: 'Ops' }, { id: 'estrategia', label: 'Herramientas Estratégicas' }]

function copy(text: string) { navigator.clipboard.writeText(text); toast.success('Copiado al portapapeles') }
function download(content: string, filename: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: filename })
  a.click()
}

// ─── Output renderers (unchanged) ────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>{children}</div>
}
function CopyBtn({ text }: { text: string }) {
  return <button onClick={() => copy(text)} style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-d)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Copiar</button>
}
function ActionBar({ onCopy, onDownload, exportText, exportTitle }: { onCopy?: () => void; onDownload?: () => void; exportText?: string; exportTitle?: string }) {
  return <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
    {onCopy && <button onClick={onCopy} className="btn-secondary" style={{ flex: 1, minWidth: 120, padding: '10px 0', borderRadius: 10, fontSize: 13 }}>Copiar todo</button>}
    {onDownload && <button onClick={onDownload} className="btn-secondary" style={{ flex: 1, minWidth: 120, padding: '10px 0', borderRadius: 10, fontSize: 13 }}>Descargar TXT</button>}
    {exportText && (
      <>
        <button onClick={() => exportToPDF(exportTitle || 'documento', exportText)} className="btn-secondary" style={{ flex: 1, minWidth: 120, padding: '10px 0', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <DocumentArrowDownIcon style={{ width: 15, height: 15 }} /> PDF
        </button>
        <button onClick={() => exportToWord(exportTitle || 'documento', exportText)} className="btn-secondary" style={{ flex: 1, minWidth: 120, padding: '10px 0', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <DocumentArrowDownIcon style={{ width: 15, height: 15 }} /> Word
        </button>
      </>
    )}
  </div>
}
function TextBlocks({ items, label }: { items: unknown[]; label: string }) {
  const texts = items.map(toText)
  const joined = texts.map((it, i) => `## ${label} ${i + 1}\n${it}`).join('\n\n')
  return <div>{texts.map((item, i) => <Section key={i}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label} {i + 1}</span><CopyBtn text={item} /></div><pre style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{item}</pre></Section>)}<ActionBar onCopy={() => copy(texts.join('\n\n---\n\n'))} exportText={joined} exportTitle={label} /></div>
}
function DocBlock({ content, filename }: { content: string; filename: string }) {
  const title = filename.replace(/\.[^.]+$/, '')
  return <div><Section><div style={{ maxHeight: '55vh', overflowY: 'auto' }}><pre style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{content}</pre></div></Section><ActionBar onCopy={() => copy(content)} onDownload={() => download(content, filename)} exportText={content} exportTitle={title} /></div>
}
function MegaPromptBlock({ prompt }: { prompt: string }) {
  return <div><div style={{ background: 'var(--accent-d)', border: '1px solid var(--border-h)', borderRadius: 10, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Copia este mega-prompt y pégalo en <strong>Claude Code</strong> para generar tu sitio web completo.</div><Section><div style={{ maxHeight: '50vh', overflowY: 'auto' }}><pre style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{prompt}</pre></div></Section><button onClick={() => copy(prompt)} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 13, marginTop: 12 }}>Copiar Mega-Prompt para Claude Code</button></div>
}

function TrackerOutput({ data }: { data: { summary: Record<string, number>; months: Array<Record<string, unknown>>; alertas: string[]; recomendaciones: string[] } }) {
  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 16 }}>
      {[{ l: 'MRR Actual', v: `€${(data.summary?.mrr_actual || 0).toLocaleString()}`, c: 'var(--accent)' }, { l: 'MRR Objetivo', v: `€${(data.summary?.mrr_objetivo || 0).toLocaleString()}`, c: 'var(--purple)' }, { l: 'Clientes', v: String(data.summary?.clientes_actuales || 0), c: 'var(--text)' }, { l: 'Ticket Prom.', v: `€${(data.summary?.ticket_promedio || 0).toLocaleString()}`, c: '#10B981' }].map((s, i) => <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}><p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.l}</p><p style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</p></div>)}
    </div>
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--accent-d)', borderBottom: '1px solid var(--border)' }}>{['Mes','Clientes','MRR','Gastos','Profit','Margen%'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.04em' }}>{h}</th>)}</tr></thead>
          <tbody>{data.months?.map((m, i) => <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--accent-d)' }}><td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--text)' }}>{String(m.mes || '')}</td><td style={{ padding: '9px 14px', color: 'var(--text-2)' }}>{String(m.clientes || '')}</td><td style={{ padding: '9px 14px', color: 'var(--accent)', fontFamily: 'monospace' }}>€{Number(m.mrr || 0).toLocaleString()}</td><td style={{ padding: '9px 14px', color: '#EF4444', fontFamily: 'monospace' }}>€{Number(m.gastos || 0).toLocaleString()}</td><td style={{ padding: '9px 14px', color: '#10B981', fontFamily: 'monospace' }}>€{Number(m.profit || 0).toLocaleString()}</td><td style={{ padding: '9px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: Number(m.margen || 0) >= 40 ? '#10B98120' : '#EF444420', color: Number(m.margen || 0) >= 40 ? '#10B981' : '#EF4444' }}>{String(m.margen)}%</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
    {data.alertas?.length > 0 && <div style={{ background: '#F59E0B10', border: '1px solid #F59E0B30', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}><p style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>Alertas</p>{data.alertas.map((a, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 3 }}>• {toText(a)}</p>)}</div>}
    {data.recomendaciones?.length > 0 && <div style={{ background: 'var(--accent-d)', border: '1px solid var(--border-h)', borderRadius: 10, padding: '12px 16px' }}><p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>Recomendaciones</p>{data.recomendaciones.map((r, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 3 }}>• {toText(r)}</p>)}</div>}
  </div>
}

interface PricingPackage { name: string; price: string; setup?: string; monthly?: string; description: string; features: string[]; ideal: string; psychology?: string }
interface IrresistibleOffer { name: string; setup?: string; monthly?: string; price?: string; description: string; conditions?: string[]; features?: string[]; why_it_works?: string; pitch_script?: string }
function PricingOutput({ packages, irresistible_offer, strategy_notes }: { packages: PricingPackage[]; irresistible_offer?: IrresistibleOffer; strategy_notes?: string[] }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
      {packages?.map((pkg, i) => <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${i === 1 ? 'var(--border-h)' : 'var(--border)'}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {i === 1 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-d)', border: '1px solid var(--border-h)', borderRadius: 20, padding: '3px 10px', width: 'fit-content' }}>MÁS POPULAR</span>}
        <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{toText(pkg.name)}</p>
        {(pkg.setup || pkg.monthly) ? (
          <div>
            {pkg.setup && <p style={{ fontSize: 13, color: 'var(--text-2)' }}><span style={{ color: 'var(--text-3)' }}>Setup único:</span> <strong>{toText(pkg.setup)}</strong></p>}
            {pkg.monthly && <p style={{ fontSize: 22, fontWeight: 800, marginTop: 4, background: 'linear-gradient(135deg,var(--accent),var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{toText(pkg.monthly)}</p>}
          </div>
        ) : (
          <p style={{ fontSize: 24, fontWeight: 800, background: 'linear-gradient(135deg,var(--accent),var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{toText(pkg.price)}</p>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{toText(pkg.description)}</p>
        <div style={{ flex: 1 }}>{pkg.features?.map((f, j) => <p key={j} style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 6, marginBottom: 4 }}><CheckIcon style={{ width: 14, flexShrink: 0, color: 'var(--accent)', marginTop: 1 }} />{toText(f)}</p>)}</div>
        {pkg.psychology && <p style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--accent)', borderTop: '1px dashed var(--border)', paddingTop: 8 }}>💡 {toText(pkg.psychology)}</p>}
        <p style={{ fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>{toText(pkg.ideal)}</p>
      </div>)}
    </div>

    {irresistible_offer && (
      <div style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(245,158,11,0.08))', border: '2px solid #F59E0B', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🎁</span>
          <p style={{ fontWeight: 800, fontSize: 18, color: '#F59E0B' }}>{toText(irresistible_offer.name)}</p>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{toText(irresistible_offer.description)}</p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {irresistible_offer.setup && <div><p style={{ fontSize: 11, color: 'var(--text-3)' }}>Setup</p><p style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{toText(irresistible_offer.setup)}</p></div>}
          {irresistible_offer.monthly && <div><p style={{ fontSize: 11, color: 'var(--text-3)' }}>Mensual</p><p style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{toText(irresistible_offer.monthly)}</p></div>}
        </div>
        {irresistible_offer.conditions && irresistible_offer.conditions.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Condiciones</p>
            {irresistible_offer.conditions.map((c, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 3 }}>• {toText(c)}</p>)}
          </div>
        )}
        {irresistible_offer.features && irresistible_offer.features.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Incluye</p>
            {irresistible_offer.features.map((f, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 6, marginBottom: 3 }}><CheckIcon style={{ width: 14, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />{toText(f)}</p>)}
          </div>
        )}
        {irresistible_offer.why_it_works && <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-2)', background: 'var(--surface)', padding: 10, borderRadius: 8 }}>🧠 {toText(irresistible_offer.why_it_works)}</p>}
        {irresistible_offer.pitch_script && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Pitch para usar al cerrar:</p>
            <p style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>"{toText(irresistible_offer.pitch_script)}"</p>
          </div>
        )}
      </div>
    )}

    {strategy_notes && strategy_notes.length > 0 && (
      <div style={{ background: 'var(--accent-d)', border: '1px solid var(--border-h)', borderRadius: 10, padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>Notas estratégicas</p>
        {strategy_notes.map((n, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>• {toText(n)}</p>)}
      </div>
    )}
  </div>
}

function SlidesOutput({ slides }: { slides: Array<{ number: number; title: string; content: string; notes: string }> }) {
  return <div>{slides?.map((s, i) => <Section key={i}><div style={{ display: 'flex', gap: 12, marginBottom: 8 }}><span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-d)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{toText(s.number)}</span><p style={{ fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{toText(s.title)}</p></div><p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 8 }}>{toText(s.content)}</p>{s.notes && <p style={{ fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>Presentador: {toText(s.notes)}</p>}</Section>)}<ActionBar onDownload={() => download(slides?.map(s => `SLIDE ${s.number}: ${s.title}\n\n${s.content}\n\nPresentador: ${s.notes}`).join('\n\n---\n\n') || '', 'pitch-deck.txt')} exportText={slides?.map(s => `## SLIDE ${s.number}: ${s.title}\n${s.content}\nPresentador: ${s.notes}`).join('\n\n') || ''} exportTitle="Pitch Deck" /></div>
}

function EmailsOutput({ sequences }: { sequences: Array<{ name: string; emails: Array<{ subject: string; body: string }> }> }) {
  const exportText = sequences?.map(seq => `## ${seq.name}\n${seq.emails?.map((e, i) => `Email ${i + 1} — Asunto: ${e.subject}\n${e.body}`).join('\n\n')}`).join('\n\n') || ''
  return <div>{sequences?.map((seq, si) => <div key={si} style={{ marginBottom: 24 }}><p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-d)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{si + 1}</span>{toText(seq.name)}</p>{seq.emails?.map((email, ei) => <Section key={ei}><p style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>Email {ei + 1} — Asunto:</p><p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{toText(email.subject)}</p><p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{toText(email.body)}</p><div style={{ marginTop: 10 }}><CopyBtn text={`Asunto: ${email.subject}\n\n${email.body}`} /></div></Section>)}</div>)}<ActionBar onCopy={() => copy(exportText)} exportText={exportText} exportTitle="Secuencia de Emails" /></div>
}

function CasesOutput({ cases }: { cases: Array<{ title: string; problem: string; solution: string; result: string }> }) {
  return <div>{cases?.map((c, i) => <Section key={i}><p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-d)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>{toText(c.title)}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, fontSize: 12 }}><div><p style={{ color: '#EF4444', fontWeight: 600, marginBottom: 4 }}>Problema</p><p style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{toText(c.problem)}</p></div><div><p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Solución IA</p><p style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{toText(c.solution)}</p></div><div><p style={{ color: '#10B981', fontWeight: 600, marginBottom: 4 }}>Resultado</p><p style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{toText(c.result)}</p></div></div></Section>)}</div>
}

function ColdEmailOutput({ variantes, checklist, cumplimiento }: {
  variantes: Array<{ angulo: string; asunto_a: string; asunto_b: string; preview?: string; cuerpo: string; ps?: string; por_que_funciona?: string }>
  checklist?: string[]; cumplimiento?: string
}) {
  const exportText = (variantes || []).map((v, i) => `## Variante ${i + 1}: ${v.angulo}\nAsunto A: ${v.asunto_a}\nAsunto B: ${v.asunto_b}\nPreview: ${v.preview || ''}\n\n${v.cuerpo}${v.ps ? `\n\n${v.ps}` : ''}`).join('\n\n———\n\n')
  return <div>
    {(variantes || []).map((v, i) => (
      <Section key={i}>
        <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8, display: 'flex', gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-d)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>{toText(v.angulo)}</p>
        <p style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>Asunto A</p>
        <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{toText(v.asunto_a)}</p>
        <p style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>Asunto B</p>
        <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{toText(v.asunto_b)}</p>
        {v.preview && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>Preview: {toText(v.preview)}</p>}
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{toText(v.cuerpo)}</p>
        {v.ps && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 8 }}>{toText(v.ps)}</p>}
        {v.por_que_funciona && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>💡 {toText(v.por_que_funciona)}</p>}
        <div style={{ marginTop: 10 }}><CopyBtn text={`Asunto: ${v.asunto_a}\n\n${v.cuerpo}${v.ps ? `\n\n${v.ps}` : ''}`} /></div>
      </Section>
    ))}
    {checklist?.length ? <Section><p style={{ fontWeight: 700, color: '#10B981', marginBottom: 6 }}>✅ Checklist anti-spam</p>{checklist.map((c, i) => <p key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>• {toText(c)}</p>)}</Section> : null}
    {cumplimiento ? <Section><p style={{ fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>⚖️ Cumplimiento de datos</p><p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{toText(cumplimiento)}</p></Section> : null}
    <ActionBar onCopy={() => copy(exportText)} exportText={exportText} exportTitle="Emails en Frío" />
  </div>
}

function DMOutput({ secuencia, reglas, cumplimiento }: {
  secuencia: Array<{ paso: string; mensaje: string; objetivo?: string; nota?: string }>
  reglas?: string[]; cumplimiento?: string
}) {
  const exportText = (secuencia || []).map((s, i) => `${i + 1}. ${s.paso}\n${s.mensaje}`).join('\n\n')
  return <div>
    {(secuencia || []).map((s, i) => (
      <Section key={i}>
        <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-d)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>{toText(s.paso)}</p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{toText(s.mensaje)}</p>
        {s.objetivo && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>🎯 {toText(s.objetivo)}</p>}
        {s.nota && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>💡 {toText(s.nota)}</p>}
        <div style={{ marginTop: 10 }}><CopyBtn text={toText(s.mensaje)} /></div>
      </Section>
    ))}
    {reglas?.length ? <Section><p style={{ fontWeight: 700, color: '#10B981', marginBottom: 6 }}>✅ Reglas anti-spam (Instagram)</p>{reglas.map((c, i) => <p key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>• {toText(c)}</p>)}</Section> : null}
    {cumplimiento ? <Section><p style={{ fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>⚖️ Privacidad y términos</p><p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{toText(cumplimiento)}</p></Section> : null}
    <ActionBar onCopy={() => copy(exportText)} exportText={exportText} exportTitle="DMs Instagram" />
  </div>
}

function CallScriptOutput({ fases, queNoDecir, cumplimiento }: {
  fases: Array<{ fase: string; objetivo?: string; guion?: string; tips?: string[]; preguntas?: string[]; objeciones?: Array<{ objecion: string; respuesta: string }> }>
  queNoDecir?: string[]; cumplimiento?: string
}) {
  const exportText = (fases || []).map(f => `## ${f.fase}\n${f.objetivo ? `Objetivo: ${f.objetivo}\n` : ''}${f.guion || ''}${f.preguntas?.length ? `\nPreguntas:\n- ${f.preguntas.join('\n- ')}` : ''}${f.objeciones?.length ? `\n${f.objeciones.map(o => `Objeción: ${o.objecion}\n→ ${o.respuesta}`).join('\n')}` : ''}`).join('\n\n')
  return <div>
    {(fases || []).map((f, i) => (
      <Section key={i}>
        <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-d)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>{toText(f.fase)}</p>
        {f.objetivo && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>🎯 {toText(f.objetivo)}</p>}
        {f.guion && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{toText(f.guion)}</p>}
        {f.preguntas?.length ? <div style={{ marginTop: 8 }}>{f.preguntas.map((q, qi) => <p key={qi} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>❓ {toText(q)}</p>)}</div> : null}
        {f.objeciones?.length ? <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>{f.objeciones.map((o, oi) => <div key={oi} style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 10 }}><p style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{toText(o.objecion)}</p><p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>→ {toText(o.respuesta)}</p></div>)}</div> : null}
        {f.tips?.length ? <div style={{ marginTop: 8 }}>{f.tips.map((t, ti) => <p key={ti} style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>💡 {toText(t)}</p>)}</div> : null}
      </Section>
    ))}
    {queNoDecir?.length ? <Section><p style={{ fontWeight: 700, color: '#EF4444', marginBottom: 6 }}>🚫 Qué NO decir</p>{queNoDecir.map((c, i) => <p key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>• {toText(c)}</p>)}</Section> : null}
    {cumplimiento ? <Section><p style={{ fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>⚖️ Cumplimiento</p><p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{toText(cumplimiento)}</p></Section> : null}
    <ActionBar onCopy={() => copy(exportText)} exportText={exportText} exportTitle="Guion de Llamadas" />
  </div>
}

function RenderOutput({ toolId, result, projectId, savedAt, onRegenerate }: {
  toolId: string; result: unknown; projectId: string; savedAt?: string; onRegenerate: () => void
}) {
  const r = result as Record<string, unknown>

  if (toolId === 'calendario') {
    return (
      <CalendarVisual
        projectId={projectId}
        weeks={(r.weeks || []) as CalendarWeek[]}
        updatedAt={savedAt}
        onRegenerate={onRegenerate}
        onWeeksChange={() => {}}
      />
    )
  }

  if (toolId === 'tracker') {
    return <TrackerFinanciero projectId={projectId} />
  }

  if (toolId === 'website') {
    return <SitioWeb projectId={projectId} />
  }

  if (toolId === 'imagenes') {
    const prompts = (r.prompts || []) as ImagenPrompt[]
    return (
      <PromptsImagenes
        prompts={prompts}
        updatedAt={savedAt}
        onRegenerate={onRegenerate}
      />
    )
  }

  if (toolId === 'clone-winner') {
    return <CloneTheWinner projectId={projectId} />
  }

  if (toolId === 'estrategia90d') {
    return <Estrategia90D projectId={projectId} />
  }

  if (toolId === 'prompt-generator') {
    return <PromptGenerator projectId={projectId} />
  }

  if (toolId === 'propuesta') {
    return <PropuestaComercial projectId={projectId} />
  }

  switch (toolId) {
    case 'precios':    return <PricingOutput packages={r.packages as never} irresistible_offer={r.irresistible_offer as never} strategy_notes={r.strategy_notes as never} />
    case 'casos':      return <CasesOutput cases={r.cases as never} />
    case 'pitch':      return <SlidesOutput slides={r.slides as never} />
    case 'emails':     return <EmailsOutput sequences={r.sequences as never} />
    case 'website':    return <MegaPromptBlock prompt={r.megaprompt as string || JSON.stringify(r, null, 2)} />
    case 'propuesta':  return <PropuestaComercial projectId={projectId} />
    case 'contrato':   return <ContratoEditable projectId={projectId} initialContent={r.content as string} />
    case 'chat-agent': return <DocBlock content={r.content as string} filename="agente-ia-blueprint.md" />
    case 'vsl': {
      const sections = r.sections as Array<{ label: string; timing: string; content: string }>
      return <div>{sections?.map((s, i) => <Section key={i}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><div><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{toText(s.label)}</span><span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{toText(s.timing)}</span></div><CopyBtn text={toText(s.content)} /></div><pre style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'monospace' }}>{toText(s.content)}</pre></Section>)}<ActionBar onCopy={() => copy(sections?.map(s => `[${s.label}]\n${s.content}`).join('\n\n') || '')} onDownload={() => download(sections?.map(s => `[${s.label} - ${s.timing}]\n${s.content}`).join('\n\n') || '', 'vsl-script.txt')} exportText={sections?.map(s => `## ${s.label} (${s.timing})\n${s.content}`).join('\n\n') || ''} exportTitle="VSL Script" /></div>
    }
    case 'email-frio':     return <ColdEmailOutput variantes={r.variantes as never} checklist={r.checklist_anti_spam as never} cumplimiento={r.cumplimiento as string} />
    case 'dm-instagram':   return <DMOutput secuencia={r.secuencia as never} reglas={r.reglas_anti_spam as never} cumplimiento={r.cumplimiento as string} />
    case 'guion-llamadas': return <CallScriptOutput fases={r.fases as never} queNoDecir={r.que_no_decir as never} cumplimiento={r.cumplimiento as string} />
    default: {
      const listKey = Object.keys(r).find(k => Array.isArray(r[k]))
      const items: string[] = listKey ? (r[listKey] as string[]) : []
      const label = { reels: 'Reel', copy: 'Copy', story: 'Story', carruseles: 'Carrusel', ofertas: 'Oferta' }[toolId] || 'Item'
      return <TextBlocks items={items} label={label} />
    }
  }
}

// ─── Question form ─────────────────────────────────────────────────────────────
function QuestionForm({ tool, onSubmit, loading, projectId, initialTopic, initialAnswers }: { tool: ToolDef; onSubmit: (a: Record<string, string>) => void; loading?: boolean; projectId?: string; initialTopic?: string | null; initialAnswers?: Record<string, string> }) {
  // Campo principal de tema/mensaje donde se prerellena el tema importado del calendario
  const topicField = tool.qs.find(q => q.type === 'textarea')?.id
    || tool.qs.find(q => ['tema', 'mensaje', 'beneficio'].includes(q.id))?.id

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const base = Object.fromEntries(tool.qs.map(q => [q.id, q.options?.[0] || '']))
    if (initialTopic && topicField) base[topicField] = initialTopic
    // Prefill con respuestas previas (ej. al "Regenerar" no se pierde lo escrito).
    return { ...base, ...(initialAnswers || {}) }
  })
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({})
  const set      = (id: string, val: string) => setAnswers(p => ({ ...p, [id]: val }))
  const allFilled = tool.qs.every(q => answers[q.id]?.trim())

  const suggest = async (q: Q) => {
    if (!projectId) {
      toast.error('Falta el id del proyecto')
      return
    }
    setSuggesting(p => ({ ...p, [q.id]: true }))
    try {
      const { data } = await api.post('/suggest-answer', {
        projectId,
        toolId: tool.id,
        questionId: q.id,
        questionLabel: q.label,
        questionType: q.type,
        options: q.options,
        existingAnswers: answers,
      })
      if (data?.suggestion) {
        set(q.id, toText(data.suggestion))
        toast.success('Sugerencia generada', { duration: 1500 })
      } else {
        toast.error('No se pudo generar')
      }
    } catch {
      toast.error('Error generando sugerencia')
    } finally {
      setSuggesting(p => ({ ...p, [q.id]: false }))
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <tool.Icon style={{ width: 26, height: 26, color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', marginBottom: 'var(--sp-xs)', lineHeight: 'var(--lh-tight)' }}>{tool.title}</h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 'var(--lh-base)' }}>{tool.desc}</p>
        </div>
      </div>

      {initialTopic && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(131,87,246,0.08)', border: '1px solid rgba(131,87,246,0.25)', marginBottom: 'var(--sp-md)' }}>
          <MapIcon style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            Tarea importada desde Estrategia 90D: {initialTopic}
          </p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
        {tool.qs.map((q, i) => {
          const busy = !!suggesting[q.id]
          return (
            <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 'var(--sp-sm)' }}>
                <label htmlFor={`q-${q.id}`} style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--accent)', fontFamily: 'monospace', marginRight: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span>
                  {q.label}
                </label>
                {q.type !== 'select' && (
                  <button
                    type="button"
                    onClick={() => !busy && suggest(q)}
                    disabled={busy}
                    title="Generar respuesta con IA usando el contexto del proyecto"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 999,
                      background: busy ? 'var(--surface-2)' : 'linear-gradient(135deg, rgba(131,87,246,0.15), rgba(196,157,255,0.15))',
                      border: '1px solid var(--border-h)',
                      color: 'var(--accent)', fontSize: 11, fontWeight: 600,
                      cursor: busy ? 'wait' : 'pointer', flexShrink: 0,
                      transition: 'all 0.2s',
                    }}>
                    {busy ? (
                      <span style={{ width: 12, height: 12, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    ) : (
                      <SparklesIcon style={{ width: 12, height: 12 }} />
                    )}
                    {busy ? 'Generando…' : 'Generar con IA'}
                  </button>
                )}
              </div>
              {q.type === 'select' ? (
                <select id={`q-${q.id}`} value={answers[q.id]} onChange={e => set(q.id, e.target.value)} className="input-form" style={{ padding: '10px var(--sp-md)', cursor: 'pointer' }}>
                  {q.options!.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : q.type === 'textarea' ? (
                <textarea id={`q-${q.id}`} value={answers[q.id]} onChange={e => set(q.id, e.target.value)} placeholder={q.placeholder} rows={3} className="input-form" style={{ resize: 'none', padding: '10px var(--sp-md)' }} />
              ) : (
                <input id={`q-${q.id}`} value={answers[q.id]} onChange={e => set(q.id, e.target.value)} placeholder={q.placeholder} type="text" className="input-form" style={{ padding: '10px var(--sp-md)' }} />
              )}
            </motion.div>
          )
        })}
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: tool.qs.length * 0.04 }}
          onClick={() => allFilled && !loading && onSubmit(answers)}
          disabled={!allFilled || loading}
          className="btn-primary"
          style={{ width: '100%', marginTop: 'var(--sp-xs)', letterSpacing: '0.04em' }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Generando...
            </span>
          ) : allFilled ? `Generar ${tool.title}` : `Completa las ${tool.qs.filter(q => !answers[q.id]?.trim()).length} preguntas restantes`}
        </motion.button>
      </div>
    </div>
  )
}

// ─── Regenerate confirm modal ─────────────────────────────────────────────────
function RegenerateModal({ tool, onConfirm, onCancel }: { tool: ToolDef; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F59E0B18', border: '1px solid #F59E0B30', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <ArrowPathIcon style={{ width: 24, height: 24, color: '#F59E0B' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>¿Regenerar {tool.title}?</p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
          Se generará un nuevo contenido respondiendo las preguntas de nuevo. El anterior se sobrescribirá.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} className="btn-secondary" style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13 }}>Cancelar</button>
          <button onClick={onConfirm} className="btn-primary"   style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13 }}>Sí, regenerar</button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Tools() {
  const { id, toolId: routeToolId } = useParams<{ id: string; toolId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const { user, logout }        = useAuth()

  // Tema importado desde el calendario de Estrategia 90D (si aplica)
  const calendarTopic = (location.state as { fromCalendar?: boolean; topic?: string } | null)?.fromCalendar
    ? (location.state as { topic?: string }).topic ?? null
    : null

  const [activeTool, setActiveTool]   = useState<string | null>(null)
  const [outputTab, setOutputTab]     = useState<'current' | 'history'>('current')
  const [states, setStates]           = useState<Record<string, ToolState>>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isMobile = useIsMobile()
  const [projectName, setProjectName] = useState<string | undefined>()
  const [showRegenModal, setShowRegenModal] = useState(false)

  const tool  = TOOLS.find(t => t.id === activeTool)
  const state = activeTool ? states[activeTool] : undefined

  // Fetch project info for sidebar (Supabase directo: en prod no existe GET /api/projects/:id)
  useEffect(() => {
    if (!id) return
    getProject(id)
      .then(p => {
        if (!p) return
        setProjectName(p.name)
      })
      .catch(() => {})
  }, [id])

  const checkAndLoad = async (toolId: string, forceQuestions = false) => {
    setActiveTool(toolId)
    setOutputTab('current')
    if (states[toolId] && !forceQuestions) return // already loaded

    // These tools manage their own data — skip the AI questions/generation flow
    if (toolId === 'tracker' || toolId === 'website' || toolId === 'clone-winner' || toolId === 'propuesta' || toolId === 'estrategia90d' || toolId === 'prompt-generator') {
      setStates(p => ({ ...p, [toolId]: { phase: 'done', answers: {}, result: {} } }))
      return
    }

    // Si llega un tema desde el calendario, ir directo a preguntas para generar nuevo contenido
    if (forceQuestions) {
      setStates(p => ({ ...p, [toolId]: { phase: 'questions', answers: {}, result: null } }))
      return
    }

    setStates(p => ({ ...p, [toolId]: { phase: 'checking', answers: {}, result: null } }))
    try {
      const { data } = await api.get(`/projects/${id}/tools/${toolId}`)
      if (data.exists) {
        setStates(p => ({ ...p, [toolId]: { phase: 'done', answers: {}, result: data.result ?? data, savedAt: data.updated_at } }))
      } else {
        setStates(p => ({ ...p, [toolId]: { phase: 'questions', answers: {}, result: null } }))
      }
    } catch {
      setStates(p => ({ ...p, [toolId]: { phase: 'questions', answers: {}, result: null } }))
    }
  }

  // Auto-seleccionar la herramienta indicada en la URL (/proyecto/:id/tools/:toolId),
  // útil al navegar desde el calendario de Estrategia 90D con un tema importado.
  useEffect(() => {
    if (routeToolId && routeToolId !== activeTool) {
      checkAndLoad(routeToolId, !!calendarTopic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeToolId])

  const handleSubmit = async (answers: Record<string, string>) => {
    if (!activeTool) return
    setStates(p => ({ ...p, [activeTool]: { phase: 'generating', answers, result: null } }))
    try {
      const { data } = await api.post(`/projects/${id}/tools/${activeTool}`, { toolAnswers: answers })
      const result = data.result ?? data
      setStates(p => ({ ...p, [activeTool]: { phase: 'done', answers, result, savedAt: new Date().toISOString() } }))
      // Guardar en historial (Story, Carruseles, Imágenes, VSL, Reels, Emails)
      if (id && HISTORY_TOOLS.has(activeTool)) saveToHistory(id, activeTool, result)
    } catch (e) {
      const err = e as { code?: string; response?: { status?: number; data?: { error?: string } } }
      const isTimeout = err?.code === 'ECONNABORTED'
      const limitMsg = err?.response?.status === 429 ? err?.response?.data?.error : undefined
      toast.error(limitMsg
        || (isTimeout
          ? 'Está tardando más de lo normal. Recarga en un momento (puede haberse guardado) o reinténtalo.'
          : 'Error al generar. Inténtalo de nuevo.'))
      setStates(p => ({ ...p, [activeTool]: { phase: 'questions', answers, result: null } }))
    }
  }

  const handleRegenerate = () => setShowRegenModal(true)
  const confirmRegenerate = () => {
    if (!activeTool) return
    setShowRegenModal(false)
    // Mantiene las respuestas anteriores para regenerar sin volver a escribir todo.
    setStates(p => ({ ...p, [activeTool]: { phase: 'questions', answers: p[activeTool]?.answers || {}, result: null } }))
  }

  // Build tool states for sidebar
  const sidebarToolStates: Record<string, 'done' | 'active' | 'locked' | 'idle'> = {}
  for (const [toolId, s] of Object.entries(states)) {
    sidebarToolStates[toolId] = s.phase === 'done' ? 'done' : s.phase === 'generating' ? 'active' : 'idle'
  }
  if (activeTool) sidebarToolStates[activeTool] = state?.phase === 'done' ? 'done' : state?.phase === 'generating' ? 'active' : 'active'

  const doneCount = Object.values(states).filter(s => s.phase === 'done').length
  // Progreso = herramientas completadas en esta sesión / total. El header y el sidebar
  // usan el MISMO número, así siempre coinciden y reflejan lo realmente hecho (empieza
  // en 0 en un proyecto nuevo, no hereda el % del onboarding).
  const realProgress = TOOLS.length ? Math.round((doneCount / TOOLS.length) * 100) : 0

  const breadcrumb = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: projectName || 'Proyecto', href: `/proyecto/${id}/tools` },
    ...(tool ? [{ label: tool.title }] : []),
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Sidebar */}
      <Sidebar
        mode="project"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        projectName={projectName}
        projectProgress={realProgress}
        toolStates={sidebarToolStates}
        activeToolId={activeTool || undefined}
        onToolSelect={checkAndLoad}
        onBack={() => navigate('/dashboard')}
        user={user}
        onLogout={async () => { await logout(); navigate('/login') }}
      />

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <DashboardHeader
          breadcrumb={breadcrumb}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          scrolled={false}
          left={isMobile ? (
            <button onClick={() => setMobileNavOpen(true)} className="btn-icon" style={{ width: 36, height: 36, flexShrink: 0 }} title="Menú" aria-label="Abrir menú">
              <Bars3Icon style={{ width: 20, height: 20 }} />
            </button>
          ) : undefined}
          right={
            <span style={{ fontSize: 12, color: 'var(--text-3)', paddingRight: 8 }} aria-live="polite">
              {doneCount}/{TOOLS.length} completadas
            </span>
          }
        />

        {/* Main */}
        <main role="main" style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-xl)' }}>
          <AnimatePresence mode="wait">
            {/* ── No tool selected ── */}
            {!activeTool && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp-md)', paddingBottom: 80 }}>
                <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapIcon style={{ width: 32, height: 32, color: 'var(--accent)' }} />
                </div>
                <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)' }}>MKT Hackers — Acelerador de Agencia IA</h2>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-2)', maxWidth: 360, lineHeight: 'var(--lh-base)' }}>
                  Selecciona una herramienta del menú lateral para comenzar.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginTop: 8, maxWidth: 560 }}>
                  {TOOLS.slice(0, 8).map(t => (
                    <button key={t.id} onClick={() => checkAndLoad(t.id)}
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all .15s', fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-h)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}
                    >
                      <t.Icon style={{ width: 20, height: 20 }} />
                      {t.short}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Checking if saved ── */}
            {activeTool && state?.phase === 'checking' && (
              <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Verificando...</p>
              </motion.div>
            )}

            {/* ── Generating ── */}
            {activeTool && state?.phase === 'generating' && (
              <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-xl) 0' }}>
                <LoadingTrivia />
              </motion.div>
            )}

            {/* ── Done / Calendar visual / Other results ── */}
            {activeTool && state?.phase === 'done' && (
              <motion.div key={`done-${activeTool}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Header — only for AI-generated tools (not standalone interactive ones) */}
                {!['calendario', 'tracker', 'website', 'clone-winner', 'propuesta', 'estrategia90d', 'prompt-generator'].includes(activeTool) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {tool && <tool.Icon style={{ width: 20, height: 20, color: 'var(--accent)' }} />}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{tool?.title}</p>
                        <p style={{ fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckIcon style={{ width: 12 }} /> Guardado
                          {state.savedAt && ` · ${new Date(state.savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={handleRegenerate}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                      <ArrowPathIcon style={{ width: 14 }} /> Regenerar
                    </button>
                  </div>
                )}
                {HISTORY_TOOLS.has(activeTool) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    {([['current', 'Resultado'], ['history', 'Historial']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setOutputTab(key)}
                        style={{
                          padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          background: 'transparent', border: 'none',
                          color: outputTab === key ? 'var(--accent)' : 'var(--text-3)',
                          borderBottom: `2px solid ${outputTab === key ? 'var(--accent)' : 'transparent'}`,
                          marginBottom: -1,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {HISTORY_TOOLS.has(activeTool) && outputTab === 'history' ? (
                  <HistoryPanel projectId={id!} toolId={activeTool} title={tool?.title || 'Contenido'} />
                ) : (
                  <RenderOutput
                    toolId={activeTool}
                    result={state.result}
                    projectId={id!}
                    savedAt={state.savedAt}
                    onRegenerate={handleRegenerate}
                  />
                )}
              </motion.div>
            )}

            {/* ── Questions ── */}
            {activeTool && state?.phase === 'questions' && (
              <motion.div key={`q-${activeTool}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                {tool && <QuestionForm tool={tool} onSubmit={handleSubmit} projectId={id} initialTopic={calendarTopic} initialAnswers={state?.answers} />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Regenerate confirm modal */}
      {showRegenModal && tool && (
        <RegenerateModal tool={tool} onConfirm={confirmRegenerate} onCancel={() => setShowRegenModal(false)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
