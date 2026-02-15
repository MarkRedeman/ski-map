# Ski Map

A 3D ski map app with real terrain visualization, piste/lift filtering, GPS tracking, and ride playback. Default region is Sölden, Austria — configurable at runtime via the Settings panel.

## Features

- **3D Terrain** — React Three Fiber powered map with Mapbox elevation tiles and contour lines
- **Pistes & Lifts** — Color-coded by difficulty, filterable by type
- **GPS Tracking** — Real-time location with accuracy indicator
- **Ride Playback** — Upload GPX files, replay rides on the 3D terrain with speed-colored paths
- **Runtime Settings** — Override region bounds, center, and Mapbox token without redeploying
- **PWA** — Works offline on the slopes

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Mapbox API token for terrain tiles
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

> **Note:** Get your Mapbox token at https://account.mapbox.com/access-tokens/. Can also be set at runtime in Settings.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **Routing**: TanStack Router (file-based, type-safe)
- **Data Fetching**: TanStack Query v5
- **State**: Zustand
- **3D**: React Three Fiber + Drei
- **Styling**: Tailwind CSS v4
- **PWA**: vite-plugin-pwa + Workbox
- **Data Sources**: OpenStreetMap Overpass API, Mapbox Terrain

## Project Structure

```
src/
├── routes/              # TanStack Router file-based routes
├── components/
│   ├── map/             # 3D visualization (R3F)
│   │   ├── panels/      # Map overlay panels (Controls, Info, Compass, etc.)
│   │   └── playback/    # Ride playback (camera follow, player marker)
│   ├── sidebar/         # Sidebar sections (piste list, rides, location)
│   │   └── rides/       # Ride list, upload dropzone
│   └── layout/          # Sidebar shell, settings panel
├── lib/
│   ├── api/             # Overpass API client, piste merging
│   ├── geo/             # Coordinate transforms, elevation grid
│   ├── garmin/          # GPX parsing
│   └── storage/         # IndexedDB query persister
├── stores/              # Zustand state (UI, map, config, playback)
├── hooks/               # TanStack Query hooks
└── config/              # Region config, theme colors
```

---

## License

MIT
