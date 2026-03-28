interface Props {
  number: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'gold' | 'muted'
  animated?: boolean
  delay?: number
}

export default function NumberBall({ number, size = 'md', variant = 'primary', animated = false, delay = 0 }: Props) {
  const sizes = {
    sm: { w: 32, h: 32, fs: 11, fw: 700 },
    md: { w: 40, h: 40, fs: 14, fw: 700 },
    lg: { w: 52, h: 52, fs: 17, fw: 800 },
  }

  const s = sizes[size]
  const anim = animated ? 'animate-ball-pop' : ''
  const style: React.CSSProperties = animated && delay > 0 ? { animationDelay: `${delay}ms`, animationFillMode: 'both' } : {}

  const baseStyle: React.CSSProperties = {
    ...style,
    width: s.w, height: s.h, borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Manrope', monospace", fontSize: s.fs, fontWeight: s.fw,
    letterSpacing: '-0.3px', userSelect: 'none', cursor: 'default',
    transition: 'transform 0.15s ease',
  }

  if (variant === 'primary') {
    return (
      <span className={anim}
        style={{
          ...baseStyle,
          background: 'linear-gradient(145deg, var(--ml-primary) 0%, var(--ml-primary-container) 100%)',
          color: 'var(--ml-on-primary)',
          boxShadow: `
            inset 0 3px 6px rgba(255,255,255,0.35),
            inset 0 -3px 6px rgba(0,0,0,0.2),
            0 3px 8px rgba(0,0,0,0.25),
            0 1px 3px rgba(0,0,0,0.15)
          `,
        }}>
        {String(number).padStart(2, '0')}
      </span>
    )
  }
  if (variant === 'gold') {
    return (
      <span className={anim}
        style={{
          ...baseStyle,
          background: 'linear-gradient(145deg, var(--ml-secondary), var(--ml-secondary-dim))',
          color: '#fff',
          boxShadow: `
            inset 0 3px 6px rgba(255,255,255,0.25),
            inset 0 -3px 6px rgba(0,0,0,0.2),
            0 3px 8px rgba(0,0,0,0.2),
            0 1px 3px rgba(0,0,0,0.1)
          `,
        }}>
        {String(number).padStart(2, '0')}
      </span>
    )
  }
  // Muted
  return (
    <span className={anim}
      style={{
        ...baseStyle,
        background: 'var(--ml-surface-highest)',
        color: 'var(--ml-on-surface-variant)',
        boxShadow: `
          inset 0 1px 3px rgba(255,255,255,0.1),
          inset 0 -1px 3px rgba(0,0,0,0.08),
          0 1px 3px rgba(0,0,0,0.1)
        `,
      }}>
      {String(number).padStart(2, '0')}
    </span>
  )
}
