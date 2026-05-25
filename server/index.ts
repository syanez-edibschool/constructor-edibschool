import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import generationRoutes from './routes/generation'
import downloadRoutes from './routes/download'
import coachRoutes from './routes/coach'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.VITE_APP_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/auth', authRoutes)
app.use('/projects', projectRoutes)
app.use('/projects', generationRoutes)
app.use('/projects', downloadRoutes)
app.use('/coach', coachRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 Constructor API running on http://localhost:${PORT}`)
})
