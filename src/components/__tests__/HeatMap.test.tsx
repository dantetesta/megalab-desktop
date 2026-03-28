import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeatMap from '../HeatMap'

function makeData(count: number, freqFn: (i: number) => number = () => 10) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    frequency: freqFn(i),
    delay: i,
  }))
}

describe('HeatMap', () => {
  it('returns null when data is empty', () => {
    const { container } = render(<HeatMap data={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders one cell per data item', () => {
    const data = makeData(5)
    render(<HeatMap data={data} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i).padStart(2, '0'))).toBeInTheDocument()
    }
  })

  it('shows frequency labels as Nx', () => {
    const data = [
      { number: 1, frequency: 42, delay: 0 },
      { number: 2, frequency: 10, delay: 3 },
    ]
    render(<HeatMap data={data} />)
    expect(screen.getByText('42x')).toBeInTheDocument()
    expect(screen.getByText('10x')).toBeInTheDocument()
  })

  it('renders the legend with Frio and Quente labels', () => {
    const data = makeData(5, i => (i + 1) * 10)
    render(<HeatMap data={data} />)
    expect(screen.getByText('Frio')).toBeInTheDocument()
    expect(screen.getByText('Quente')).toBeInTheDocument()
  })

  it('shows the min/max frequency range in legend', () => {
    const data = [
      { number: 1, frequency: 5, delay: 0 },
      { number: 2, frequency: 50, delay: 1 },
    ]
    render(<HeatMap data={data} />)
    // Check min and max labels exist (cells + legend)
    expect(screen.getAllByText(/5x/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/50x/).length).toBeGreaterThan(0)
  })

  it('highlights numbers passed in highlighted prop', () => {
    const data = makeData(5, () => 20)
    render(<HeatMap data={data} highlighted={[3]} />)
    const cell3 = screen.getByText('03').closest('div')!
    expect(cell3.style.transform).toBe('scale(1.12)')
    const cell1 = screen.getByText('01').closest('div')!
    expect(cell1.style.transform).toBe('scale(1)')
  })

  it('renders correct number of cells', () => {
    const data = makeData(60)
    render(<HeatMap data={data} />)
    // All 60 numbers should render
    for (let i = 1; i <= 60; i++) {
      expect(screen.getByText(String(i).padStart(2, '0'))).toBeInTheDocument()
    }
  })

  it('cells are clickable (have cursor pointer)', () => {
    const data = makeData(3, () => 15)
    render(<HeatMap data={data} />)
    const cell = screen.getByText('01').closest('div')!
    expect(cell.style.cursor).toBe('pointer')
  })
})
