import type { IncomingMessage, ServerResponse } from 'http'
import app from '../server/app'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Strip /api prefix so Express routes match (/projects, /auth, etc.)
  if (req.url?.startsWith('/api')) {
    req.url = req.url.slice(4) || '/'
  }
  return (app as any)(req, res)
}
