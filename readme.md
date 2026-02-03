# 🎿 Sölden Ski Navigator

A 3D ski navigation app for the Sölden ski area in Austria. Find your way through the slopes, filter by difficulty, and never get separated from your friends again!

## Features

### Phase 1: Navigation MVP ✅
- **3D Terrain Visualization** - React Three Fiber powered 3D map of Sölden
- **Piste Display** - All pistes color-coded by difficulty (blue/red/black)
- **Lift Display** - Ski lifts with station markers
- **Difficulty Filter** - Toggle pistes by difficulty level
- **Route Planning** - Dijkstra-based pathfinding between locations
- **GPS Tracking** - Real-time location with accuracy indicator
- **PWA Support** - Works offline on the slopes!

### Phase 2: Run Tracking ✅
- Upload Garmin/GPX data
- Visualize past runs on 3D terrain
- Run statistics and comparisons
- Speed-colored path visualization

### Phase 3: Video Generation ✅
- Remotion-powered video creation
- Animated run replays with stats overlay
- Client-side video export (WebCodecs)
- Shareable highlight videos

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

> **Note:** Get your Mapbox token at https://account.mapbox.com/access-tokens/

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
├── routes/           # TanStack Router file-based routes
├── components/
│   ├── map/          # 3D visualization (R3F)
│   ├── navigation/   # Search, filters, route cards
│   └── layout/       # Header, sidebar
├── lib/
│   ├── api/          # Overpass API client
│   ├── routing/      # Graph + pathfinding
│   └── geo/          # Coordinate utilities
├── stores/           # Zustand state
└── hooks/            # TanStack Query hooks
```

---

## 🍺 Après-Ski Shot Counter

*Tracking development "mistakes" made while building this app*

| Mistake Type | Shots | Description |
|-------------|-------|-------------|
| TypeScript errors | 1 | Vite ImportMeta types not recognized |
| Runtime errors | 0 | Crashes & bugs |
| Git failures | 0 | Commit/push issues |
| Agent failures | 0 | Parallel task failures |
| User-reported bugs | 0 | Bugs caught by user |

### 🥃 Total Shots: 1

*Last updated: Phase 3 completion*

> "Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live." - But also, drink responsibly! 🍻

---

## License

MIT
