import { Clock, TrendingDown, TrendingUp, Route as RouteIcon } from 'lucide-react'
import type { Route, Difficulty } from '@/stores/useNavigationStore'
import { cn } from '@/lib/utils'

interface RouteCardProps {
  route: Route
}

const difficultyColors: Record<Difficulty, string> = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  black: 'bg-slate-800',
}

export function RouteCard({ route }: RouteCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4" />
            <span className="font-medium">Route Found</span>
          </div>
          <div className={cn('px-2 py-0.5 rounded text-xs font-medium', difficultyColors[route.maxDifficulty])}>
            {route.maxDifficulty.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-100">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400">
            <Clock className="h-3 w-3" />
          </div>
          <div className="text-lg font-semibold text-slate-800">{route.estimatedTime}</div>
          <div className="text-xs text-slate-400">min</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-500">
            <TrendingDown className="h-3 w-3" />
          </div>
          <div className="text-lg font-semibold text-slate-800">{route.totalElevationDown}</div>
          <div className="text-xs text-slate-400">m down</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-amber-500">
            <TrendingUp className="h-3 w-3" />
          </div>
          <div className="text-lg font-semibold text-slate-800">{route.totalElevationUp}</div>
          <div className="text-xs text-slate-400">m up (lift)</div>
        </div>
      </div>

      {/* Steps */}
      <div className="p-3 space-y-2">
        <div className="text-xs font-medium text-slate-500 uppercase">Route Steps</div>
        {route.steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            {step.type === 'piste' ? (
              <div className={cn('h-3 w-3 rounded-full', difficultyColors[step.difficulty || 'blue'])} />
            ) : (
              <div className="h-3 w-3 rounded bg-amber-500" />
            )}
            <span className="flex-1 truncate">{step.name}</span>
            <span className="text-xs text-slate-400">{step.distance}m</span>
          </div>
        ))}
      </div>

      {/* From / To */}
      <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-medium">From:</span> {route.from.name}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">To:</span> {route.to.name}
        </div>
      </div>
    </div>
  )
}
