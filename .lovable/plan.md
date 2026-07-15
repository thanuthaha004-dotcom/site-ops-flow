
## Goal
Skip MyLocatorPlus. Use the **driver's own phone GPS** (via the browser) to report vehicle location automatically whenever the driver has the app open. Admin gets a "Nearest Vehicle" finder for unexpected trips using this live data.

## How it works (plain language)
- When a driver opens the app on their phone, the browser asks **once**: *"Allow this site to access your location?"* → they tap Allow.
- From then on, while the app stays open (foreground), the phone silently sends its GPS coordinates to our backend every ~30 seconds.
- Each driver's phone location = their vehicle's location (because they drive it).
- Admin sees all vehicles live on a map and can find the nearest one instantly.

## What we'll build

### 1. Database
- New table `driver_locations` (one row per driver, updated in place): `user_id`, `lat`, `lng`, `accuracy_m`, `speed_kmh`, `updated_at`.
- Realtime enabled so admin map updates live.

### 2. Driver PWA — automatic location sharing
- On login, ask permission once with a friendly banner: *"Share your location so dispatch can send you the closest jobs."* → Allow / Not now.
- If allowed → background hook uses `navigator.geolocation.watchPosition` and pushes to `driver_locations` every 30s (or when moved >100m).
- Small status chip in driver dashboard: 🟢 *Location sharing on* / 🔴 *Off — tap to enable*.
- Stops when the app is closed or backgrounded (this is a browser limitation — see caveats).

### 3. Admin — Live Fleet Map
- New page `/fleet/live` with a Google Map showing every driver's current pin, name, vehicle number, and "updated Xs ago".
- Grey pin if last update > 5 min (considered stale).

### 4. Admin — Unexpected Trip / Nearest Vehicle
- New page `/trip-planning/unexpected`.
- Admin enters destination (address autocomplete).
- System returns **top 5 nearest drivers** sorted by driving ETA:
  ```text
  #1  Habeeb    K 41732   4.2 km   ~9 min    updated 12s ago   [Assign]
  #2  Rashid    D 22984   7.8 km   ~15 min   updated 40s ago   [Assign]
  ```
- "Assign" creates a `trip_schedules` row → appears in that driver's Dashboard immediately.

### 5. Distance calculation
- Uses Google Maps Routes API (via the Lovable-managed Google Maps connector — 1-click, no key required from you).

## Caveats (important to know upfront)
- **Only works while the driver has the app open in the foreground.** Browsers stop background GPS when the tab is closed or the phone is locked. If drivers need location tracking with the app closed, we'd need to convert the driver app to a native mobile app (Capacitor) — a separate, larger effort.
- **Driver must tap "Allow" once.** If they deny, we show an in-app message telling them how to re-enable in browser settings.
- **Accuracy depends on the phone** (usually 5–20 m outdoors, worse indoors).
- **Battery**: 30-second interval + `watchPosition` is light — comparable to using Google Maps.

## Technical section
- **Table**: `driver_locations (user_id uuid pk, lat double precision, lng double precision, accuracy_m real, speed_kmh real, updated_at timestamptz)` with RLS: driver can upsert own row, admins can read all.
- **Grants**: `GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated; GRANT ALL TO service_role;` and `ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;`.
- **Hook**: `useDriverLocationBroadcast()` — mounts once in driver layout, checks permission, calls `navigator.geolocation.watchPosition({enableHighAccuracy:true, maximumAge:15000})`, throttled upsert to Supabase.
- **Edge function** `find-nearest-vehicles`: input `{lat, lng, limit=5}`; joins `driver_locations` + `vehicles` + `profiles`; calls Routes API `computeRouteMatrix` for ETAs.
- **Admin map**: subscribes to `driver_locations` postgres_changes and re-renders pins.
- **Permission UX**: reusable `<LocationPermissionCard />` component with allow / dismiss states persisted in `localStorage`.

## Out of scope (unless you ask)
- Native background tracking (needs Capacitor).
- Historical route playback (we only keep the latest position; add a `driver_location_history` table later if you want trails).
- Geofence alerts / arrival auto-detection.

## Ready to build?
Reply **"go ahead"** and I'll implement steps 1–5 in one pass. No credentials needed from you — the Google Maps connector is 1-click and I'll trigger it during build.
