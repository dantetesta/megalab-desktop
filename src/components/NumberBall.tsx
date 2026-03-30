import { cn } from '@/lib/utils'

interface Props {
  number: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'gold' | 'muted'
  animated?: boolean
  delay?: number
}

const sizeMap = {
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-[52px] h-[52px] text-[17px]',
}

export default function NumberBall({ number, size = 'md', variant = 'primary', animated = false, delay = 0 }: Props) {
  const anim = animated ? 'animate-ball-pop' : ''
  const style: React.CSSProperties = animated && delay > 0 ? { animationDelay: `${delay}ms`, animationFillMode: 'both' } : {}

  const variantClasses = {
    primary: 'number-ball bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),inset_0_-3px_6px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.25),0_1px_3px_rgba(0,0,0,0.15)]',
    gold: 'number-ball bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[inset_0_3px_6px_rgba(255,255,255,0.25),inset_0_-3px_6px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.2),0_1px_3px_rgba(0,0,0,0.1)]',
    muted: 'number-ball bg-muted text-muted-foreground shadow-[inset_0_1px_3px_rgba(255,255,255,0.1),inset_0_-1px_3px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.1)]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-extrabold',
        'font-[Manrope,monospace] tracking-tight select-none cursor-default transition-transform duration-150',
        sizeMap[size],
        variantClasses[variant],
        anim,
      )}
      style={style}
    >
      {String(number).padStart(2, '0')}
    </span>
  )
}
