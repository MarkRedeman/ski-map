import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="text-lg text-amber-600">Loading...</div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <PWAInstallPrompt />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
    </div>
  );
}
