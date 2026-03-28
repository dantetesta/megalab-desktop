interface Props {
  activeGame: string
  onSelect: (gameType: string) => void
  games: { game_type: string; display_name: string; color: string }[]
}

export default function LotteryTabs({ activeGame, onSelect, games }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      paddingBottom: 2,
      borderBottom: '1px solid var(--ml-outline-variant)',
    }}>
      {games.map((game) => {
        const isActive = activeGame === game.game_type
        return (
          <button
            key={game.game_type}
            onClick={() => onSelect(game.game_type)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px 10px 0 0',
              fontSize: 13,
              fontWeight: 600,
              minHeight: 40,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: isActive
                ? `color-mix(in srgb, ${game.color} 10%, transparent)`
                : 'transparent',
              color: isActive ? game.color : 'var(--ml-on-surface-variant)',
              borderBottom: isActive ? `2px solid ${game.color}` : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--ml-surface-high)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {game.display_name}
          </button>
        )
      })}
    </div>
  )
}
