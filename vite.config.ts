import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Connect, ViteDevServer } from 'vite'
import type { ServerResponse } from 'node:http'

// ─────────────────────────────────────────────────────────────────────────────
// En dev, `/api/*` se proxya al Express de server/index.ts (puerto 3001), así que
// la carpeta api/ (funciones de Vercel) NO se sirve en local. Este plugin sirve
// SOLO el endpoint del acceso directo, delante del proxy.
//
// Acotado a esa única ruta a propósito: si sirviera cualquier /api/<x> con un
// api/<x>.ts existente, le robaría al Express rutas que hoy funcionan en dev.
//
// Y no se toca vercel.json: en producción su rewrite catch-all es necesario para
// el enrutado del SPA (y es justo lo que hace inservible a `vercel dev` aquí).
// ─────────────────────────────────────────────────────────────────────────────
const RUTA_LOGIN = '/api/login-directo'

function loginDirectoEnDesarrollo(env: Record<string, string>) {
  return {
    name: 'login-directo-en-desarrollo',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      // El handler lee process.env; Vite no lo puebla con las variables sin VITE_.
      Object.assign(process.env, env)
      // Registrado aquí, no en una función devuelta: tiene que ir ANTES del proxy
      // de /api y del fallback del SPA.
      server.middlewares.use(async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        if ((req.url || '').split('?')[0] !== RUTA_LOGIN) return next()
        try {
          const trozos: Buffer[] = []
          for await (const t of req) trozos.push(t as Buffer)
          const crudo = Buffer.concat(trozos).toString('utf8')
          const reqApi = req as Connect.IncomingMessage & { body?: unknown }
          reqApi.body = crudo ? JSON.parse(crudo) : {}
          const resApi = res as ServerResponse & {
            status?: (c: number) => unknown
            json?: (d: unknown) => unknown
          }
          resApi.status = (c: number) => { res.statusCode = c; return resApi }
          resApi.json = (d: unknown) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(d))
            return resApi
          }
          const mod = await server.ssrLoadModule(`${RUTA_LOGIN}.ts`)
          await mod.default(reqApi, resApi)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Error inesperado' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')   // '' carga TODAS, no solo las VITE_
  return {
    define: {
      __APP_BUILD__: JSON.stringify(Date.now().toString()),
    },
    plugins: [react(), loginDirectoEnDesarrollo(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
