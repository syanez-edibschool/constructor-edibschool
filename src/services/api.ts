import axios from 'axios'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach Supabase JWT on every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
