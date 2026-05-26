import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MicrophoneIcon, XMarkIcon, MinusIcon,
  StopIcon, SpeakerWaveIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
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

// ─── Speech API declarations ────────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

function getProjectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/proyecto\/([^/]+)/)
  return m ? m[1] : null
}

const STORAGE_KEY = (projectId: string | null) => `voice_history_${projectId || 'global'}`

// ─── Message bubble ─────────────────────────────────────────────────────────────
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
          background: 'linear-gradient(135deg,#06B6D4,#8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MicrophoneIcon style={{ width: 14, height: 14, color: '#fff' }} />
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: '9px 12px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? '#06B6D4' : 'var(--card-bg)',
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

// ─── Listening indicator ─────────────────────────────────────────────────────
function ListeningIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            animate={{ scaleY: [0.4, 1, 0.4] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
            style={{ width: 3, height: 16, borderRadius: 999, background: '#06B6D4', transformOrigin: 'center' }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#06B6D4', fontWeight: 600 }}>Escuchando...</span>
    </div>
  )
}

// ─── Speaking indicator ─────────────────────────────────────────────────────
function SpeakingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            animate={{ scaleY: [0.3, 1, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
            style={{ width: 3, height: 18, borderRadius: 999, background: '#8B5CF6', transformOrigin: 'center' }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>Hablando...</span>
    </div>
  )
}

// ─── Main widget ─────────────────────────────────────────────────────────────
export default function VoiceWidget() {
  const { user } = useAuth()
  const location = useLocation()
  const projectId = getProjectIdFromPath(location.pathname)

  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const [speechRate, setSpeechRate] = useState(1)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  const [noSpeechSupport, setNoSpeechSupport] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef(window.speechSynthesis)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check speech support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setNoSpeechSupport(true)
      setMode('text')
    }
  }, [])

  // Load history
  useEffect(() => {
    const key = STORAGE_KEY(projectId)
    try {
      const stored = localStorage.getItem(key)
      if (stored) setMessages(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [projectId])

  const saveHistory = useCallback((msgs: Message[]) => {
    const key = STORAGE_KEY(projectId)
    try { localStorage.setItem(key, JSON.stringify(msgs.slice(-30))) } catch { /* ignore */ }
  }, [projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, listening])

  const speak = (text: string) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = speechRate
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    synthRef.current.speak(utterance)
  }

  const stopSpeaking = () => {
    synthRef.current?.cancel()
    setSpeaking(false)
  }

  const sendMessage = async (text: string) => {
    const content = text.trim()
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
      const reply = res.data.reply ?? res.data.message ?? ''
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: res.data.timestamp || new Date().toISOString(),
      }
      const final = [...newMsgs, assistantMsg]
      setMessages(final)
      saveHistory(final)
      if (!open) setHasNewMsg(true)

      if (mode === 'voice') speak(reply)
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
    }
  }

  const startListening = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    stopSpeaking()
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'es-ES'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      sendMessage(transcript)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

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
            onClick={() => { setOpen(true); setMinimized(false); setHasNewMsg(false) }}
            style={{
              position: 'fixed', bottom: 24, left: 24, zIndex: 9000,
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg,#06B6D4,#8B5CF6)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(6,182,212,.4), 0 0 0 0 rgba(6,182,212,.3)',
            }}
            title="Agente de Voz"
          >
            <MicrophoneIcon style={{ width: 24, height: 24, color: '#fff' }} />
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
              position: 'fixed', bottom: 24, left: 24, zIndex: 9000,
              width: 360, borderRadius: 20,
              background: 'var(--surface-s)',
              border: '1px solid var(--border-h)',
              boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(6,182,212,.1)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              maxHeight: minimized ? 60 : 520,
              transition: 'max-height 0.25s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px', flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.08))',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#06B6D4,#8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MicrophoneIcon style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>Agente de Voz</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    {noSpeechSupport ? 'Modo texto' : 'Voz + texto'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Mode toggle */}
                {!noSpeechSupport && (
                  <button
                    onClick={() => { setMode(m => m === 'voice' ? 'text' : 'voice'); stopSpeaking() }}
                    className="btn-icon"
                    style={{ width: 28, height: 28 }}
                    title={mode === 'voice' ? 'Cambiar a texto' : 'Cambiar a voz'}
                  >
                    {mode === 'voice'
                      ? <SpeakerWaveIcon style={{ width: 14, height: 14 }} />
                      : <MicrophoneIcon style={{ width: 14, height: 14 }} />}
                  </button>
                )}
                <button onClick={() => setMinimized(m => !m)} className="btn-icon" style={{ width: 28, height: 28 }}>
                  <MinusIcon style={{ width: 14, height: 14 }} />
                </button>
                <button onClick={() => { setOpen(false); stopSpeaking(); stopListening() }} className="btn-icon" style={{ width: 28, height: 28 }}>
                  <XMarkIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', minHeight: 0 }}>
                  {messages.length === 0 && !listening && !sending && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>
                      <MicrophoneIcon style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.4 }} />
                      <p style={{ fontSize: 12 }}>
                        {noSpeechSupport
                          ? 'Escribe tu pregunta abajo'
                          : 'Presiona el micrófono para hablar'}
                      </p>
                    </div>
                  )}
                  {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                  {listening && <ListeningIndicator />}
                  {speaking && <SpeakingIndicator />}
                  {sending && !listening && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                          style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4' }}
                        />
                      ))}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Controls */}
                <div style={{ padding: '10px 14px 14px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
                  {/* Speed selector (voice mode) */}
                  {mode === 'voice' && !noSpeechSupport && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>Velocidad:</span>
                      {[{ v: 0.8, label: 'Lento' }, { v: 1, label: 'Normal' }, { v: 1.4, label: 'Rápido' }].map(s => (
                        <button
                          key={s.v}
                          onClick={() => setSpeechRate(s.v)}
                          style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            background: speechRate === s.v ? '#06B6D4' : 'var(--surface)',
                            color: speechRate === s.v ? '#000' : 'var(--text-3)',
                            border: `1px solid ${speechRate === s.v ? 'transparent' : 'var(--border)'}`,
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                      {speaking && (
                        <button onClick={stopSpeaking} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <StopIcon style={{ width: 12, height: 12 }} /> Detener
                        </button>
                      )}
                    </div>
                  )}

                  {/* Voice button */}
                  {mode === 'voice' && !noSpeechSupport && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <motion.button
                        onClick={listening ? stopListening : startListening}
                        disabled={sending}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        style={{
                          width: 56, height: 56, borderRadius: '50%',
                          background: listening ? '#EF4444' : 'linear-gradient(135deg,#06B6D4,#8B5CF6)',
                          border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: listening ? '0 0 0 8px rgba(239,68,68,.15)' : '0 4px 16px rgba(6,182,212,.3)',
                          opacity: sending ? 0.6 : 1,
                          transition: 'box-shadow .2s',
                        }}
                        title={listening ? 'Detener' : 'Hablar'}
                      >
                        {listening
                          ? <StopIcon style={{ width: 24, height: 24, color: '#fff' }} />
                          : <MicrophoneIcon style={{ width: 24, height: 24, color: '#fff' }} />}
                      </motion.button>
                    </div>
                  )}

                  {/* Text input (always shown in text mode, or as fallback) */}
                  {(mode === 'text' || noSpeechSupport) && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe tu pregunta..."
                        rows={1}
                        style={{
                          flex: 1, resize: 'none', padding: '8px 10px', borderRadius: 10,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                          maxHeight: 80, transition: 'border-color .15s',
                        }}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = '#06B6D4' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)' }}
                      />
                      <motion.button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || sending}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: input.trim() && !sending ? '#06B6D4' : 'var(--border)',
                          border: 'none', color: '#fff', cursor: input.trim() && !sending ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <PaperAirplaneIcon style={{ width: 16, height: 16 }} />
                      </motion.button>
                    </div>
                  )}

                  {noSpeechSupport && (
                    <p style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 6 }}>
                      Tu navegador no soporta reconocimiento de voz
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
