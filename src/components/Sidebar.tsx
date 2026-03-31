import { Home, Search, Cpu, Dices, MessageSquare, FolderHeart, Award, Settings, ChevronLeft, FlaskConical, Layers } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import BannerCarousel from '@/components/BannerCarousel'

const navItems = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'lotocore', label: 'Gerador Pro', icon: Cpu },
  { id: 'concursos', label: 'Concursos', icon: Search },
  { id: 'gerador', label: 'Gerador', icon: Dices },
  { id: 'assistente', label: 'Assistente IA', icon: MessageSquare },
  { id: 'meus_jogos', label: 'Meus Jogos', icon: FolderHeart },
  { id: 'superlab',       label: 'SuperLab',        icon: FlaskConical },
  { id: 'desdobramento',  label: 'Desdobramento',   icon: Layers },
  { id: 'settings',       label: 'Configuracoes',   icon: Settings },
  { id: 'creditos', label: 'Creditos', icon: Award },
]

interface SidebarProps {
  onClose: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { currentPage, setCurrentPage } = useAppStore()

  return (
    <aside className="w-[220px] shrink-0 h-screen flex flex-col bg-card border-r border-border animate-slide-in-left">
      {/* Logo + close */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <img src="/logo.png" alt="LotoLab" className="h-[80px] object-contain" />
        <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground">
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                isActive ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="px-2 pb-1">
        <BannerCarousel position="sidebar" className="mb-2" />
      </div>

      <div className="px-3 pb-3 text-[10px] text-muted-foreground/50">
        LotoLab Core Engine v4.2.3
      </div>
    </aside>
  )
}
