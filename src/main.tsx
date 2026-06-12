import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './styles/globals.css'

// ── Sentry: monitoreo de errores (avisa al instante cuando algo falla) ──
// El DSN es público (no es secreto). Se puede sobreescribir con VITE_SENTRY_DSN.
// Solo se activa en producción para no llenar de ruido el desarrollo local.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN
    || 'https://3a16ae2973c920ebc0f11a22885ee428@o4511498210770944.ingest.de.sentry.io/4511501526696016',
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  // Solo errores: sin tracing ni replay, para no gastar la cuota del plan gratuito.
  tracesSampleRate: 0,
  sendDefaultPii: false,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#e5e7eb', background: '#0E0B30', minHeight: '100vh' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Recarga la página. Si el problema persiste, vuelve a intentarlo en unos minutos.</p>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
)
