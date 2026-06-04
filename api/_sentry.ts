// Reporte de errores a Sentry para las funciones serverless de /api.
// El prefijo "_" hace que Vercel NO trate este archivo como un endpoint.
//
// IMPORTANTE: @sentry/node se carga de forma PEREZOSA (import dinámico dentro de
// reportError) y TODO va en try/catch. Así, cargar este módulo NO ejecuta nada de
// Sentry y NUNCA puede crashear la función al arrancar. Si Sentry no carga o falla,
// simplemente no se reporta — la app sigue funcionando igual.
//
// El DSN es público. Se puede sobreescribir con SENTRY_DSN en Vercel.
const DSN = process.env.SENTRY_DSN
  || 'https://3a16ae2973c920ebc0f11a22885ee428@o4511498210770944.ingest.de.sentry.io/4511501526696016'

let sentryRef: any = null
let initDone = false

async function load(): Promise<any | null> {
  try {
    if (!sentryRef) {
      sentryRef = await import('@sentry/node')
    }
    if (!initDone) {
      sentryRef.init({
        dsn: DSN,
        environment: process.env.VERCEL_ENV || 'production',
        tracesSampleRate: 0,
      })
      initDone = true
    }
    return sentryRef
  } catch {
    return null
  }
}

// Reporta un error a Sentry. Carga Sentry justo en el momento, captura y hace flush
// (en serverless hay que esperar el envío). Nunca lanza: el monitoreo no debe romper nada.
export async function reportError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const Sentry = await load()
    if (!Sentry) return
    Sentry.captureException(error, context ? { extra: context } : undefined)
    await Sentry.flush(2000)
  } catch {
    /* no-op: el monitoreo jamás debe romper la request */
  }
}
