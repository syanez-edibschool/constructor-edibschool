// Reporte de errores a Sentry para las funciones serverless de /api.
//
// Vivía en `api/_sentry.ts` y NADIE lo importaba, porque Vercel no bundlea los
// archivos `_`-prefijados importados desde `api/` (→ FUNCTION_INVOCATION_FAILED).
// Por eso está aquí: importar desde `src/lib/` sí funciona, y es lo que manda el
// CLAUDE.md del ecosistema. Sin esto, los errores del SERVIDOR no llegaban a
// Sentry: solo veíamos los del navegador.
//
// IMPORTANTE: NO usamos el SDK @sentry/node — su empaquetado rompía las funciones
// serverless de Vercel (FUNCTION_INVOCATION_FAILED al arrancar). En su lugar
// enviamos el evento con un fetch directo al endpoint de ingest de Sentry. Es
// ligero, sin dependencias, y va todo en try/catch: jamás puede romper la request.
//
// El DSN es público. Se puede sobreescribir con SENTRY_DSN en Vercel.
const DSN = process.env.SENTRY_DSN
  || 'https://3a16ae2973c920ebc0f11a22885ee428@o4511498210770944.ingest.de.sentry.io/4511501526696016'

function storeUrl(dsn: string): string | null {
  try {
    const u = new URL(dsn)
    const key = u.username
    const projectId = u.pathname.replace(/^\//, '')
    if (!key || !projectId) return null
    return `https://${u.host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`
  } catch {
    return null
  }
}

function eventId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, '')
  } catch { /* ignore */ }
  return (Date.now().toString(16) + '0000000000000000').slice(0, 32)
}

export async function reportarError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const url = storeUrl(DSN)
    if (!url) return
    const e = error as { message?: unknown; name?: unknown }
    const value = e && typeof e.message === 'string' ? e.message : String(error)
    const type = e && typeof e.name === 'string' ? e.name : 'Error'

    const body = JSON.stringify({
      event_id: eventId(),
      timestamp: Math.floor(Date.now() / 1000),
      level: 'error',
      platform: 'node',
      environment: process.env.VERCEL_ENV || 'production',
      exception: { values: [{ type, value }] },
      extra: context || {},
    })

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    /* no-op: el monitoreo jamás debe romper la request */
  }
}
