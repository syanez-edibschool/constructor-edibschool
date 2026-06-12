/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: '#0E0B30',
        surface: '#1a1a2e',
        'surface-2': '#16213e',
        cyan: { DEFAULT: '#8357F6', dark: '#6d3fd4' },
        purple: { DEFAULT: '#C49DFF', dark: '#8357F6' },
        pink: { DEFAULT: '#AF8AE6' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'morph': 'morph 8s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'blur-in': 'blurIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        morph: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '25%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
          '50%': { borderRadius: '50% 40% 60% 50% / 40% 50% 60% 50%' },
          '75%': { borderRadius: '40% 60% 30% 70% / 60% 40% 70% 30%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        blurIn: {
          from: { opacity: '0', filter: 'blur(10px)', transform: 'scale(0.95)' },
          to: { opacity: '1', filter: 'blur(0)', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: { '25': '25px' },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(131,87,246,0.4), 0 0 40px rgba(131,87,246,0.2)',
        'neon-purple': '0 0 20px rgba(196,157,255,0.4), 0 0 40px rgba(196,157,255,0.2)',
        'card': '0 8px 32px rgba(0,0,0,0.4)',
        'card-hover': '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(131,87,246,0.15)',
      },
    },
  },
  plugins: [],
}
