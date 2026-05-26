import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { SparklesIcon, PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/outline'
import { useParams } from 'react-router-dom'
import { api } from '../../services/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  audio?: string
  timestamp: string
}

export default function VoiceAgent() {
  const { id: projectId } = useParams<{ id?: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const res = await api.post('/coach/voice', {
        message: input,
        projectId,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.text })),
      })

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: res.data.text || '',
        audio: res.data.audio,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])

      if (res.data.audio) {
        setPlayingId(assistantMsg.id)
      }
    } catch (error) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Error al procesar tu mensaje. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }

  const playAudio = (audioUrl: string, msgId: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.play()
      setPlayingId(msgId)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg,rgba(0,217,255,.1),rgba(139,92,246,.08))',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg,#00D9FF,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SparklesIcon style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Agente de Voz</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
          Conversación con IA por voz y texto
        </p>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-3)',
            textAlign: 'center',
          }}>
            <div>
              <SparklesIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.5 }} />
              <p>Inicia una conversación</p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--card-bg)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </p>

                {msg.audio && msg.role === 'assistant' && (
                  <button
                    onClick={() => playAudio(msg.audio!, msg.id)}
                    style={{
                      marginTop: 10,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(0,217,255,0.2)',
                      border: '1px solid rgba(0,217,255,0.3)',
                      color: playingId === msg.id ? 'var(--accent)' : 'var(--text-2)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'all .2s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.3)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,255,0.2)'
                      ;(e.currentTarget as HTMLElement).style.color = playingId === msg.id ? 'var(--accent)' : 'var(--text-2)'
                    }}
                  >
                    {playingId === msg.id ? '⏸ Pausar' : '▶ Escuchar'}
                  </button>
                )}

                <div style={{
                  fontSize: 11,
                  color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : 'var(--text-3)',
                  marginTop: msg.audio ? 8 : 6,
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta... (Enter para enviar)"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            maxHeight: 100,
            transition: 'border-color .15s',
          }}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)' }}
        />
        <motion.button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: input.trim() && !sending ? 'var(--accent)' : 'var(--border)',
            border: 'none',
            color: '#fff',
            cursor: input.trim() && !sending ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {sending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <StopIcon style={{ width: 18, height: 18 }} />
            </motion.div>
          ) : (
            <PaperAirplaneIcon style={{ width: 18, height: 18 }} />
          )}
        </motion.button>
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  )
}
