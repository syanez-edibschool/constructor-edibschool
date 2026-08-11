import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { useRegistrarActividad } from './hooks/useActividad'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Questions from './pages/Questions'
import ReviewNiche from './pages/ReviewNiche'
import Tools from './pages/Tools'
import Download from './pages/Download'
import Admin from './pages/Admin'
import CoachWidget from './components/AICoach/CoachWidget'
import UpdateBanner from './components/ui/UpdateBanner'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  // Marca actividad real (last_sign_in_at no sirve: no se actualiza al
  // refrescar la sesión). Limitado a un registro cada 5 min.
  useRegistrarActividad(user?.id)
  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(26,26,46,0.95)',
            color: '#fff',
            border: '1px solid rgba(131,87,246,0.2)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#8357F6', secondary: '#0E0B30' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#0E0B30' },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        {/* Registro libre deshabilitado: el acceso es solo por invitación (WordPress + magic link) */}
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        {/* Panel del equipo de soporte. Requiere sesión aquí y rol equipo/admin
            en el backend: /api/admin-alumnos rechaza a quien no lo tenga. */}
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/proyecto/:id/questions" element={<ProtectedRoute><Questions /></ProtectedRoute>} />
        <Route path="/proyecto/:id/review-niche" element={<ProtectedRoute><ReviewNiche /></ProtectedRoute>} />
        <Route path="/proyecto/:id/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
        <Route path="/proyecto/:id/tools/:toolId" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
        <Route path="/proyecto/:id/download" element={<ProtectedRoute><Download /></ProtectedRoute>} />
      </Routes>
      <CoachWidget />
      <UpdateBanner />
    </BrowserRouter>
    </ThemeProvider>
  )
}
