import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SparklesIcon, XMarkIcon, PaperAirplaneIcon, MinusIcon } from '@heroicons/react/24/outline'
import { useLocation } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

function getProjectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/proyecto\/([^/]+)/)
  return m ? m[1] : null
}

const STORAGE_KEY = (projectId: string | null) =>
  `coach_history_${projectId || 'global'}`

function cleanCoachReply(text: string): string {
  // If the reply looks like JSON (starts with { or [), extract any readable text from it
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      // Try common text fields
      for (const key of ['message', 'reply', 'response', 'text', 'content', 'suggestion']) {
        if (typeof parsed[key] === 'string') return parsed[key]
      }
      // Flatten any string values
      const values = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 20)
      if (values.length > 0) return values.join(' ')
    } catch { /* not valid JSON, return as-is */ }
  }
  // Strip any JSON-like fragments that appear mid-text
  return text.replace(/```json[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim()
}

// ─── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 10,
      }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 8, marginTop: 2,
          background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SparklesIcon style={{ width: 14, height: 14, color: '#fff' }} />
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: '9px 12px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'var(--accent)' : 'var(--card-bg)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontSize: 13,
        lineHeight: 1.6,
        color: isUser ? '#fff' : 'var(--text)',
        whiteSpace: 'pre-line',
      }}>
        {msg.content}
        <div style={{ fontSize: 9, color: isUser ? 'rgba(255,255,255,.55)' : 'var(--text-3)', marginTop: 4, textAlign: 'right' }}>
          {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <SparklesIcon style={{ width: 14, height: 14, color: '#fff' }} />
      </div>
      <div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Quick prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  '¿Qué debería hacer ahora mismo?',
  '¿Mi estrategia es viable?',
  '¿Cómo consigo mi primer cliente?',
  '¿Cuál es mi siguiente paso?',
]

// ─── Main widget ───────────────────────────────────────────────────────────────
export default function CoachWidget() {
  const { user } = useAuth()
  const location = useLocation()
  const projectId = getProjectIdFromPath(location.pathname)

  const [open, setOpen]         = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const userName = user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'amigo'

  // Load history from localStorage
  useEffect(() => {
    const key = STORAGE_KEY(projectId)
    try {
      const stored = localStorage.getItem(key)
      if (stored) setMessages(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [projectId])

  // Save history to localStorage
  const saveHistory = useCallback((msgs: Message[]) => {
    const key = STORAGE_KEY(projectId)
    try { localStorage.setItem(key, JSON.stringify(msgs.slice(-40))) } catch { /* ignore */ }
  }, [projectId])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Fetch proactive suggestion when opened for the first time
  useEffect(() => {
    if (!open || messages.length > 0 || !projectId || initialLoading) return
    setInitialLoading(true)
    api.get(`/coach/suggestion/${projectId}`)
      .then(res => {
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: cleanCoachReply(res.data.suggestion),
          timestamp: res.data.timestamp || new Date().toISOString(),
        }
        setMessages([msg])
        saveHistory([msg])
      })
      .catch(() => {
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `¡Hola, ${userName}! Soy tu AI Coach. Estoy aquí para ayudarte a construir tu agencia. ¿En qué puedo apoyarte hoy?`,
          timestamp: new Date().toISOString(),
        }
        setMessages([msg])
        saveHistory([msg])
      })
      .finally(() => setInitialLoading(false))
  }, [open, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome message if no project context
  useEffect(() => {
    if (!open || messages.length > 0 || projectId || initialLoading) return
    const msg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `¡Hola, ${userName}! Soy tu AI Coach. Estoy aquí para ayudarte a construir tu agencia de IA. Pregúntame lo que sea.`,
      timestamp: new Date().toISOString(),
    }
    setMessages([msg])
    saveHistory([msg])
  }, [open, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || sending) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date().toISOString() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setSending(true)

    try {
      const res = await api.post('/coach/message', {
        message: content,
        projectId,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
      })
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanCoachReply(res.data.reply ?? res.data.message ?? ''),
        timestamp: res.data.timestamp || new Date().toISOString(),
      }
      const final = [...newMsgs, assistantMsg]
      setMessages(final)
      saveHistory(final)
      if (!open) setHasNewMsg(true)
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Hubo un error al procesar tu mensaje. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }
      const final = [...newMsgs, errMsg]
      setMessages(final)
      saveHistory(final)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    setMinimized(false)
    setHasNewMsg(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Don't show on auth pages
  if (!user) return null

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={handleOpen}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,217,255,.4), 0 0 0 0 rgba(0,217,255,.3)',
              animation: hasNewMsg ? 'coachPulse 1.5s infinite' : 'none',
            }}
            title="AI Coach"
          >
            <SparklesIcon style={{ width: 24, height: 24, color: '#fff' }} />
            {hasNewMsg && (
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 12, height: 12, borderRadius: '50%',
                background: '#EF4444', border: '2px solid var(--bg)',
              }} />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.34, 1.2, 0.64, 1] }}
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
              width: 360, borderRadius: 20,
              background: 'var(--surface-s)',
              border: '1px solid var(--border-h)',
              boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(0,217,255,.1)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              maxHeight: minimized ? 60 : 540,
              transition: 'max-height 0.25s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px', flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(0,217,255,.1),rgba(139,92,246,.08))',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <SparklesIcon style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>AI Coach</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Activo · Conoce tu proyecto</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setMinimized(m => !m)}
                  className="btn-icon"
                  style={{ width: 28, height: 28 }}
                  title={minimized ? 'Expandir' : 'Minimizar'}
                >
                  <MinusIcon style={{ width: 14, height: 14 }} />
                </button>
                <button onClick={() => setOpen(false)} className="btn-icon" style={{ width: 28, height: 28 }}>
                  <XMarkIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', minHeight: 0 }}>
                  {initialLoading && messages.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <SparklesIcon style={{ width: 24, height: 24, color: 'var(--accent)' }} />
                      </motion.div>
                    </div>
                  ) : (
                    messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                  )}
                  {sending && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>

                {/* Quick prompts (only when few messages) */}
                {messages.length <= 1 && !sending && (
                  <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QUICK_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 999,
                          background: 'var(--card-bg)', border: '1px solid var(--border)',
                          color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap',
                          transition: 'all .12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div style={{
                  padding: '10px 12px', flexShrink: 0,
                  borderTop: '1px solid var(--border)',
                  display: 'flex', gap: 8, alignItems: 'flex-end',
                }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta... (Enter para enviar)"
                    rows={1}
                    style={{
                      flex: 1, resize: 'none', fontSize: 13, padding: '8px 12px',
                      borderRadius: 12, border: '1px solid var(--border)',
                      background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none', maxHeight: 90, overflowY: 'auto',
                      lineHeight: 1.5, fontFamily: 'inherit',
                      transition: 'border-color .15s',
                    }}
                    onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                    onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)' }}
                  />
                  <motion.button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: input.trim() && !sending ? 'var(--accent)' : 'var(--border)',
                      border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background .15s',
                    }}
                  >
                    <PaperAirplaneIcon style={{ width: 16, height: 16, color: '#fff' }} />
                  </motion.button>
                </div>

                {/* Clear history */}
                <div style={{ padding: '4px 14px 10px', textAlign: 'center' }}>
                  <button
                    onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY(projectId)) }}
                    style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Limpiar conversación
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes coachPulse {
          0% { box-shadow: 0 8px 32px rgba(0,217,255,.4), 0 0 0 0 rgba(0,217,255,.4); }
          70% { box-shadow: 0 8px 32px rgba(0,217,255,.4), 0 0 0 12px rgba(0,217,255,0); }
          100% { box-shadow: 0 8px 32px rgba(0,217,255,.4), 0 0 0 0 rgba(0,217,255,0); }
        }
      `}</style>
    </>
  )
}
