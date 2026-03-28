import { Home, Search, Cpu, Dices, MessageSquare, FolderHeart, Award, Sun, Moon, Settings } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'lotocore', label: 'Gerador Pro', icon: Cpu },
  { id: 'concursos', label: 'Concursos', icon: Search },
  { id: 'gerador', label: 'Gerador', icon: Dices },
  { id: 'assistente', label: 'Assistente IA', icon: MessageSquare },
  { id: 'meus_jogos', label: 'Meus Jogos', icon: FolderHeart },
  { id: 'settings', label: 'Configuracoes', icon: Settings },
  { id: 'creditos', label: 'Creditos', icon: Award },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage } = useAppStore()
  const { theme, toggleTheme } = useThemeStore()

  return (
    <aside className="w-60 h-screen flex flex-col z-10 bg-card/90 backdrop-blur-xl border-r border-border">
      {/* Logo */}
      <div className="px-4 pt-3.5 pb-2 flex justify-center">
        <img src="/logo.png" alt="LotoLab" className="h-[132px] object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => { console.log(`Navegando para: ${item.id}`); setCurrentPage(item.id) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border-none cursor-pointer',
                'text-[13px] text-left min-h-[42px] transition-all duration-150 font-inherit',
                isActive
                  ? 'bg-accent font-semibold text-primary'
                  : 'bg-transparent font-medium text-muted-foreground hover:bg-accent/50'
              )}
            >
              <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Theme + version */}
      <div className="px-2 pb-3.5 pt-1.5">
        <Button
          variant="secondary"
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 justify-start text-xs font-medium min-h-[38px]"
        >
          {theme === '' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === '' ? 'Modo claro' : 'Modo escuro'}
        </Button>
        <div className="text-[9px] px-1 pt-1.5 text-muted-foreground/40 font-medium">
          LotoLab v4.0.0
        </div>
      </div>
    </aside>
  )
}
