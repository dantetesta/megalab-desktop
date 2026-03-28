import { create } from 'zustand'

interface ThemeStore {
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: (localStorage.getItem('megalab-theme') as 'dark' | 'light') || 'dark',
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('megalab-theme', next)
    set({ theme: next })
  },
}))
