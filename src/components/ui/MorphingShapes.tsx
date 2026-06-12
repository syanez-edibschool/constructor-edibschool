import { motion } from 'framer-motion'

const shapes = [
  { color: 'rgba(131,87,246,0.12)', size: 400, x: '-10%', y: '-15%', delay: 0 },
  { color: 'rgba(196,157,255,0.10)', size: 500, x: '65%', y: '50%', delay: 2 },
  { color: 'rgba(236,72,153,0.08)', size: 350, x: '30%', y: '70%', delay: 4 },
  { color: 'rgba(131,87,246,0.07)', size: 300, x: '80%', y: '-5%', delay: 6 },
]

export default function MorphingShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {shapes.map((s, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: s.size,
            height: s.size,
            left: s.x,
            top: s.y,
            background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
            filter: 'blur(60px)',
          }}
          animate={{
            borderRadius: [
              '60% 40% 30% 70% / 60% 30% 70% 40%',
              '30% 60% 70% 40% / 50% 60% 30% 60%',
              '50% 40% 60% 50% / 40% 50% 60% 50%',
              '40% 60% 30% 70% / 60% 40% 70% 30%',
              '60% 40% 30% 70% / 60% 30% 70% 40%',
            ],
            scale: [1, 1.08, 0.95, 1.05, 1],
            opacity: [0.7, 1, 0.8, 1, 0.7],
          }}
          transition={{
            duration: 8,
            delay: s.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
