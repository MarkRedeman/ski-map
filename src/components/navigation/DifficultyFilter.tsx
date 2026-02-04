import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { cn } from '@/lib/utils'

const difficulties: { value: Difficulty; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue (Easy)', color: '#3b82f6' },
  { value: 'red', label: 'Red (Intermediate)', color: '#ef4444' },
  { value: 'black', label: 'Black (Expert)', color: '#1e293b' },
]

export function DifficultyFilter() {
  const { enabledDifficulties, toggleDifficulty } = useNavigationStore()

  return (
    <div className="space-y-1.5">
      {difficulties.map(({ value, label, color }) => {
        const isEnabled = enabledDifficulties.has(value)
        return (
          <button
            key={value}
            onClick={() => toggleDifficulty(value)}
            className={cn(
              'flex w-full items-center gap-3 rounded px-3 py-2 transition-all',
              isEnabled
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
            )}
          >
            <div
              className={cn('h-3.5 w-3.5 rounded-full', !isEnabled && 'opacity-40')}
              style={{ backgroundColor: color }}
            />
            <span className={cn('text-sm font-medium', !isEnabled && 'opacity-60')}>
              {label}
            </span>
            {isEnabled && (
              <span className="ml-auto text-xs text-green-400">✓</span>
            )}
          </button>
        )
      })}
      <p className="text-[11px] text-white/40 mt-2 px-1">
        Filter pistes by difficulty. The route will only use selected difficulties.
      </p>
    </div>
  )
}
