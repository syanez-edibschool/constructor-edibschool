import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

const DOMINIO_EQUIPO = '@edibschool.com'

// El equipo interno (@edibschool.com) entra SÍ O SÍ, esté o no en WordPress.
// Como el magic link usa shouldCreateUser:false, primero pedimos al backend que
// dé de alta el email (allí se valida el dominio con service_role); si ya
// existía responde ok igual. Después el magic link sale por el flujo normal.
async function altaEquipo(email: string): Promise<void> {
  if (!email.endsWith(DOMINIO_EQUIPO)) return
  try {
    await fetch('/api/acceso-edib', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  } catch {
    // Si el alta falla seguimos igual: el magic link avisará si no tiene acceso.
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signup = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw new Error(error.message)
  }

  // Magic link: envía un email con un link de acceso sin contraseña.
  // shouldCreateUser:false → SOLO entran emails ya creados (vía WordPress/webhook).
  const loginWithMagicLink = async (rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase()
    await altaEquipo(email)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      // Mensaje claro si el email no está autorizado
      if (error.message.toLowerCase().includes('signups not allowed') ||
          error.message.toLowerCase().includes('not found')) {
        throw new Error('Este email no tiene acceso. Pídele a tu administrador que te dé de alta.')
      }
      throw new Error(error.message)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, login, signup, logout, loginWithMagicLink }
}
