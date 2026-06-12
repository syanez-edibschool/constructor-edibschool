import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon, CheckCircleIcon,
  ChevronDownIcon, TrophyIcon, ArrowLeftIcon,
  UserGroupIcon, MagnifyingGlassIcon, MicrophoneIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../services/api'
import { supabase } from '../../services/supabase'
import { exportToPDF, exportToWord } from '../../services/exportContent'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ContentMixItem  { type: string; percentage: number; engagement_rate: number; is_winner?: boolean; why_it_works?: string }
interface HookItem        { hook: string; count?: number; type?: string; why?: string }
interface CTAItem         { cta: string; usage_pct?: number; context?: string }

export interface CloneAnalysis {
  handle: string
  platform: string
  executive_summary: {
    estimated_followers: string
    engagement_rate: string
    posts_per_week: number
    estimated_revenue_monthly: string
    content_volume?: string
    key_success_factors: string[]
  }
  content_mix: ContentMixItem[]
  your_content_mix: Array<{ type: string; percentage: number; reasoning: string }>
  schedule: {
    posts_per_week: number
    best_hours: string[]
    best_days: string[]
    your_recommendation: {
      posts_per_week: number
      schedule: Record<string, string>
      reasoning: string
    }
  }
  aesthetics: {
    color_palette: string[]
    typography_style: string
    photo_style: string[]
    your_recommendation: { palette: string[]; style: string; differentiation: string }
  }
  copy_analysis: {
    top_hooks: HookItem[]
    top_ctas: CTAItem[]
    tone_of_voice: string
    your_hooks: HookItem[]
    your_ctas: CTAItem[]
    key_differentiation: string
  }
  landing_page: {
    headline: string
    subheadline: string
    social_proof: string
    cta_text: string
    form_fields: number
    guarantee: string
    your_improvements: string[]
  }
  score: {
    overall: number
    market_difference: number
    adaptability: number
    timeline_months: number
    summary: string
  }
  implementation_plan: {
    week1: { title: string; hours: number; tasks: string[] }
    week2: { title: string; hours: number; tasks: string[] }
    week3: { title: string; hours: number; tasks: string[] }
    month1_results: {
      engagement_improvement: string
      followers_growth: string
      leads_per_week: string
      estimated_revenue: string
    }
  }
}

type Step = 'loading' | 'select-count' | 'input-handles' | 'analyzing' | 'comparison' | 'winner-detail'

interface CompetitorInput { handle: string; platform: string; url: string }
interface AnalysisProgress { handle: string; status: 'pending' | 'analyzing' | 'done' | 'error' }

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Twitter/X']

// ─── Internal UI components ────────────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}/100</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          style={{ height: '100%', background: color, borderRadius: 999 }}
        />
      </div>
    </div>
  )
}

function Section({ title, children, accent = 'var(--accent)' }: { title: string; children: React.ReactNode; accent?: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'var(--card-bg)', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: accent }}>{title}</span>
        <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RecommendationBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(131,87,246,.07)', border: '1px solid rgba(131,87,246,.2)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
        Recomendación para ti
      </p>
      {children}
    </div>
  )
}

// ─── Full detail view (sections A–F) ──────────────────────────────────────────
function CloneDetail({ analysis: a, onBack, projectId }: { analysis: CloneAnalysis; onBack: () => void; projectId: string }) {
  const navigate = useNavigate()
  const score = a.score?.overall ?? 0
  const scoreColor = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'

  const buildAnalysisText = () => [
    `CLONE THE WINNER — ANÁLISIS DE ${a.handle}`,
    `Plataforma: ${a.platform}\n`,
    `RESUMEN EJECUTIVO`,
    `Followers estimados: ${a.executive_summary?.estimated_followers}`,
    `Engagement: ${a.executive_summary?.engagement_rate}`,
    `Posts/semana: ${a.executive_summary?.posts_per_week}`,
    `Ingresos estimados: ${a.executive_summary?.estimated_revenue_monthly}`,
    `\nFACTORES CLAVE DE ÉXITO:`,
    ...(a.executive_summary?.key_success_factors?.map(f => `• ${f}`) || []),
    `\nSCORE DE CLONACIÓN: ${score}/100`,
    a.score?.summary,
  ].join('\n')

  const downloadAnalysis = () => {
    const blob = new Blob([buildAnalysisText()], { type: 'text/plain' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `clone-${a.handle?.replace('@', '')}.txt` }).click()
  }
  const exportPDF = () => exportToPDF(`Clone ${a.handle || ''}`.trim(), buildAnalysisText())
  const exportWord = () => exportToWord(`Clone ${a.handle || ''}`.trim(), buildAnalysisText())

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
          >
            <ArrowLeftIcon style={{ width: 13, height: 13 }} /> Competidores
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <TrophyIcon style={{ width: 18, height: 18, color: '#F59E0B' }} />
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>
                Análisis: {a.handle}
              </h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.platform}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadAnalysis} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}>
            <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> TXT
          </button>
          <button onClick={exportPDF} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}>
            <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> PDF
          </button>
          <button onClick={exportWord} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10 }}>
            <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> Word
          </button>
          <button
            onClick={() => navigate(`/proyecto/${projectId}/tools/estrategia90d`, { state: { cloneGanadorData: a } })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 10, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            Usar en Estrategia 90D <ArrowRightIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Executive summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Followers est.',  value: a.executive_summary?.estimated_followers,      color: '#8357F6' },
          { label: 'Engagement',      value: a.executive_summary?.engagement_rate,           color: '#10B981' },
          { label: 'Posts / semana',  value: String(a.executive_summary?.posts_per_week),    color: '#F59E0B' },
          { label: 'Revenue est.',    value: a.executive_summary?.estimated_revenue_monthly, color: '#C49DFF' },
        ].map(c => (
          <div key={c.label} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-bg)', border: `1px solid ${c.color}25` }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>{c.label}</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Key success factors */}
      {a.executive_summary?.key_success_factors?.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Factores clave de éxito</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.executive_summary.key_success_factors.map((f, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(131,87,246,.1)', color: 'var(--accent)', border: '1px solid rgba(131,87,246,.2)' }}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* A. Content mix */}
      <Section title="A. Mix de Contenido" accent="#8357F6">
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>Su estrategia actual:</p>
          {a.content_mix?.map((item, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{item.type}</span>
                  {item.is_winner && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'rgba(16,185,129,.15)', color: '#10B981', fontWeight: 700 }}>GANADOR ✓</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-3)' }}>{item.percentage}%</span>
                  <span style={{ color: item.engagement_rate >= 8 ? '#10B981' : item.engagement_rate >= 5 ? '#F59E0B' : 'var(--text-3)', fontWeight: 600 }}>
                    {item.engagement_rate}% eng
                  </span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  style={{ height: '100%', background: item.is_winner ? '#10B981' : 'var(--accent)', borderRadius: 999 }}
                />
              </div>
              {item.why_it_works && <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{item.why_it_works}</p>}
            </div>
          ))}
        </div>
        {a.your_content_mix?.length > 0 && (
          <RecommendationBox>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Tu mix adaptado:</p>
            {a.your_content_mix.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-2)' }}>{item.type}</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{item.percentage}%</span>
              </div>
            ))}
          </RecommendationBox>
        )}
      </Section>

      {/* B. Schedule */}
      <Section title="B. Frecuencia y Horarios" accent="#F59E0B">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>Su frecuencia</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>{a.schedule?.posts_per_week} posts/semana</p>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>Mejores horarios</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{a.schedule?.best_hours?.join(' · ')}</p>
          </div>
        </div>
        {a.schedule?.your_recommendation && (
          <RecommendationBox>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Tu frecuencia recomendada:</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>{a.schedule.your_recommendation.posts_per_week} posts/semana</span>
            </div>
            {Object.entries(a.schedule.your_recommendation.schedule || {}).map(([day, type]) => (
              <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{day}</span>
                <span style={{ color: 'var(--text-2)' }}>{type}</span>
              </div>
            ))}
            {a.schedule.your_recommendation.reasoning && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{a.schedule.your_recommendation.reasoning}</p>
            )}
          </RecommendationBox>
        )}
      </Section>

      {/* C. Aesthetics */}
      <Section title="C. Estética (Colores, Estilo)" accent="#AF8AE6">
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>Su paleta:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {a.aesthetics?.color_palette?.map((c, i) => (
              <span key={i} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 999, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>{c}</span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}><strong>Tipografía:</strong> {a.aesthetics?.typography_style}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {a.aesthetics?.photo_style?.map((s, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(236,72,153,.1)', color: '#AF8AE6', border: '1px solid rgba(236,72,153,.2)' }}>{s}</span>
            ))}
          </div>
        </div>
        {a.aesthetics?.your_recommendation && (
          <RecommendationBox>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Tu paleta adaptada:</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {a.aesthetics.your_recommendation.palette?.map((c, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(131,87,246,.1)', color: 'var(--accent)', border: '1px solid rgba(131,87,246,.2)' }}>{c}</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>{a.aesthetics.your_recommendation.style}</p>
            <p style={{ fontSize: 11, color: 'var(--accent)' }}>Diferenciador: {a.aesthetics.your_recommendation.differentiation}</p>
          </RecommendationBox>
        )}
      </Section>

      {/* D. Copy analysis */}
      <Section title="D. Análisis de Copy" accent="#C49DFF">
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C49DFF', marginBottom: 8 }}>Hooks que funcionan</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {a.copy_analysis?.top_hooks?.slice(0, 5).map((h, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: h.why ? 5 : 0 }}>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: 'rgba(196,157,255,.15)', color: '#C49DFF', fontWeight: 700, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {h.type || 'Hook'}
                </span>
                {h.count && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>{h.count} posts</span>}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text)', fontStyle: 'italic', fontWeight: 500, marginBottom: h.why ? 4 : 0 }}>"{h.hook}"</p>
              {h.why && <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>↳ {h.why}</p>}
            </div>
          ))}
        </div>

        {a.copy_analysis?.tone_of_voice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(196,157,255,.08)', border: '1px solid rgba(196,157,255,.2)', marginBottom: 16 }}>
            <MicrophoneIcon style={{ width: 18, height: 18, color: '#C49DFF', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C49DFF', marginBottom: 2 }}>Tono de voz</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' }}>{a.copy_analysis.tone_of_voice}</p>
            </div>
          </div>
        )}

        {a.copy_analysis?.top_ctas?.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C49DFF', marginBottom: 8 }}>Estructura ganadora (CTAs)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 6, marginBottom: 16 }}>
              {a.copy_analysis.top_ctas.slice(0, 4).map((c, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1 }}>{c.cta}</span>
                  {c.usage_pct && <span style={{ fontSize: 11, fontWeight: 700, color: '#C49DFF', flexShrink: 0 }}>{c.usage_pct}%</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {(a.copy_analysis?.your_hooks?.length > 0 || a.copy_analysis?.key_differentiation) && (
          <RecommendationBox>
            {a.copy_analysis.key_differentiation && (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Recomendación estratégica</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>{a.copy_analysis.key_differentiation}</p>
              </>
            )}
            {a.copy_analysis.your_hooks?.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Tus hooks adaptados</p>
                {a.copy_analysis.your_hooks.slice(0, 3).map((h, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(131,87,246,.1)' }}>
                    <p style={{ fontSize: 12, color: 'var(--accent)', fontStyle: 'italic', marginBottom: 2 }}>"{h.hook}"</p>
                    {h.why && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>↳ {h.why}</p>}
                  </div>
                ))}
              </>
            )}
          </RecommendationBox>
        )}
      </Section>

      {/* E. Landing page */}
      {a.landing_page && (
        <Section title="E. Landing Page Breakdown" accent="#0891b2">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Headline',    value: a.landing_page.headline },
              { label: 'Subheadline', value: a.landing_page.subheadline },
              { label: 'CTA Button',  value: a.landing_page.cta_text },
              { label: 'Social proof',value: a.landing_page.social_proof },
              { label: 'Form fields', value: `${a.landing_page.form_fields} campos` },
              { label: 'Garantía',    value: a.landing_page.guarantee },
            ].map(f => f.value ? (
              <div key={f.label} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 3 }}>{f.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>{f.value}</p>
              </div>
            ) : null)}
          </div>
          {a.landing_page.your_improvements?.length > 0 && (
            <RecommendationBox>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Mejoras para tu landing:</p>
              {a.landing_page.your_improvements.map((imp, i) => (
                <p key={i} style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>→ {imp}</p>
              ))}
            </RecommendationBox>
          )}
        </Section>
      )}

      {/* F. Score */}
      <Section title="F. Score de Clonación" accent={scoreColor}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor }}>{score}</span>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Viabilidad: {score}/100</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.score?.summary}</p>
          </div>
        </div>
        <ScoreBar label="Diferencia de mercado" value={a.score?.market_difference ?? 0} color="#8357F6" />
        <ScoreBar label="Adaptabilidad a tu caso" value={a.score?.adaptability ?? 0} color="#10B981" />
        <ScoreBar label="Timeline realista" value={Math.max(0, 100 - (a.score?.timeline_months ?? 3) * 10)} color="#F59E0B" />
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
          Tiempo estimado para resultados: {a.score?.timeline_months} meses
        </p>
      </Section>

    </div>
  )
}

// ─── Comparison card for one competitor ───────────────────────────────────────
function CompetitorCard({ analysis, rank, onSelect, isWinner }: {
  analysis: CloneAnalysis; rank: number; onSelect: () => void; isWinner: boolean
}) {
  const score = analysis.score?.overall ?? 0
  const scoreColor = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      style={{
        borderRadius: 16, border: `1px solid ${isWinner ? 'var(--border-h)' : 'var(--border)'}`,
        background: isWinner ? 'var(--accent-d)' : 'var(--card-bg)',
        padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: isWinner ? 'var(--accent)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: isWinner ? '#000' : 'var(--text-3)' }}>#{rank + 1}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{analysis.handle}</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{analysis.platform}</p>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor }}>{score}</span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { label: 'Followers', value: analysis.executive_summary?.estimated_followers, color: '#8357F6' },
          { label: 'Engagement', value: analysis.executive_summary?.engagement_rate, color: '#10B981' },
          { label: 'Posts/sem', value: String(analysis.executive_summary?.posts_per_week), color: '#F59E0B' },
          { label: 'Revenue', value: analysis.executive_summary?.estimated_revenue_monthly, color: '#C49DFF' },
        ].map(m => (
          <div key={m.label} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 1 }}>{m.label}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Success factors */}
      {analysis.executive_summary?.key_success_factors?.slice(0, 2).map((f, i) => (
        <p key={i} style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>• {f}</p>
      ))}

      {/* CTA */}
      <button
        onClick={onSelect}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: isWinner ? 'var(--accent)' : 'var(--surface)',
          color: isWinner ? '#000' : 'var(--text-2)',
          border: `1px solid ${isWinner ? 'transparent' : 'var(--border)'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all .15s',
        }}
      >
        {isWinner ? <><TrophyIcon style={{ width: 15, height: 15 }} /> Ver análisis completo</> : 'Elegir como ganador'}
      </button>
    </motion.div>
  )
}

// ─── Comparative Table ───────────────────────────────────────────────────────
function ComparativeTable({ analyses, selectedIdx, onSelect }: {
  analyses: CloneAnalysis[]
  selectedIdx: number | null
  onSelect: (idx: number) => void
}) {
  const colors = ['#8357F6', '#C49DFF', '#F59E0B', '#AF8AE6', '#10B981']

  // Identificar el "mejor" por cada métrica numérica para resaltarlo
  const scoreMax = Math.max(...analyses.map(a => a.score?.overall ?? 0))
  const engagementMax = Math.max(...analyses.map(a => parseFloat(String(a.executive_summary?.engagement_rate || '0').replace('%', '')) || 0))
  const postsMax = Math.max(...analyses.map(a => a.executive_summary?.posts_per_week || 0))

  const rows: Array<{ label: string; key: string; getValue: (a: CloneAnalysis) => string | number; getRaw?: (a: CloneAnalysis) => number; format?: (v: any) => string }> = [
    { label: 'Followers estimados', key: 'followers',    getValue: a => a.executive_summary?.estimated_followers || '—' },
    { label: 'Engagement rate',     key: 'engagement',   getValue: a => a.executive_summary?.engagement_rate || '—',
      getRaw: a => parseFloat(String(a.executive_summary?.engagement_rate || '0').replace('%', '')) || 0 },
    { label: 'Posts / semana',      key: 'posts',        getValue: a => a.executive_summary?.posts_per_week ?? '—',
      getRaw: a => a.executive_summary?.posts_per_week || 0 },
    { label: 'Revenue mensual est.',key: 'revenue',      getValue: a => a.executive_summary?.estimated_revenue_monthly || '—' },
    { label: 'Tono de voz',         key: 'tone',         getValue: a => a.copy_analysis?.tone_of_voice || '—' },
    { label: 'Score viabilidad',    key: 'score',        getValue: a => `${a.score?.overall ?? 0}/100`,
      getRaw: a => a.score?.overall ?? 0 },
    { label: 'Adaptabilidad',       key: 'adaptability', getValue: a => `${a.score?.adaptability ?? 0}/100`,
      getRaw: a => a.score?.adaptability ?? 0 },
    { label: 'Tiempo replicar',     key: 'timeline',     getValue: a => `${a.score?.timeline_months ?? '—'} meses` },
  ]

  const winnerIdx = analyses.reduce((best, a, i) => (a.score?.overall ?? 0) > (analyses[best]?.score?.overall ?? 0) ? i : best, 0)

  return (
    <div style={{
      borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20,
      background: 'var(--surface)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          Tabla comparativa
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Los valores destacados en cyan indican el mejor de cada métrica
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 200 + analyses.length * 180 }}>
          <thead>
            <tr style={{ background: 'var(--card-bg)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', minWidth: 180 }}>
                Métrica
              </th>
              {analyses.map((a, i) => {
                const color = colors[i % colors.length]
                const isBestOverall = i === winnerIdx
                const isSelected = selectedIdx === i
                return (
                  <th key={i} style={{
                    padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)',
                    borderLeft: '1px solid var(--border)', minWidth: 170,
                    background: isSelected ? `${color}10` : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.handle || `#${i + 1}`}</span>
                      {isBestOverall && (
                        <span title="Mejor score viabilidad" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: '#10B98120', color: '#10B981', fontWeight: 700 }}>
                          TOP
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{a.platform}</p>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              // Determinar el mejor valor numérico (si tiene getRaw)
              let bestIdx = -1
              if (row.getRaw) {
                const max = row.key === 'score' ? scoreMax : row.key === 'engagement' ? engagementMax : row.key === 'posts' ? postsMax : Math.max(...analyses.map(row.getRaw))
                bestIdx = analyses.findIndex(a => row.getRaw!(a) === max && max > 0)
              }
              return (
                <tr key={row.key} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--card-bg)' }}>
                  <td style={{ padding: '11px 16px', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>
                    {row.label}
                  </td>
                  {analyses.map((a, i) => {
                    const isBest = bestIdx === i
                    const isSelected = selectedIdx === i
                    return (
                      <td key={i} style={{
                        padding: '11px 16px', borderLeft: '1px solid var(--border)',
                        background: isSelected ? `${colors[i % colors.length]}08` : 'transparent',
                        color: isBest ? 'var(--accent)' : 'var(--text)',
                        fontWeight: isBest ? 700 : 500,
                        fontSize: 12,
                      }}>
                        {row.getValue(a)}
                        {isBest && <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.7 }}>★</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* Factor clave de éxito (texto multi-línea) */}
            <tr style={{ background: 'var(--card-bg)' }}>
              <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontWeight: 600, fontSize: 11, verticalAlign: 'top' }}>
                Factor de éxito #1
              </td>
              {analyses.map((a, i) => (
                <td key={i} style={{ padding: '12px 16px', borderLeft: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 11, lineHeight: 1.45, verticalAlign: 'top' }}>
                  {a.executive_summary?.key_success_factors?.[0] || '—'}
                </td>
              ))}
            </tr>

            {/* Botón de acción por columna */}
            <tr>
              <td style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}></td>
              {analyses.map((a, i) => {
                const color = colors[i % colors.length]
                const isSelected = selectedIdx === i
                return (
                  <td key={i} style={{ padding: '14px 16px', borderLeft: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => onSelect(i)}
                      style={{
                        width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: isSelected ? color : 'transparent',
                        color: isSelected ? '#000' : color,
                        border: `1px solid ${color}`,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}>
                      {isSelected ? <><TrophyIcon style={{ width: 12, height: 12 }} /> Ganador</> : 'Elegir'}
                    </button>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main standalone component ─────────────────────────────────────────────────
export default function CloneTheWinner({ projectId }: { projectId: string }) {
  const [step, setStep]               = useState<Step>('loading')
  const [count, setCount]             = useState(2)
  const [inputs, setInputs]           = useState<CompetitorInput[]>([
    { handle: '', platform: 'Instagram', url: '' },
    { handle: '', platform: 'Instagram', url: '' },
  ])
  const [progress, setProgress]       = useState<AnalysisProgress[]>([])
  const [analyses, setAnalyses]       = useState<CloneAnalysis[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // Load existing data on mount
  useEffect(() => {
    api.get(`/projects/${projectId}/tools/clone-winner`)
      .then(({ data }) => {
        if (data.exists && Array.isArray(data.result?.competitors) && data.result.competitors.length > 0) {
          setAnalyses(data.result.competitors)
          const idx = typeof data.result.selectedWinner === 'number' ? data.result.selectedWinner : null
          setSelectedIdx(idx)
          setStep(idx !== null ? 'winner-detail' : 'comparison')
        } else {
          setStep('select-count')
        }
      })
      .catch(() => setStep('select-count'))
  }, [projectId])

  // Sync inputs array length when count changes
  const handleCountSelect = (n: number) => {
    setCount(n)
    setInputs(Array.from({ length: n }, (_, i) => inputs[i] || { handle: '', platform: 'Instagram', url: '' }))
    setStep('input-handles')
  }

  const setInput = (i: number, field: keyof CompetitorInput, val: string) => {
    setInputs(p => p.map((inp, j) => j === i ? { ...inp, [field]: val } : inp))
  }

  const allHandlesFilled = inputs.every(inp => inp.handle.trim())

  const startAnalysis = async () => {
    const prog: AnalysisProgress[] = inputs.map(inp => ({ handle: inp.handle, status: 'pending' }))
    setProgress(prog)
    setStep('analyzing')

    const results: CloneAnalysis[] = []
    for (let i = 0; i < inputs.length; i++) {
      setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'analyzing' } : x))
      try {
        const { data } = await api.post(`/projects/${projectId}/tools/clone-winner`, {
          toolAnswers: { handle: inputs[i].handle, platform: inputs[i].platform, url: inputs[i].url },
        })
        results.push((data.result ?? data) as CloneAnalysis)
        setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'done' } : x))
      } catch {
        setProgress(p => p.map((x, j) => j === i ? { ...x, status: 'error' } : x))
      }
    }

    // Save combined result directly to supabase
    await supabase.from('project_tools').upsert({
      project_id: projectId,
      tool_id: 'clone-winner',
      result_json: { competitors: results, selectedWinner: null },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,tool_id' })

    setAnalyses(results)
    setStep('comparison')
  }

  const selectWinner = async (idx: number) => {
    setSelectedIdx(idx)
    await supabase.from('project_tools').upsert({
      project_id: projectId,
      tool_id: 'clone-winner',
      result_json: { competitors: analyses, selectedWinner: idx },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,tool_id' })
    setStep('winner-detail')
  }

  const resetFlow = () => {
    setStep('select-count')
    setCount(2)
    setInputs([
      { handle: '', platform: 'Instagram', url: '' },
      { handle: '', platform: 'Instagram', url: '' },
    ])
    setProgress([])
    setAnalyses([])
    setSelectedIdx(null)
  }

  // ── Loading ──
  if (step === 'loading') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Cargando análisis...</p>
      </div>
    )
  }

  // ── Select count ──
  if (step === 'select-count') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 580, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-d)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MagnifyingGlassIcon style={{ width: 26, height: 26, color: 'var(--accent)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Clone the Winner</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Analiza a los líderes de tu nicho con IA y clona su estrategia adaptada a tu negocio.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          ¿Cuántos competidores quieres analizar? (mínimo 2 para comparar)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(70px,1fr))', gap: 10, marginBottom: 32 }}>
          {[2, 3, 4, 5].map(n => (
            <motion.button
              key={n}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: .97 }}
              onClick={() => handleCountSelect(n)}
              style={{
                padding: '20px 0', borderRadius: 14, fontSize: 22, fontWeight: 800,
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                color: 'var(--text)', cursor: 'pointer', flexDirection: 'column',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all .15s',
              }}
            >
              {n}
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>
                {n === 1 ? 'competidor' : 'competidores'}
              </span>
            </motion.button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <UserGroupIcon style={{ width: 18, height: 18, color: 'var(--text-3)', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Analizar <strong style={{ color: 'var(--text-2)' }}>2–3 competidores</strong> permite comparar estrategias y elegir la más adaptable a tu situación.
          </p>
        </div>
      </motion.div>
    )
  }

  // ── Input handles ──
  if (step === 'input-handles') {
    return (
      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 580, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => setStep('select-count')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
          >
            <ArrowLeftIcon style={{ width: 13 }} /> Atrás
          </button>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>
            Datos de los competidores
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {inputs.map((inp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
                Competidor #{i + 1}
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>Handle / Nombre *</label>
                  <input
                    value={inp.handle}
                    onChange={e => setInput(i, 'handle', e.target.value)}
                    placeholder="@mariafitnessover40"
                    className="input-form"
                    style={{ padding: '9px 12px', fontSize: 13 }}
                  />
                </div>
                <div style={{ width: 140 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>Plataforma *</label>
                  <select
                    value={inp.platform}
                    onChange={e => setInput(i, 'platform', e.target.value)}
                    className="input-form"
                    style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>URL de su web (opcional)</label>
                <input
                  value={inp.url}
                  onChange={e => setInput(i, 'url', e.target.value)}
                  placeholder="mariafitnessover40.com"
                  className="input-form"
                  style={{ padding: '9px 12px', fontSize: 13 }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <button
          onClick={startAnalysis}
          disabled={!allHandlesFilled}
          className="btn-primary"
          style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <MagnifyingGlassIcon style={{ width: 18, height: 18 }} />
          {allHandlesFilled ? `Analizar ${inputs.length} competidor${inputs.length > 1 ? 'es' : ''}` : 'Completa todos los handles'}
        </button>
      </motion.div>
    )
  }

  // ── Analyzing ──
  if (step === 'analyzing') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Analizando con IA</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Esto puede tardar unos segundos por competidor...</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {progress.map((p, i) => {
            const statusColor = p.status === 'done' ? '#10B981' : p.status === 'error' ? '#EF4444' : p.status === 'analyzing' ? 'var(--accent)' : 'var(--text-3)'
            const statusLabel = p.status === 'done' ? 'Listo ✓' : p.status === 'error' ? 'Error ✗' : p.status === 'analyzing' ? 'Analizando...' : 'En espera'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'var(--card-bg)', border: `1px solid ${statusColor}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{p.handle}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.status === 'analyzing' && (
                    <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    )
  }

  // ── Comparison ──
  if (step === 'comparison') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Comparativa de competidores
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {analyses.length} competidor{analyses.length > 1 ? 'es' : ''} analizados · Elige al ganador para ver el análisis completo
            </p>
          </div>
          <button
            onClick={resetFlow}
            style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
          >
            + Nuevo análisis
          </button>
        </div>

        {/* Tabla comparativa visual */}
        <ComparativeTable
          analyses={analyses}
          selectedIdx={selectedIdx}
          onSelect={selectWinner}
        />

        {/* Tarjetas detalladas (opcional, vista expandida) */}
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Vista detallada
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(analyses.length, 3)}, 1fr)`, gap: 14 }}>
            {analyses.map((a, i) => (
              <CompetitorCard
                key={i}
                analysis={a}
                rank={i}
                isWinner={selectedIdx === i}
                onSelect={() => selectWinner(i)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Winner detail ──
  if (step === 'winner-detail' && selectedIdx !== null && analyses[selectedIdx]) {
    return (
      <CloneDetail
        analysis={analyses[selectedIdx]}
        onBack={() => setStep('comparison')}
        projectId={projectId}
      />
    )
  }

  return null
}
