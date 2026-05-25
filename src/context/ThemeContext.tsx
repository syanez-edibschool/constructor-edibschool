import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeCtx { isDark: boolean; toggleTheme: () => void }
const Ctx = createContext<ThemeCtx>({ isDark: true, toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light')

  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.remove('light')
    } else {
      html.classList.add('light')
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <Ctx.Provider value={{ isDark, toggleTheme: () => setIsDark(p => !p) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTheme = () => useContext(Ctx)
