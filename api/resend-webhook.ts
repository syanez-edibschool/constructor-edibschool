import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook de Resend → project_email_eventos.
//
// POR QUÉ: la API de Resend no permite buscar correos por destinatario, así que
// no se puede preguntar «¿le llegó a este alumno?». Resend sí puede EMPUJARNOS
// cada evento; los guardamos y el panel los consulta al instante.
//
// CONFIGURACIÓN en Resend → Webhooks → Add Webhook:
//   URL: https://acelerador.mkthackers.com/api/resend-webhook?token=<RESEND_WEBHOOK_TOKEN>
//   Eventos: email.sent, email.delivered, email.delivery_delayed,
//            email.bounced, email.complained, email.opened
//
// Variables de entorno (Vercel):
//   RESEND_WEBHOOK_TOKEN      → cadena larga y aleatoria, inventada por ti
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// NOTA sobre la autenticación: validamos un token compartido en la query, igual
// que hace api/wp-webhook.ts. Resend firma además con Svix, pero verificar esa
// firma exige el cuerpo crudo de la petición, y Vercel ya lo ha parseado a JSON
// cuando llega aquí. El token en HTTPS es suficiente para esto (nadie puede
// adivinarlo y el tráfico es servidor a servidor); si algún día hace falta la
// verificación criptográfica, habrá que leer el cuerpo como stream.
// ─────────────────────────────────────────────────────────────────────────────

interface EventoResend {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[] | string
    subject?: string
    created_at?: string
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const esperado = process.env.RESEND_WEBHOOK_TOKEN
  if (!esperado) {
    console.error('[resend-webhook] Falta RESEND_WEBHOOK_TOKEN')
    return res.status(500).json({ error: 'Webhook no configurado' })
  }
  const recibido = (req.query?.token || '').toString()
  if (recibido !== esperado) return res.status(401).json({ error: 'No autorizado' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) {
    console.error('[resend-webhook] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Supabase no configurado' })
  }

  const evento = (req.body || {}) as EventoResend
  const tipo = (evento.type || '').toString()
  if (!tipo) return res.status(400).json({ error: 'Evento sin type' })

  // `to` puede venir como cadena o como arreglo (copias, varios destinatarios).
  const destinos = Array.isArray(evento.data?.to)
    ? evento.data!.to as string[]
    : evento.data?.to
      ? [String(evento.data.to)]
      : []
  if (destinos.length === 0) {
    // Sin destinatario no hay nada que buscar después; lo aceptamos y seguimos
    // para que Resend no lo reintente en bucle.
    return res.status(200).json({ ok: true, guardados: 0 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const filas = destinos.map((destino) => ({
    email: String(destino).trim().toLowerCase(),
    resend_id: evento.data?.email_id || null,
    tipo,
    asunto: evento.data?.subject || null,
    ocurrido_en: evento.created_at || evento.data?.created_at || new Date().toISOString(),
    payload: evento as unknown as Record<string, unknown>,
  }))

  const { error } = await admin.from('project_email_eventos').insert(filas)

  if (error) {
    // 23505 = clave duplicada. Resend reintenta los webhooks, así que recibir el
    // mismo evento dos veces es NORMAL: lo damos por bueno para que deje de
    // reintentar. Cualquier otro error sí es un fallo real.
    if (error.code === '23505') return res.status(200).json({ ok: true, estado: 'duplicado' })
    console.error('[resend-webhook] No se pudo guardar el evento:', error.message)
    return res.status(500).json({ error: 'No se pudo guardar el evento' })
  }

  return res.status(200).json({ ok: true, guardados: filas.length })
}
