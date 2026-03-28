import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NumberBall from '../NumberBall'

describe('NumberBall', () => {
  it('renders the number zero-padded to 2 digits', () => {
    render(<NumberBall number={5} />)
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('renders two-digit numbers without extra padding', () => {
    render(<NumberBall number={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('applies medium size by default (40x40)', () => {
    render(<NumberBall number={10} />)
    const el = screen.getByText('10')
    expect(el.style.width).toBe('40px')
    expect(el.style.height).toBe('40px')
  })

  it('applies small size dimensions (32x32)', () => {
    render(<NumberBall number={1} size="sm" />)
    const el = screen.getByText('01')
    expect(el.style.width).toBe('32px')
    expect(el.style.height).toBe('32px')
  })

  it('applies large size dimensions (52x52)', () => {
    render(<NumberBall number={60} size="lg" />)
    const el = screen.getByText('60')
    expect(el.style.width).toBe('52px')
    expect(el.style.height).toBe('52px')
  })

  it('uses primary variant by default (gradient background)', () => {
    render(<NumberBall number={7} />)
    const el = screen.getByText('07')
    expect(el.style.background).toContain('linear-gradient')
    expect(el.style.background).toContain('--ml-primary')
  })

  it('uses gold variant when specified', () => {
    render(<NumberBall number={7} variant="gold" />)
    const el = screen.getByText('07')
    expect(el.style.background).toContain('--ml-secondary')
  })

  it('uses muted variant when specified', () => {
    render(<NumberBall number={7} variant="muted" />)
    const el = screen.getByText('07')
    expect(el.style.background).toBe('var(--ml-surface-highest)')
  })

  it('does not add animation class by default', () => {
    render(<NumberBall number={3} />)
    const el = screen.getByText('03')
    expect(el.className).toBe('')
  })

  it('adds animate-ball-pop class when animated', () => {
    render(<NumberBall number={3} animated />)
    const el = screen.getByText('03')
    expect(el.className).toContain('animate-ball-pop')
  })

  it('sets animation delay when animated with delay', () => {
    render(<NumberBall number={3} animated delay={200} />)
    const el = screen.getByText('03')
    expect(el.style.animationDelay).toBe('200ms')
    expect(el.style.animationFillMode).toBe('both')
  })

  it('does not set animation delay when delay is 0', () => {
    render(<NumberBall number={3} animated delay={0} />)
    const el = screen.getByText('03')
    expect(el.style.animationDelay).toBe('')
  })

  it('renders with border-radius 50% (circle)', () => {
    render(<NumberBall number={15} />)
    const el = screen.getByText('15')
    expect(el.style.borderRadius).toBe('50%')
  })
})
