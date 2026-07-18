# Vehicle Occupancy — Live Capacity Tracking

## Goal
Let a driver update, at any time (idle or on a trip), how full their vehicle is. Admins and Engineers can see this live to know which vehicles have spare capacity.

## What the driver sees
A new **Vehicle Occupancy** card on the Driver Dashboard, always visible (not tied to a trip):
- **Vehicle**: shows the driver's assigned vehicle number + seating capacity (e.g. "U 38743 · 15 seats").
- **Passengers on board**: number input / +– stepper, clamped between 0 and the vehicle's seating capacity. Shows "12 / 15 seats used" and a small progress bar.
- **Material occupancy**: dropdown with 4 options — **25%**, **50%**, **75%**, **100%** (plus "Empty / 0%").
- **Last updated** timestamp + "Save" button. Saves instantly to the backend.

If the driver isn't linked to any vehicle yet, the card shows a friendly note telling them to contact the admin.

## What Admin & Engineers see
- **Live Fleet page (Admin)**: each vehicle marker/list row gains two badges — `Pax 12/15` and `Material 50%`, colored by fill level (green < 50%, amber 50–75%, red ≥ 100%). Updates in real time.
- **Fleet page (Admin)**: same two columns added to the vehicle table.
- **Engineer trip submission page**: a small "Vehicle capacity" panel (read-only) listing current passenger and material load per active vehicle, so engineers know which vehicles have room before requesting a trip.

## Data model (new table)
`vehicle_occupancy` — one row per vehicle, updated in place:
- `vehicle_number` (PK, text)
- `passenger_count` (int, default 0)
- `material_percent` (int, one of 0/25/50/75/100)
- `updated_by` (uuid → auth user)
- `updated_at` (timestamptz)

RLS:
- **Drivers**: can `SELECT` all, but can only `INSERT/UPDATE` the row for a vehicle they're assigned to (reuses `current_user_drives_vehicle`).
- **Admins & Engineers**: `SELECT` all (read-only).
- Realtime enabled so Admin/Engineer views update instantly.

## Files to add / change
```text
supabase migration        create vehicle_occupancy table + RLS + realtime
src/lib/vehicleOccupancy.ts        fetch / upsert helpers + realtime hook
src/components/driver/VehicleOccupancyCard.tsx   new driver UI card
src/pages/driver/Dashboard.tsx     mount the new card
src/pages/admin/LiveFleet.tsx      show pax + material badges (live)
src/pages/Fleet.tsx                two extra columns in the vehicles table
src/pages/EngineerTripSubmit.tsx   read-only capacity panel
```

## Out of scope
- No history/audit log of occupancy changes (only the latest value is kept).
- No automatic passenger count from trip assignments — driver updates it manually as requested.

---
Please confirm and I'll implement it exactly as above (or tell me what to adjust).
