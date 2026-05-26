import type { IncomingMessage, ServerResponse } from 'http'

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 404
  res.end(JSON.stringify({ error: 'Route not found' }))
}
