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

app.use(cors({ origin: '*', credentials: false }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/auth', authRoutes)
app.use('/projects', projectRoutes)
app.use('/projects', generationRoutes)
app.use('/projects', downloadRoutes)
app.use('/coach', coachRoutes)

app.use(errorHandler)

export default app
