import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { SparklesIcon, StopIcon, MicrophoneIcon } from '@heroicons/react/24/outline'
import { useParams } from 'react-router-dom'
import { api } from '../../services/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  transcript?: string
  audio?: string
  timestamp: string
}

export default function VoiceAgent() {
  const { id: projectId } = useParams<{ id?: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('No se pudo acceder al micrófono')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const sendAudio = async (audioBlob: Blob) => {
    setProcessing(true)
    try {
      const audioBuffer = await audioBlob.arrayBuffer()
      const audioBase64 = Buffer.from(audioBuffer).toString('base64')

      const res = await api.post('/coach/voice', {
        audio: audioBase64,
        projectId,
      })

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        transcript: res.data.transcript,
        timestamp: new Date().toISOString(),
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        audio: res.data.audio,
        transcript: res.data.text,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, userMsg, assistantMsg])

      if (res.data.audio) {
        setPlayingId(assistantMsg.id)
        if (audioRef.current) {
          audioRef.current.src = res.data.audio
          audioRef.current.play()
        }
      }
    } catch (error) {
      console.error('Error:', error)
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        transcript: 'Error al procesar tu audio. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setProcessing(false)
    }
  }

  const playAudio = (audioUrl: string, msgId: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.play()
      setPlayingId(msgId)
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
            <MicrophoneIcon style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Agente de Voz</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
          Conversación por voz en tiempo real
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
              <MicrophoneIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.5 }} />
              <p>Presiona el botón para empezar a hablar</p>
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
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--card-bg)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              }}>
                {msg.transcript && (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                    {msg.transcript}
                  </p>
                )}

                {msg.audio && msg.role === 'assistant' && (
                  <button
                    onClick={() => playAudio(msg.audio!, msg.id)}
                    style={{
                      marginTop: msg.transcript ? 10 : 0,
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: 'rgba(0,217,255,0.2)',
                      border: '1px solid rgba(0,217,255,0.3)',
                      color: playingId === msg.id ? 'var(--accent)' : 'var(--text-2)',
                      cursor: 'pointer',
                      fontSize: 13,
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
                  marginTop: 6,
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mic Button */}
      <div style={{
        padding: '20px 24px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
      }}>
        <motion.button
          onClick={recording ? stopRecording : startRecording}
          disabled={processing}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: recording ? '#EF4444' : 'var(--accent)',
            border: 'none',
            color: '#fff',
            cursor: processing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: processing ? 0.6 : 1,
          }}
        >
          {processing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <StopIcon style={{ width: 24, height: 24 }} />
            </motion.div>
          ) : (
            <MicrophoneIcon style={{ width: 24, height: 24 }} />
          )}
        </motion.button>
        {recording && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-2)',
            fontSize: 13,
          }}>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#EF4444',
              }}
            />
            Grabando...
          </div>
        )}
        {processing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-2)',
            fontSize: 13,
          }}>
            Procesando...
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  )
}
