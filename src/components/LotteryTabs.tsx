import { cn } from '@/lib/utils'

interface Props {
  activeGame: string
  onSelect: (gameType: string) => void
  games: { game_type: string; display_name: string; color: string }[]
}

export default function LotteryTabs({ activeGame, onSelect, games }: Props) {
  return (
    <div className="flex gap-0.5 pb-0.5 border-b border-border">
      {games.map((game) => {
        const isActive = activeGame === game.game_type
        return (
          <button
            key={game.game_type}
            onClick={() => onSelect(game.game_type)}
            className={cn(
              'px-4 py-2 rounded-t-[10px] text-[13px] font-semibold min-h-[40px]',
              'border-none cursor-pointer transition-all duration-150',
              isActive
                ? 'border-b-2 hover:opacity-100 lottery-text-on-tint'
                : 'bg-transparent text-muted-foreground border-b-2 border-transparent hover:bg-accent',
            )}
            style={{
              ...(isActive
                ? { background: `color-mix(in srgb, ${game.color} 10%, transparent)`, color: game.color, borderBottomColor: game.color }
                : {}),
            }}
          >
            {game.display_name}
          </button>
        )
      })}
    </div>
  )
}
