import type { VercelRequest, VercelResponse } from '@vercel/node'

// Video de inicio (VdoCipher, DRM). El OTP se genera server-side con el API
// Secret y se añade una marca de agua dinámica con el correo del espectador
// (rastreable si alguien graba la pantalla). El secret nunca llega al cliente.
const VIDEO_ID = '9a7a847e7d034ab9a843a5820951a3f2'

function emailFromBearer(auth?: string): string {
  try {
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return ''
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    return payload?.email || payload?.user_metadata?.email || ''
  } catch {
    return ''
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.VDOCIPHER_API_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'VDOCIPHER_API_SECRET no configurada en Vercel' })
    }

    const email = emailFromBearer(req.headers.authorization)
    // Marca de agua dinámica (texto que se mueve) con el correo del espectador.
    const annotate = email
      ? JSON.stringify([
          { type: 'rtext', text: email, alpha: '0.55', color: '0xFFFFFF', size: '14', interval: '4000' },
        ])
      : undefined

    const body: Record<string, unknown> = { ttl: 300 }
    if (annotate) body.annotate = annotate

    const r = await fetch(`https://dev.vdocipher.com/api/videos/${VIDEO_ID}/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Apisecret ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.message || 'Error de VdoCipher' })
    }
    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json({ otp: data.otp, playbackInfo: data.playbackInfo })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al generar OTP' })
  }
}
