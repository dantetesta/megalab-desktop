import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import { api } from '@/lib/tauri'
import Sidebar from '@/components/Sidebar'
import Toast from '@/components/Toast'
import { Menu } from 'lucide-react'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Concursos from '@/pages/Concursos'
import Gerador from '@/pages/Gerador'
import MeusJogos from '@/pages/MeusJogos'
import Creditos from '@/pages/Creditos'
import Settings from '@/pages/Settings'
import LotoCore from '@/pages/LotoCore'
import Assistente from '@/pages/Assistente'
import SuperLab from '@/pages/SuperLab'
import Desdobramento from '@/pages/Desdobramento'

function App() {
  const { currentPage } = useAppStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const loadLotteries = useLotteryStore(s => s.load)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem('lotolab-sidebar') !== 'closed'
  })

  const toggleSidebar = () => {
    const next = !sidebarOpen
    setSidebarOpen(next)
    localStorage.setItem('lotolab-sidebar', next ? 'open' : 'closed')
  }

  useEffect(() => {
    console.log('App iniciando, verificando onboarding...')
    api.isOnboardingDone().then(done => {
      console.log(`Onboarding status: ${done}`)
      setOnboardingDone(done)
      if (done) {
        console.log('Carregando loterias...')
        loadLotteries()
      }
    }).catch((e) => {
      console.error('Erro ao verificar onboarding:', e)
      setOnboardingDone(false)
    })
  }, [])

  if (onboardingDone === null) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <img src="/logo.png" alt="LotoLab" className="w-[180px] opacity-80 animate-fade-in" />
      </div>
    )
  }

  if (!onboardingDone) {
    return (
      <div className="w-screen h-screen bg-background">
        <Onboarding onComplete={() => { setOnboardingDone(true); loadLotteries() }} />
        <Toast />
      </div>
    )
  }

  const renderPage = () => {
    console.log(`Renderizando pagina: ${currentPage}`)
    try {
      switch (currentPage) {
        case 'dashboard': return <Dashboard />
        case 'concursos': return <Concursos />
        case 'lotocore': return <LotoCore />
        case 'gerador': return <Gerador />
        case 'assistente': return <Assistente />
        case 'meus_jogos': return <MeusJogos />
        case 'superlab':      return <SuperLab />
        case 'desdobramento': return <Desdobramento />
        case 'creditos':      return <Creditos />
        case 'settings': return <Settings />
        default: return <Dashboard />
      }
    } catch (e) {
      console.error(`Erro ao renderizar pagina ${currentPage}:`, e)
      throw e
    }
  }

  const needsPadding = !['assistente', 'lotocore', 'concursos'].includes(currentPage)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      {sidebarOpen && <Sidebar onClose={toggleSidebar} />}

      {/* Main content */}
      <div className="flex-1 relative min-w-0 h-full overflow-hidden">
        {/* Toggle button */}
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="fixed top-3 left-3 z-30 w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
          >
            <Menu size={18} />
          </button>
        )}

        <div key={currentPage} className={`absolute inset-0 overflow-y-auto${needsPadding ? ' p-8' : ''}`}>
          {renderPage()}
        </div>
      </div>
      <Toast />
    </div>
  )
}

export default App
