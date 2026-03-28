import { create } from 'zustand'

interface ThemeStore {
  theme: '' | 'light'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: (localStorage.getItem('megalab-theme') === 'light' ? 'light' : '') as '' | 'light',
  toggleTheme: () => {
    const next = get().theme === '' ? 'light' : ''
    localStorage.setItem('megalab-theme', next || 'dark')
    set({ theme: next })
  },
}))
