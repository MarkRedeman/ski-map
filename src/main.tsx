import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { routeTree } from './routeTree.gen';
import { indexedDBPersister } from './lib/storage/queryPersister';
import './index.css';

// Create a query client with ski-app optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Piste and terrain data is relatively static
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days (for persistence)
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Persistence options - only persist the combined ski data query
const persistOptions = {
  persister: indexedDBPersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[] }) => {
      // Only persist the combined ski data query
      const key = query.queryKey[0];
      return key === 'skiData';
    },
  },
};

// Create the router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <RouterProvider router={router} />
      </PersistQueryClientProvider>
    </React.StrictMode>
  );
}
