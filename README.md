# Constructor — Edibschool

Full-stack app para construir agencias de IA. Genera nicho, avatar, competencia, herramientas de contenido/ventas y coach IA personalizado.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express 5 + TypeScript (tsx)
- **IA**: Anthropic Claude (Sonnet para generación, Haiku para coach)
- **DB / Auth**: Supabase (PostgreSQL + JWT auth)
- **Deploy**: Vercel (frontend estático + serverless function para el backend)

---

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

```env
ANTHROPIC_API_KEY=sk-ant-xxx        # Desde console.anthropic.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
VITE_APP_URL=http://localhost:5173
PORT=3001
```

### 3. Verificar conexión con Anthropic

```bash
npm run test:anthropic
```

Deberías ver: `✅ Anthropic API funcionando!`

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Esto arranca **ambos** servidores:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

> ⚠️ No uses `npm run dev:frontend` solo — el backend debe estar activo para que funcionen las herramientas IA.

---

## Estructura del proyecto

```
├── src/                    # Frontend React
│   ├── pages/              # Rutas principales
│   ├── components/         # Componentes reutilizables
│   │   ├── Tools/          # Herramientas generadoras
│   │   ├── Dashboard/      # Sidebar, Header
│   │   └── AICoach/        # Widget del coach
│   └── services/           # API clients (api.ts, claude.ts, supabase.ts)
├── server/                 # Backend Express
│   ├── routes/             # Endpoints
│   │   ├── generation.ts   # /projects/:id/tools/:toolId
│   │   ├── coach.ts        # /coach/message, /coach/suggestion/:id
│   │   └── claude.ts       # /claude/generate, /claude/chat, /claude/analyze-competitor
│   ├── services/
│   │   └── anthropicService.ts  # generateWithClaude, generateCoachReply
│   └── middleware/auth.ts  # Supabase JWT validation
├── api/
│   └── index.ts            # Vercel serverless wrapper
├── scripts/
│   └── test-anthropic.ts   # Test de conexión
└── vercel.json             # Config de deploy
```

---

## Deploy en Vercel

### Variables de entorno en Vercel

En **Vercel Dashboard → Tu proyecto → Settings → Environment Variables**, agrega:

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave de Anthropic |
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `VITE_APP_URL` | URL de tu deploy en Vercel |

> `PORT` no es necesario en Vercel (usa funciones serverless).

### Deploy automático

Cada `git push` a `main` triggerea un deploy automático en Vercel.

```bash
git add .
git commit -m "feat: ..."
git push
```

---

## API Endpoints

### Herramientas de generación (requieren auth)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/projects/:id/generate-nicho-avatar-competencia` | Genera nicho, avatar y análisis de competencia |
| POST | `/projects/:id/tools/:toolId` | Genera contenido de herramienta (calendario, VSL, etc.) |
| GET | `/projects/:id/tools/:toolId` | Verifica si ya existe resultado guardado |

### Coach IA

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/coach/message` | Envía mensaje al coach |
| GET | `/coach/suggestion/:projectId` | Obtiene sugerencia proactiva |

### Claude genérico

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/claude/generate` | Generación de contenido libre |
| POST | `/claude/chat` | Chat con contexto |
| POST | `/claude/analyze-competitor` | Análisis de competidor |
