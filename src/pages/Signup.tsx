import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import ParticleBackground from '../components/ui/ParticleBackground'
import MorphingShapes from '../components/ui/MorphingShapes'
import Button3D from '../components/ui/Button3D'
import Input3D from '../components/ui/Input3D'
import { useAuth } from '../hooks/useAuth'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) {
      toast.error('Completa todos los campos')
      return
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await signup(email, password, name)
      toast.success('¡Cuenta creada! Revisa tu email para confirmar.')
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear cuenta'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-dark p-4">
      <ParticleBackground />
      <MorphingShapes />

      <div className="fixed top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #C49DFF 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="fixed bottom-1/3 left-1/3 w-80 h-80 rounded-full opacity-8 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8357F6 0%, transparent 70%)', filter: 'blur(80px)' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <img src="/logo_blanco.png" alt="MKT Hackers" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
            </div>
            <p className="text-white/50 text-sm tracking-widest uppercase">Crea tu cuenta gratis</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input3D
              label="Nombre completo"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <Input3D
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input3D
              label="Contraseña"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input3D
              label="Confirmar contraseña"
              type="password"
              placeholder="Repite tu contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />

            <Button3D type="submit" loading={loading} fullWidth size="lg" className="mt-2">
              CREAR CUENTA
            </Button3D>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-cyan hover:text-cyan/80 transition-colors font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
