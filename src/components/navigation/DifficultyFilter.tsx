import { type Difficulty } from '@/lib/api/overpass'
import { useDifficultyFilter } from '@/hooks/useDifficultyFilter'
import { cn } from '@/lib/utils'

const difficulties: { value: Difficulty; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'red', label: 'Red', color: '#ef4444' },
  { value: 'black', label: 'Black', color: '#1e293b' },
]

export function DifficultyFilter() {
  const { enabledDifficulties, toggleDifficulty } = useDifficultyFilter()

  return (
    <div className="flex flex-wrap gap-1.5">
      {difficulties.map(({ value, label, color }) => {
        const isEnabled = enabledDifficulties.has(value)
        return (
          <button
            key={value}
            onClick={() => toggleDifficulty(value)}
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-all',
              isEnabled
                ? 'bg-white/15 text-white/90'
                : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
            )}
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color, opacity: isEnabled ? 1 : 0.4 }}
            />
            <span>{label}</span>
            {isEnabled && (
              <span className="text-green-400 text-[10px]">✓</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
