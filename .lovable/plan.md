
## Goal
When an unexpected trip comes in, the admin enters a destination and the app returns a **ranked list of nearest vehicles** using live GPS positions pulled from your existing locator (`pro.mylocatorplus.com`).

## Prerequisite (must confirm before build)
MyLocatorPlus is a third-party GPS platform. To read live positions, we need one of:

1. **API access from MyLocatorPlus** — the account owner requests API credentials (username/password, API key, or token) from MyLocatorPlus support. Most platforms of this type expose a REST endpoint that returns `{vehicle, lat, lng, speed, last_update}`.
2. **If no API is offered** — MyLocatorPlus won't work; we'd fall back to drivers' phones sending GPS from the driver PWA (separate feature).

Please contact MyLocatorPlus and ask: *"Do you provide a REST API or data feed for live vehicle positions? If yes, please share the API documentation and credentials."*
Once you have those, I'll wire it in. The plan below assumes option 1.

## What we'll build

### 1. Store locator credentials securely
- Save the MyLocatorPlus API base URL + token as backend secrets (never in frontend code).

### 2. Vehicle ↔ tracker mapping
- Add a `locator_device_id` field on the `vehicles` table so each Lovable vehicle links to its tracker unit in MyLocatorPlus.
- Admin edits this once per vehicle in Fleet page.

### 3. Backend function: `get-live-positions`
- Edge function calls MyLocatorPlus API, returns `[{vehicle_number, lat, lng, last_update, speed}]`.
- Cached ~30s to avoid hammering the provider.

### 4. Backend function: `find-nearest-vehicles`
- Input: destination address or lat/lng, optional required headcount.
- Steps:
  a. Geocode destination (using existing Google Maps connector if present, else Mapbox).
  b. Pull live positions via `get-live-positions`.
  c. Compute **road distance & ETA** to destination for each vehicle (Google/Mapbox Distance Matrix).
  d. Return top 5 sorted by ETA with: vehicle number, current driver, distance km, ETA min, last GPS update age, current status flag (on-trip / idle — informational only, per your choice all vehicles are eligible).

### 5. Admin UI: "Unexpected Trip" page
- New route `/trip-planning/unexpected` (also entry point from Trip Planning header).
- Form: destination (address autocomplete + map pin), optional headcount, notes.
- On submit → shows ranked list card view:
  ```text
  #1  K 41732  •  Habeeb        •  4.2 km  •  ~9 min  •  updated 12s ago  •  [Assign]
  #2  D 22984  •  Rashid         •  7.8 km  •  ~15 min •  updated 40s ago  •  [Assign]
  ...
  ```
- "Assign" button creates a `trip_schedules` row for that vehicle + notifies the driver (visible in their Dashboard immediately).
- Small live map showing all vehicle pins + the destination pin.

### 6. Reuse on existing planning page
- Add an "Live positions" toggle on the main Trip Planning map so admin can always see where each vehicle currently is.

## Technical section
- **Tables**: `ALTER vehicles ADD locator_device_id text`.
- **Secrets**: `MYLOCATORPLUS_BASE_URL`, `MYLOCATORPLUS_TOKEN` (via add_secret after you share).
- **Edge functions**: `get-live-positions`, `find-nearest-vehicles`, `create-unexpected-trip`.
- **Distance**: prefer Google Maps Distance Matrix (Lovable-managed connector — 1-click, no key). Falls back to haversine straight-line if quota/error.
- **Caching**: in-memory 30s on positions; per-request on distance matrix.
- **Auth**: admin-only RLS on the assignment endpoint.
- **Realtime**: subscribe the Unexpected Trip page to positions every 30s.

## Out of scope (unless you ask)
- Auto-assignment (you chose "suggest ranked list").
- Historical playback of vehicle routes.
- Geofence alerts.

## Next step
Reply with either:
- **"Go ahead"** — I'll build steps 1–6 in build mode, and pause to request the MyLocatorPlus credentials via the secure secret form once the code is ready.
- Or share the MyLocatorPlus API doc link now so I can tailor the position fetcher exactly to their response shape.
