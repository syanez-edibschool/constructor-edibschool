import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

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

  // Acceso directo con el correo: sin contraseña, sin enlace por correo, sin OTP.
  // El servidor comprueba que el correo tenga acceso y devuelve un token_hash que
  // canjeamos aquí mismo. La sesión resultante es una sesión REAL de Supabase
  // (JWT con role: authenticated), así que RLS sigue aplicando igual.
  const entrarConCorreo = async (rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase()

    const resp = await fetch('/api/login-directo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok || !data?.token_hash) {
      throw new Error(data?.error || 'No se pudo entrar.')
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    })
    if (error) throw new Error('No se pudo iniciar la sesión.')
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, login, signup, logout, entrarConCorreo }
}
