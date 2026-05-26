export interface TriviaQuestion {
  question: string
  options: string[]
  correct: number
  fact: string
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    question: '¿Cuál es la tasa de conversión promedio para agencias de IA?',
    options: ['2-5%', '8-15%', '20-30%', '40%+'],
    correct: 1,
    fact: 'Las agencias de IA con buen positioning logran 8-15% de conversión en leads.',
  },
  {
    question: '¿Cuánto tarda en promedio un cliente en decidir contratar una agencia?',
    options: ['3 días', '7-14 días', '1 mes', '3+ meses'],
    correct: 2,
    fact: 'El ciclo de venta típico es de 1 mes. Por eso es clave la educación pre-venta.',
  },
  {
    question: '¿Cuál es el canal más efectivo para atraer clientes high-ticket?',
    options: ['TikTok', 'LinkedIn + Email', 'Anuncios pagos', 'Referidos'],
    correct: 1,
    fact: 'LinkedIn + Email son los reyes para B2B. TikTok es para awareness de marca.',
  },
  {
    question: '¿Cuál debería ser tu ticket promedio si quieres 6 clientes al mes?',
    options: ['$500/mes', '$2,000/mes', '$5,000+/mes', '$15,000+/mes'],
    correct: 2,
    fact: 'Con 6 clientes a $5k/mes = $30k MRR. Es el sweet spot para agencias.',
  },
  {
    question: '¿Qué % de tráfico debería ser orgánico idealmente?',
    options: ['10-20%', '30-40%', '50-70%', '80%+'],
    correct: 2,
    fact: 'Tráfico orgánico >50% significa que tu contenido trabaja 24/7 para ti.',
  },
  {
    question: '¿Cuál es el costo promedio de adquisición (CAC) ideal?',
    options: ['5% del ticket', '20% del ticket', 'No importa', '100%+ del ticket'],
    correct: 0,
    fact: 'Si gastas $250 para adquirir un cliente de $5k, tu CAC es 5%. Perfecto.',
  },
  {
    question: '¿Cuántos videos/semana necesita una agencia para escalar?',
    options: ['1 video', '3-5 videos', '10+ videos', 'Solo texto y email'],
    correct: 1,
    fact: '3-5 piezas de contenido/semana es el mínimo para romper la curva.',
  },
  {
    question: '¿Cuál es la métrica más importante para medir éxito?',
    options: ['Seguidores', 'Engagement', 'Leads cualificados', 'Visualizaciones'],
    correct: 2,
    fact: 'Leads cualificados > Todo. Un cliente vale más que 100k followers.',
  },
  {
    question: '¿Cuánto tiempo tarda en madurar una estrategia de contenido?',
    options: ['2 semanas', '1 mes', '90 días', '6 meses'],
    correct: 2,
    fact: '90 días es el mínimo para ver resultados reales. SEO + viral es juego largo.',
  },
  {
    question: '¿Cuál es la mejor forma de validar un nicho?',
    options: ['Intuición', 'Buscar competidores', 'Entrevistar 20+ potenciales clientes', 'Google Trends'],
    correct: 2,
    fact: 'Las entrevistas ganan. No lances sin validar con gente real del nicho.',
  },
  {
    question: '¿A qué edad está tu avatar ideal?',
    options: ['18-25 años', '25-35 años', '35-50 años', '50+ años'],
    correct: 1,
    fact: 'El sweet spot es 30-45 años: poder de compra + presencia digital.',
  },
  {
    question: '¿Cuál es el ROI esperado después de 6 meses?',
    options: ['2x', '5x', '10x', 'Variable por nicho'],
    correct: 2,
    fact: 'Si inviertes bien en construcción, espera 10x de crecimiento en 6 meses.',
  },
  {
    question: '¿Cuántos competidores directos debería analizar?',
    options: ['1-2', '3-5', '10+', 'Todos los que existen'],
    correct: 1,
    fact: '3-5 competidores top te dan el 80% de insights. Análisis paralización no.',
  },
  {
    question: '¿Cuál es el mejor CTA para agencias?',
    options: ['Comprar ahora', 'Ver caso de estudio', 'Agendar llamada', 'Suscribir'],
    correct: 2,
    fact: 'Llamadas > Emails. High-ticket requiere conversación 1-a-1.',
  },
  {
    question: '¿Cuántos casos de éxito necesitas para escalar?',
    options: ['1 caso', '3 casos', '5-7 casos', '15+ casos'],
    correct: 2,
    fact: '5-7 casos + números = Social proof que vende. Documenta TODO.',
  },
]
