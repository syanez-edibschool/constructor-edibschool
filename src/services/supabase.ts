import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not set. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
}

// ─── SSO entre subdominios de mkthackers.com ────────────────────────────────
// La sesión se guarda en una cookie con dominio ".mkthackers.com", compartida
// por Acelerador + Seguimiento + Mentorías → un solo login para las 3.
// (Oportunidades/bolsa de empleo NO usa este cliente: mantiene su login propio.)
// En localhost/preview cae a cookie normal del host (sin dominio compartido).
const sharedDomain =
  typeof window !== 'undefined' && window.location.hostname.endsWith('mkthackers.com')
    ? '.mkthackers.com'
    : undefined
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'

export const supabase = createBrowserClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    cookieOptions: {
      domain: sharedDomain,
      path: '/',
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 60 * 60 * 24 * 365,
    },
  },
)
