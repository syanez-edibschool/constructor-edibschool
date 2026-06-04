import axios from 'axios'
import * as Sentry from '@sentry/react'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  // Tope de espera de 3 min: evita el "spinner infinito" si una petición se cuelga.
  // Si la generación sí terminó en el backend, queda guardada y aparece al recargar.
  timeout: 180000,
})

// Attach Supabase JWT on every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      supabase.auth.signOut()
      window.location.href = '/login'
    }
    // Cuelgue silencioso: el cliente cortó por timeout (3 min) sin respuesta del
    // servidor. Es el "punto ciego" que ni el backend ni UptimeRobot detectan,
    // así que lo reportamos a Sentry para enterarnos.
    if (err.code === 'ECONNABORTED') {
      Sentry.captureException(err, {
        tags: { tipo: 'timeout-cliente' },
        extra: { url: err.config?.url, timeoutMs: 180000 },
      })
    }
    return Promise.reject(err)
  }
)
