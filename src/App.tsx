import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Questions from './pages/Questions'
import ReviewNiche from './pages/ReviewNiche'
import Tools from './pages/Tools'
import Download from './pages/Download'
import VoiceAgent from './components/VoiceAgent/VoiceAgent'
import CoachWidget from './components/AICoach/CoachWidget'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
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
            border: '1px solid rgba(0,217,255,0.2)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#00D9FF', secondary: '#0a0a0f' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#0a0a0f' },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/proyecto/:id/questions" element={<ProtectedRoute><Questions /></ProtectedRoute>} />
        <Route path="/proyecto/:id/review-niche" element={<ProtectedRoute><ReviewNiche /></ProtectedRoute>} />
        <Route path="/proyecto/:id/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
        <Route path="/proyecto/:id/tools/:toolId" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
        <Route path="/proyecto/:id/voice" element={<ProtectedRoute><VoiceAgent /></ProtectedRoute>} />
        <Route path="/voice" element={<ProtectedRoute><VoiceAgent /></ProtectedRoute>} />
        <Route path="/proyecto/:id/download" element={<ProtectedRoute><Download /></ProtectedRoute>} />
      </Routes>
      <CoachWidget />
    </BrowserRouter>
    </ThemeProvider>
  )
}
