# Zone Management (Admin)

Goal: Give admins one screen to see every zone, the locations under each, and map any new/unrecognised location to a zone. New mappings take effect immediately across Trip Planning.

## What the admin sees

New sidebar item **"Zones"** (admin only), route `/zones`.

Page layout:
1. **Unmapped Locations** panel at the top — every distinct site that has appeared in trip requests / schedules but currently falls back to "Other" (or wasn't matched to a zone keyword). Each row has a **zone dropdown** + Save button.
2. **Zones** grid below — one card per zone (Zone 1–4, Hub - Al Quoz Camp, Sharjah, Ajman, Al Ain, Abu Dhabi). Each card lists its locations with:
   - Built-in keywords (read-only, tagged "default")
   - Admin-added locations (removable)
   - "+ Add location" input to attach a new location manually

## How it works

- Store admin-added mappings in a new `zone_locations` table: `{ id, zone, location_keyword, created_by, created_at }`.
- `getAreaCluster()` in `src/lib/tripPlanning.ts` gets a new optional parameter `customMappings` (Map of uppercased keyword → zone). It checks custom mappings first (exact/substring), then falls back to today's hardcoded list + fuzzy match.
- On app load (for admin + when trip planning runs), fetch `zone_locations` once and cache. Trip planning + Zones page both use it.
- "Unmapped Locations" is computed by pulling distinct `site` values from `daily_trip_requests` (last 60 days) and filtering to ones that resolve to `"Other"` or don't hit any zone keyword.

## Technical details

**New table** `zone_locations`
- `zone text not null` (one of the 9 zone names)
- `location_keyword text not null` (uppercased, unique)
- `created_by uuid`, timestamps
- RLS: admins full access; authenticated read (trip planning needs it)
- GRANT SELECT to authenticated, ALL to service_role

**Files changed**
- `supabase/migrations/*` — new table + policies
- `src/lib/tripPlanning.ts` — accept custom mappings, check them first
- `src/lib/zoneMappings.ts` (new) — fetch + cache helper
- `src/pages/admin/ZoneManagement.tsx` (new)
- `src/App.tsx` — add `/zones` route (admin)
- `src/components/layout/AppSidebar.tsx` — add nav link
- `src/pages/TripPlanning.tsx` — load custom mappings before grouping

**Out of scope** (unless you want it): editing the built-in zone keywords, renaming zones, creating new zones.

Confirm and I'll implement.
