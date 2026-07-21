import type { VercelRequest, VercelResponse } from '@vercel/node'

// Video de inicio (VdoCipher). El OTP se genera server-side con el API Secret,
// nunca se expone en el cliente.
const VIDEO_ID = '9a7a847e7d034ab9a843a5820951a3f2'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.VDOCIPHER_API_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'VDOCIPHER_API_SECRET no configurada en Vercel' })
    }

    const r = await fetch(`https://dev.vdocipher.com/api/videos/${VIDEO_ID}/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Apisecret ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ttl: 300 }),
    })

    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.message || 'Error de VdoCipher' })
    }
    // Cache corto para no pedir un OTP nuevo en cada render.
    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json({ otp: data.otp, playbackInfo: data.playbackInfo })
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al generar OTP' })
  }
}
