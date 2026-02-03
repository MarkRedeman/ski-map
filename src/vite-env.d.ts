/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'react-dom/client' {
  import { Container } from 'react-dom'
  
  export function createRoot(container: Container): {
    render(element: React.ReactNode): void
    unmount(): void
  }
}
