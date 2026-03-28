import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useThemeStore } from '@/stores/themeStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import { api } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'
import Toast from '@/components/Toast'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Concursos from '@/pages/Concursos'
import Gerador from '@/pages/Gerador'
import MeusJogos from '@/pages/MeusJogos'
import Creditos from '@/pages/Creditos'
import Settings from '@/pages/Settings'
import LotoCore from '@/pages/LotoCore'
import Assistente from '@/pages/Assistente'

function App() {
  const { currentPage } = useAppStore()
  const { theme } = useThemeStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const loadLotteries = useLotteryStore(s => s.load)

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
      <div className={cn(theme, 'w-screen h-screen flex items-center justify-center bg-background')}>
        <img src="/logo.png" alt="LotoLab" className="w-[180px] opacity-80 animate-fade-in" />
      </div>
    )
  }

  if (!onboardingDone) {
    return (
      <div className={cn(theme, 'w-screen h-screen bg-background')}>
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
        case 'creditos': return <Creditos />
        case 'settings': return <Settings />
        default: return <Dashboard />
      }
    } catch (e) {
      console.error(`Erro ao renderizar pagina ${currentPage}:`, e)
      throw e
    }
  }

  return (
    <div className={cn(theme, 'grid grid-cols-[240px_1fr] h-screen w-screen overflow-hidden bg-background')}>
      <Sidebar />
      <main className="overflow-hidden min-w-0 relative bg-background">
        <div key={currentPage} className="page-enter h-full w-full overflow-hidden">
          {renderPage()}
        </div>
      </main>
      <Toast />
    </div>
  )
}

export default App
