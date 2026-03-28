import { Home, Search, Dices, FolderHeart, Award, Sun, Moon, Settings } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useThemeStore } from '../stores/themeStore'

const navItems = [
  { id: 'dashboard', label: 'Início', icon: Home },
  { id: 'concursos', label: 'Concursos', icon: Search },
  { id: 'gerador', label: 'Gerador', icon: Dices },
  { id: 'meus_jogos', label: 'Meus Jogos', icon: FolderHeart },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'creditos', label: 'Créditos', icon: Award },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage } = useAppStore()
  const { theme, toggleTheme } = useThemeStore()

  return (
    <aside style={{ width: 240, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ml-glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid var(--ml-outline-variant)', zIndex: 10 }}>
      {/* Logo only */}
      <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo.png" alt="LotoLab" style={{ height: 132, objectFit: 'contain' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button key={item.id} onClick={() => { console.log(`📍 Navegando para: ${item.id}`); setCurrentPage(item.id) }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: isActive ? 600 : 500, fontFamily: 'inherit',
              textAlign: 'left', minHeight: 42, transition: 'all 0.15s ease',
              background: isActive ? 'var(--ml-surface-high)' : 'transparent',
              color: isActive ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
            }}>
              <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Theme + version */}
      <div style={{ padding: '6px 8px 14px' }}>
        <button onClick={toggleTheme} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit', minHeight: 38,
          background: 'var(--ml-surface-high)', color: 'var(--ml-on-surface-variant)',
        }}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        </button>
        <div style={{ fontSize: 9, padding: '6px 4px 0', color: 'var(--ml-on-surface-variant)', opacity: 0.4, fontWeight: 500 }}>LotoLab v3.8.0</div>
      </div>
    </aside>
  )
}
