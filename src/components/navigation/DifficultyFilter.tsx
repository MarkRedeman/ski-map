import { useNavigationStore, type Difficulty } from '@/stores/useNavigationStore'
import { cn } from '@/lib/utils'

const difficulties: { value: Difficulty; label: string; color: string; bgColor: string }[] = [
  { value: 'blue', label: 'Blue (Easy)', color: 'bg-blue-500', bgColor: 'bg-blue-50 border-blue-200' },
  { value: 'red', label: 'Red (Intermediate)', color: 'bg-red-500', bgColor: 'bg-red-50 border-red-200' },
  { value: 'black', label: 'Black (Expert)', color: 'bg-slate-800', bgColor: 'bg-slate-50 border-slate-300' },
]

export function DifficultyFilter() {
  const { enabledDifficulties, toggleDifficulty } = useNavigationStore()

  return (
    <div className="space-y-2">
      {difficulties.map(({ value, label, color, bgColor }) => {
        const isEnabled = enabledDifficulties.has(value)
        return (
          <button
            key={value}
            onClick={() => toggleDifficulty(value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2 transition-all',
              isEnabled
                ? bgColor
                : 'border-slate-200 bg-slate-50 opacity-50'
            )}
          >
            <div className={cn('h-4 w-4 rounded-full', color)} />
            <span className={cn('text-sm font-medium', isEnabled ? 'text-slate-700' : 'text-slate-400')}>
              {label}
            </span>
            {isEnabled && (
              <span className="ml-auto text-xs text-green-600">✓</span>
            )}
          </button>
        )
      })}
      <p className="text-xs text-slate-400 mt-2">
        Filter pistes by difficulty. The route will only use selected difficulties.
      </p>
    </div>
  )
}
