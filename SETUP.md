# Constructor MVP — Guía de Setup

## 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
VITE_SUPABASE_URL=https://[tu-proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
VITE_APP_URL=http://localhost:5173
```

## 2. Crear base de datos en Supabase

1. Ve a supabase.com → nuevo proyecto
2. SQL Editor → pega el contenido de `server/db/schema.sql` → Run

## 3. Instalar dependencias

```bash
npm install
```

## 4. Ejecutar en desarrollo

**Terminal 1 — Frontend:**
```bash
npm run dev:frontend
```

**Terminal 2 — Backend:**
```bash
npm run dev:backend
```

Abre: http://localhost:5173

## Estructura del proyecto

```
src/
  pages/          → Todas las páginas React
  components/ui/  → Componentes 3D reutilizables
  hooks/          → useAuth, etc.
  services/       → api.ts, supabase.ts

server/
  routes/         → auth, projects, generation, download
  services/       → openaiService, anthropicService, supabaseService
  middleware/     → auth, errorHandler
  db/schema.sql   → Esquema completo de Supabase
```

## Flujo de usuario

1. /login → /signup → /dashboard
2. Click "Crear proyecto" → nombre + descripción
3. /proyecto/:id/questions → 30 preguntas MC
4. /proyecto/:id/review-niche → IA genera Nicho + Avatar + Competencia
5. /proyecto/:id/tools → Menú 16 herramientas
6. /proyecto/:id/tools/:toolId → Generar herramienta específica
7. /proyecto/:id/download → Descargar ZIP con todo
