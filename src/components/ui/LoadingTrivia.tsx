import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TRIVIA_QUESTIONS } from '../../data/trivia'

export default function LoadingTrivia() {
  const [selected, setSelected] = useState<number | null>(null)
  const [showFact, setShowFact] = useState(false)
  const [question] = useState(() => TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)])

  useEffect(() => {
    if (selected !== null) {
      const timer = setTimeout(() => setShowFact(true), 500)
      return () => clearTimeout(timer)
    }
  }, [selected])

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Spinner */}
      <div className="flex justify-center mb-8">
        <div className="relative" style={{ width: 56, height: 56 }}>
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: `2px solid transparent`,
              borderTopColor: '#00D9FF',
              borderRightColor: '#8B5CF6',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Trivia */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🧠</span>
          <p className="text-xs uppercase tracking-widest text-white/50 font-600">Trivia while loading</p>
        </div>

        <h3 className="text-lg font-bold text-white leading-tight">
          {question.question}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((option, i) => (
            <motion.button
              key={i}
              onClick={() => setSelected(i)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-3 rounded-lg font-600 text-sm transition-all duration-300 ${
                selected === i
                  ? i === question.correct
                    ? 'bg-green-500/30 border border-green-400 text-green-300'
                    : 'bg-red-500/30 border border-red-400 text-red-300'
                  : selected === null
                    ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                    : 'bg-white/5 border border-white/10 text-white/50'
              }`}
              disabled={selected !== null}
            >
              {option}
            </motion.button>
          ))}
        </div>

        {showFact && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-400/30"
          >
            <p className="text-xs text-cyan-300">
              <span className="font-bold">💡 Dato:</span> {question.fact}
            </p>
          </motion.div>
        )}

        <div className="pt-4 border-t border-white/10">
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-xs text-white/40 text-center"
          >
            Generando tu estrategia...
          </motion.p>
        </div>
      </motion.div>
    </div>
  )
}
