import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { supabaseAdmin } from '../services/supabaseService'

const router = Router()

router.use(requireAuth as any)

// GET /projects — list user's projects
router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', req.userId!)
    .order('updated_at', { ascending: false })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ projects: data })
})

// POST /projects — create project
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body
  if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      user_id: req.userId!,
      name: name.trim(),
      description: description?.trim() || '',
      progress: 0,
      current_step: 1,
      total_steps: 5,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json({ project: data })
})

// GET /projects/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single()

  if (error || !data) { res.status(404).json({ error: 'Proyecto no encontrado' }); return }
  res.json({ project: data })
})

// PUT /projects/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { name, description, progress, current_step, status } = req.body
  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({ name, description, progress, current_step, status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ project: data })
})

// DELETE /projects/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ message: 'Proyecto eliminado' })
})

// POST /projects/:id/questions — save answers
router.post('/:id/questions', async (req: AuthRequest, res: Response) => {
  const { answers } = req.body

  const { error: upsertErr } = await supabaseAdmin
    .from('project_questions')
    .upsert({ project_id: req.params.id, answers_json: answers }, { onConflict: 'project_id' })

  if (upsertErr) { res.status(500).json({ error: upsertErr.message }); return }

  await supabaseAdmin
    .from('projects')
    .update({ current_step: 2, progress: 20, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)

  res.json({ message: 'Respuestas guardadas' })
})

export default router
