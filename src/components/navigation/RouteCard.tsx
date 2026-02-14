import { Clock, TrendingDown, TrendingUp, Route as RouteIcon } from 'lucide-react'
import type { Difficulty } from '@/lib/api/overpass'
import type { Route } from '@/stores/useRoutePlanningStore'

interface RouteCardProps {
  route: Route
}

const difficultyColors: Record<Difficulty, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1e293b',
}

export function RouteCard({ route }: RouteCardProps) {
  return (
    <div className="rounded-lg bg-white/10 overflow-hidden">
      {/* Header */}
      <div className="bg-sky-500/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-sky-300" />
            <span className="text-sm font-medium text-white">Route Found</span>
          </div>
          <div
            className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
            style={{ backgroundColor: difficultyColors[route.maxDifficulty] }}
          >
            {route.maxDifficulty}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1 p-2 border-b border-white/10">
        <div className="text-center rounded bg-white/5 py-2">
          <div className="flex items-center justify-center text-white/50">
            <Clock className="h-3 w-3" />
          </div>
          <div className="text-base font-semibold text-white">{route.estimatedTime}</div>
          <div className="text-[10px] text-white/50">min</div>
        </div>
        <div className="text-center rounded bg-white/5 py-2">
          <div className="flex items-center justify-center text-green-400">
            <TrendingDown className="h-3 w-3" />
          </div>
          <div className="text-base font-semibold text-white">{route.totalElevationDown}</div>
          <div className="text-[10px] text-white/50">m down</div>
        </div>
        <div className="text-center rounded bg-white/5 py-2">
          <div className="flex items-center justify-center text-amber-400">
            <TrendingUp className="h-3 w-3" />
          </div>
          <div className="text-base font-semibold text-white">{route.totalElevationUp}</div>
          <div className="text-[10px] text-white/50">m up</div>
        </div>
      </div>

      {/* Steps */}
      <div className="p-2 space-y-1">
        <div className="text-[10px] font-medium text-white/50 uppercase">Route Steps</div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {route.steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {step.type === 'piste' ? (
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: difficultyColors[step.difficulty || 'blue'] }}
                />
              ) : (
                <div className="h-2.5 w-2.5 rounded bg-amber-500 flex-shrink-0" />
              )}
              <span className="flex-1 truncate text-white/80">{step.name}</span>
              <span className="text-[10px] text-white/40">{step.distance}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* From / To */}
      <div className="bg-white/5 px-2 py-1.5 text-[10px] text-white/50">
        <div className="flex items-center gap-1">
          <span className="font-medium text-white/60">From:</span>
          <span className="truncate">{route.from.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium text-white/60">To:</span>
          <span className="truncate">{route.to.name}</span>
        </div>
      </div>
    </div>
  )
}
