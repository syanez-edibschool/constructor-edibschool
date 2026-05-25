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

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, login, signup, logout }
}
