// Monitoreo de errores para las funciones serverless de /api.
// El prefijo "_" hace que Vercel NO trate este archivo como un endpoint.
//
// El DSN es público (no es secreto). Se puede sobreescribir con la variable
// de entorno SENTRY_DSN en Vercel. Solo capturamos errores (sin tracing) para
// no gastar la cuota del plan gratuito.
import * as Sentry from '@sentry/node'

const DSN = process.env.SENTRY_DSN
  || 'https://3a16ae2973c920ebc0f11a22885ee428@o4511498210770944.ingest.de.sentry.io/4511501526696016'

let started = false
function ensureInit(): void {
  if (started) return
  try {
    Sentry.init({
      dsn: DSN,
      environment: process.env.VERCEL_ENV || 'production',
      tracesSampleRate: 0,
    })
    started = true
  } catch {
    /* el monitoreo nunca debe romper la app */
  }
}
ensureInit()

// Reporta un error a Sentry y espera a que se envíe. En serverless hay que hacer
// flush antes de que la función se congele, o el evento se pierde. Nunca lanza.
export async function reportError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    ensureInit()
    Sentry.captureException(error, context ? { extra: context } : undefined)
    await Sentry.flush(2000)
  } catch {
    /* no-op: el monitoreo jamás debe romper la request */
  }
}
