import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { Suspense, lazy } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarToggle } from '@/components/map/panels/SidebarToggle';
import { searchSchema } from '@/lib/url/searchSchema';
import { useURLSync } from '@/hooks/useURLSync';

// Lazy load the 3D map for better initial load
const SkiMap3D = lazy(() =>
  import('@/components/map/SkiMap3D').then((m) => ({ default: m.SkiMap3D }))
);

export const Route = createFileRoute('/')({
  component: HomePage,
  validateSearch: zodValidator(searchSchema),
});

function HomePage() {
  // Sync URL search params with stores
  useURLSync();

  return (
    <div className="flex h-full">
      {/* Sidebar with navigation controls */}
      <Sidebar />

      {/* 3D Map View */}
      <div className="flex-1 relative">
        {/* Sidebar toggle button */}
        <SidebarToggle />

        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-amber-50 to-white">
              <div className="text-center">
                <div className="mb-4 text-4xl">🎿</div>
                <div className="text-lg font-medium text-amber-700">Loading 3D terrain...</div>
                <div className="text-sm text-slate-500">Preparing ski area</div>
              </div>
            </div>
          }
        >
          <SkiMap3D />
        </Suspense>
      </div>
    </div>
  );
}
