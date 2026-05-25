import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña son requeridos' })
    return
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    res.status(400).json({ error: error.message })
    return
  }

  res.json({ user: data.user, session: data.session })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    res.status(401).json({ error: error.message })
    return
  }

  res.json({ user: data.user, session: data.session })
})

router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) await supabase.auth.admin.signOut(token)
  res.json({ message: 'Sesión cerrada' })
})

export default router
