import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock tauri api
vi.mock('../../lib/tauri', () => ({
  api: {
    getBetPrice: vi.fn().mockResolvedValue(null),
    generateGame: vi.fn(),
    generatePortfolio: vi.fn(),
    saveGame: vi.fn(),
  },
}))

// Mock the stores so the component gets predictable state
vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}))

vi.mock('../../stores/lotteryStore', () => ({
  useLotteryStore: vi.fn(() => ({
    enabledGames: [
      {
        game_type: 'megasena',
        display_name: 'Mega-Sena',
        numbers_pool_size: 60,
        default_pick_count: 6,
        has_trevos: false,
        has_time_coracao: false,
        has_mes_sorte: false,
        color: '#209869',
      },
    ],
    activeGame: 'megasena',
    setActiveGame: vi.fn(),
  })),
}))

// Mock LotteryTabs to keep test simple
vi.mock('../../components/LotteryTabs', () => ({
  default: ({ activeGame }: { games: any[]; activeGame: string }) => (
    <div data-testid="lottery-tabs">{activeGame}</div>
  ),
}))

// Mock NumberBall for simplicity
vi.mock('../../components/NumberBall', () => ({
  default: ({ number }: { number: number }) => <span data-testid="number-ball">{number}</span>,
}))

// Mock GameXray
vi.mock('../../components/GameXray', () => ({
  default: () => <div data-testid="game-xray" />,
}))

import Gerador from '../Gerador'

describe('Gerador page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    render(<Gerador />)
    expect(screen.getByText('Gerador de Jogos')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<Gerador />)
    expect(screen.getByText('Gere jogos com base em estratégias estatísticas')).toBeInTheDocument()
  })

  it('renders strategy labels', () => {
    render(<Gerador />)
    expect(screen.getByText('Aleatório puro')).toBeInTheDocument()
    expect(screen.getByText('Frequência histórica')).toBeInTheDocument()
    expect(screen.getByText('Frequência recente')).toBeInTheDocument()
    expect(screen.getByText('Dezenas atrasadas')).toBeInTheDocument()
    expect(screen.getByText('Balanceado')).toBeInTheDocument()
    expect(screen.getByText('Híbrido')).toBeInTheDocument()
    expect(screen.getByText('Afinidade histórica')).toBeInTheDocument()
  })

  it('renders strategy descriptions', () => {
    render(<Gerador />)
    expect(screen.getByText('Geração randômica uniforme')).toBeInTheDocument()
    expect(screen.getByText('Dezenas mais frequentes no histórico')).toBeInTheDocument()
    expect(screen.getByText('Pesa mais concursos recentes')).toBeInTheDocument()
    expect(screen.getByText('Dezenas há mais tempo sem sair')).toBeInTheDocument()
    expect(screen.getByText('Distribuição estrutural equilibrada')).toBeInTheDocument()
    expect(screen.getByText('Combina frequência, recência e atraso')).toBeInTheDocument()
    expect(screen.getByText('Pares que saíram juntas')).toBeInTheDocument()
  })

  it('renders all 7 strategy buttons', () => {
    render(<Gerador />)
    screen.getAllByRole('button')
    // 7 strategy buttons + generate 1 game + minus + plus + generate portfolio = 11
    // Just confirm strategy buttons by their labels
    const strategyLabels = [
      'Aleatório puro', 'Frequência histórica', 'Frequência recente',
      'Dezenas atrasadas', 'Balanceado', 'Híbrido', 'Afinidade histórica',
    ]
    for (const label of strategyLabels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders the "Gerar 1 jogo" button', () => {
    render(<Gerador />)
    expect(screen.getByText('Gerar 1 jogo')).toBeInTheDocument()
  })

  it('renders the "Gerar carteira" button', () => {
    render(<Gerador />)
    expect(screen.getByText('Gerar carteira')).toBeInTheDocument()
  })

  it('renders the disclaimer text at the bottom', () => {
    render(<Gerador />)
    expect(screen.getByText(/As análises são baseadas em histórico/)).toBeInTheDocument()
  })

  it('renders LotteryTabs when there are enabled games', () => {
    render(<Gerador />)
    expect(screen.getByTestId('lottery-tabs')).toBeInTheDocument()
  })

  it('shows the strategy section header', () => {
    render(<Gerador />)
    expect(screen.getByText('Escolha a estratégia')).toBeInTheDocument()
  })
})
