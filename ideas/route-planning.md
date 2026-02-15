# Route Planning — Feature Proposal

## User Story

> After a day of skiing me and my friends often talk about what routes we want to take the next day. Normally we would use the paper maps given at the ski services, but it can be tricky to see how some slopes go hence why this application is already helping us.
>
> As a next step though I'd like us to be able to create a list of lifts and pistes to take the next day. Generally we likely choose a single starting point, say "Giggijochbahn" which marks the start of our day. We will then pick lifts or pistes next to the destination of that lift. We often also pick one or more "break locations" in between skiing.
>
> After completing a plan we should have a (chronological) list of lifts and pistes that we'd take the next day. This list should be shareable (e.g. we could share the list via a URL state) so that we can quickly share it among our whatsapp group.

---

## Design Decisions

| Decision                 | Choice                                        | Rationale                                                                                                                                     |
| ------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Step types               | Lift, Piste, or Break (peak/village/restaurant) | Breaks mark rest points. Restaurant entities are now available as break-stop sources.                                                         |
| Adding steps             | Dedicated planning mode                       | Guided: sidebar shows nearby entities filtered by proximity to last step's endpoint. Both sidebar list and 3D map highlighting.               |
| Connectivity validation  | Warn but allow                                | Warning icon on steps >500m from previous step's endpoint, but user isn't blocked.                                                            |
| Multiple plans           | One plan at a time                            | Simple. Can clear and start over.                                                                                                             |
| Map visualization        | Highlight planned entities                    | Planned pistes/lifts get distinct visual treatment on the 3D map.                                                                             |
| Sharing                  | Encode plan in URL params                     | No backend needed. Works offline. Plans are typically 10-20 steps.                                                                            |
| Reordering               | Drag-and-drop                                 | Steps can be reordered in the sidebar plan list.                                                                                              |
| First step constraint    | Any entity                                    | No restriction on what type the first step is.                                                                                                |
| Camera behavior          | Auto-pan to last step endpoint                | After adding a step, camera moves to show area around the endpoint.                                                                           |
| Proximity radius         | 500m                                          | Entities within 500m of last step's endpoint shown as suggestions.                                                                            |
| Proximity endpoint logic | All segment endpoints                         | Check first/last coordinate of every segment in `coordinates[][]`, not just `startPoint`/`endPoint` (which only reflect the longest segment). |
| Break stop selection     | Pick from existing peaks/places/restaurants   | Restaurants are now available as entities. Custom-named breaks deferred.                                                                      |
| URL param format         | Compact encoded string                        | `?plan=L:123,P:456,K:789,L:012`                                                                                                               |

---

## Data Model

### Route Plan Step

```ts
type PlanStepType = 'lift' | 'piste' | 'break';

interface PlanStep {
  type: PlanStepType;
  id: string; // Entity ID (e.g. "lift-12345", "piste-67890", "peak-111", "village-222", "restaurant-333")
}
```

### Route Plan State (Zustand store: `useRoutePlanStore`)

```ts
interface RoutePlanState {
  steps: PlanStep[];
  planningMode: boolean;

  enterPlanningMode: () => void;
  exitPlanningMode: () => void;
  addStep: (step: PlanStep) => void;
  removeStep: (index: number) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  clearPlan: () => void;
}
```

### Endpoint Resolution

```ts
function getStepEndpoint(step: PlanStep, skiData: ProcessedSkiData): [number, number] | null;
```

| Step type | Endpoint                                              |
| --------- | ----------------------------------------------------- |
| `lift`    | Last station coordinates (top of lift)                |
| `piste`   | Last coordinate of the last segment (bottom of piste) |
| `break`   | The peak/village `[lat, lon]` coordinates               |

For the **first step** (empty plan), no proximity filtering — user sees all entities.

**Coordinate order note:** Raw piste/lift coordinates are `[lon, lat]` (GeoJSON), but `startPoint`/`endPoint` and `stations[].coordinates` are `[lat, lon, elevation]`. The proximity engine normalizes to `[lat, lon]` internally.

### Proximity Matching

**Piste connection points:** First and last coordinate of every segment in `coordinates[][]`.

**Lift connection points:** All station coordinates in `stations[]`.

**Peak/Village connection points:** Their `[lat, lon]` position.

```ts
function getNearbyEntities(
  endpoint: [number, number],
  skiData: ProcessedSkiData,
  radiusMeters: number = 500
): { pistes: Piste[]; lifts: Lift[]; peaks: Peak[]; villages: Village[] };
```

### Disconnection Warning

For each step (except the first), compute distance from previous step's endpoint to current step's nearest connection point. If >500m, show warning with distance.

---

## URL Encoding

### Format

```
?plan=L:123456,P:789012,K:345678,V:901234,L:678901
```

| Type          | Prefix | Suffix                     | Example                         |
| ------------- | ------ | -------------------------- | ------------------------------- |
| Lift          | `L`    | OSM way ID (numeric part)  | `L:123456`                      |
| Piste         | `P`    | Piste merged ID string     | `P:blue-Rettenbachjoch-r1-4567` |
| Break (peak)  | `K`    | OSM node ID (numeric part) | `K:345678`                      |
| Break (village) | `V`    | OSM node ID (numeric part) | `V:901234`                      |

Steps are comma-separated. Order preserved.

### Integration

- Add `plan` to Zod schema in `searchSchema.ts` as `z.string().optional()`
- `parsePlan()` / `buildPlan()` convert between `PlanStep[]` and URL string
- Extend `useURLSync` for bidirectional sync with `useRoutePlanStore.steps`
- When `plan` present in URL, load into store on mount (view-only, planning mode not auto-entered)
- Default: omitted (no plan)

---

## UI Design

### Sidebar Section: "Route Plan"

New section between "My Rides" and "Browse Slopes & Lifts":

```
+---------------------------------+
| Mountain  Solden Navigator  [G] |  <- Brand row
+---------------------------------+
| MY LOCATION                     |
| [Pin Start tracking]            |
+---------------------------------+
| MY RIDES                   [+]  |
| ...                             |
+---------------------------------+
| ROUTE PLAN            [actions] |  <- NEW
| ...                             |
+---------------------------------+
| BROWSE SLOPES & LIFTS           |
| ...                             |
+---------------------------------+
| G SETTINGS                   v  |
+---------------------------------+
```

### State 1: No Plan (default)

```
ROUTE PLAN
+---------------------------------+
|  Plan your ski day route.       |
|  [Start Planning]               |
+---------------------------------+
```

### State 2: Planning Mode Active

**Top -- Plan list:**

```
ROUTE PLAN          [Share] [Clear]
+---------------------------------+
| 1. Gondola Giggijochbahn       | [x]
| 2. Red Rotkogljoch      ! 1.2km| [x]
| 3. Gondola Schwarze Schneid    | [x]
| 4. Coffee Gampe Thaya (break)  | [x]
|                                 |
| + Add next step...              |
+---------------------------------+
```

- Order number, type icon, entity name, optional warning badge, remove button
- Drag-and-drop reorderable
- Warning icon when step >500m from previous
- "Share" copies the URL with the plan encoded
- "Clear" removes all steps (with confirmation)

**Bottom -- Nearby suggestions:**

```
NEARBY                    <- 500m ->
[Lifts] [Pistes] [Breaks]
+---------------------------------+
| Gondola Schwarze Schneidbahn [+]|
| Gondola Gaislachkoglbahn     [+]|
| Blue Freeride Route 1       [+]|
| Peak Schwarze Schneid       [+]|
+---------------------------------+
```

- Tabs filter by entity type (lifts, pistes, breaks = peaks + villages)
- Sorted by distance (closest first)
- `[+]` appends to plan
- If plan empty, show all entities

### State 3: Plan Exists, Not in Planning Mode

```
ROUTE PLAN               [Edit] [Share]
+---------------------------------+
| 1. Gondola Giggijochbahn       |
| 2. Red Rotkogljoch             |
| 3. Gondola Schwarze Schneid    |
| 4. Coffee Gampe Thaya (break)  |
+---------------------------------+
```

Read-only. Clicking a step selects that entity. "Edit" enters planning mode.

### Map Behavior in Planning Mode

1. **Planned entities highlighted** -- distinct visual treatment (glow outline / increased opacity)
2. **Nearby entities emphasized** -- entities within 500m of last step's endpoint visually distinguished
3. **Auto-pan** -- camera smoothly pans to last step's endpoint after adding a step
4. **Click-to-add** -- clicking an entity on the map adds it to the plan (instead of normal select behavior)

---

## Implementation Phases

### Phase 1: Store + URL Sync

- `src/stores/useRoutePlanStore.ts` -- New store
- `src/lib/url/searchSchema.ts` -- Add `plan` param, parse/build functions
- `src/hooks/useURLSync.ts` -- Bidirectional sync

### Phase 2: Proximity Engine

- `src/lib/geo/proximity.ts` -- `getStepEndpoint()`, `getNearbyEntities()`, `getStepWarnings()`, haversine distance

### Phase 3: Sidebar UI -- Plan List

- `src/components/sidebar/RoutePlanPanel.tsx` -- Plan list with 3 states
- `src/components/layout/Sidebar.tsx` -- Add section

### Phase 4: Nearby Suggestions

- Extend `RoutePlanPanel.tsx` with tabbed "Nearby" section
- `src/hooks/useNearbyEntities.ts` -- Hook combining ski data + plan store

### Phase 5: Map Integration

- `Pistes.tsx` / `Lifts.tsx` -- Visual treatment for planned entities
- `SkiMap3D.tsx` -- Click-to-add in planning mode, auto-pan

### Phase 6: Polish

- Drag-and-drop reordering
- Disconnection warnings
- Copy-link share button
- Mobile responsiveness
- Edge cases (stale entity IDs, etc.)

---

## Technical Notes

### Coordinate Order Normalization

Raw coordinates are `[lon, lat]` but point tuples are `[lat, lon, elevation]`. Proximity engine normalizes to `[lat, lon]` internally, converts at boundaries.

### Piste ID Stability

Merged piste IDs depend on constituent OSM way IDs. If OSM data changes, IDs may change, breaking saved plans. Acceptable for v1 -- plans are ephemeral.

### Drag-and-Drop Library

Evaluate `@dnd-kit/core` vs native HTML drag events at implementation time. For a simple vertical list, native may suffice.

### Plan Size in URL

20-step plan ~ 300-400 chars. Well within URL limits.

---

## Out of Scope (Future Work)

- Custom-named break stops
- Multiple named plans
- Plan persistence beyond URL (localStorage, backend)
- Estimated time/distance for the full plan
- Turn-by-turn directions
- Elevation profile of planned route
