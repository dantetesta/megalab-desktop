import { useState, useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { useThemeStore } from './stores/themeStore'
import { useLotteryStore } from './stores/lotteryStore'
import { api } from './lib/tauri'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Concursos from './pages/Concursos'
import Gerador from './pages/Gerador'
import MeusJogos from './pages/MeusJogos'
import Creditos from './pages/Creditos'
import Settings from './pages/Settings'

function App() {
  const { currentPage } = useAppStore()
  const { theme } = useThemeStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const loadLotteries = useLotteryStore(s => s.load)

  useEffect(() => {
    console.log('📱 App iniciando, verificando onboarding...')
    api.isOnboardingDone().then(done => {
      console.log(`✅ Onboarding status: ${done}`)
      setOnboardingDone(done)
      if (done) {
        console.log('📚 Carregando loterias...')
        loadLotteries()
      }
    }).catch((e) => {
      console.error('❌ Erro ao verificar onboarding:', e)
      setOnboardingDone(false)
    })
  }, [])

  if (onboardingDone === null) {
    return (
      <div className={theme} style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ml-surface)' }}>
        <img src="/logo.png" alt="LotoLab" style={{ width: 180, opacity: 0.8 }} className="animate-fade-in" />
      </div>
    )
  }

  if (!onboardingDone) {
    return (
      <div className={theme} style={{ width: '100vw', height: '100vh', background: 'var(--ml-surface)' }}>
        <Onboarding onComplete={() => { setOnboardingDone(true); loadLotteries() }} />
        <Toast />
      </div>
    )
  }

  const renderPage = () => {
    console.log(`🎨 Renderizando página: ${currentPage}`)
    try {
      switch (currentPage) {
        case 'dashboard': return <Dashboard />
        case 'concursos': return <Concursos />
        case 'gerador': return <Gerador />
        case 'meus_jogos': return <MeusJogos />
        case 'creditos': return <Creditos />
        case 'settings': return <Settings />
        default: return <Dashboard />
      }
    } catch (e) {
      console.error(`❌ Erro ao renderizar página ${currentPage}:`, e)
      throw e
    }
  }

  return (
    <div className={theme} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--ml-surface)' }}>
      <Sidebar />
      <main style={{ overflow: 'hidden', minWidth: 0, position: 'relative', background: 'var(--ml-surface)' }}>
        <div key={currentPage} className="page-enter" style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
          {renderPage()}
        </div>
      </main>
      <Toast />
    </div>
  )
}

export default App
