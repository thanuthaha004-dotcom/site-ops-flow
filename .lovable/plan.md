## Goal
When an engineer picks **Material Transport**, hide the Project selector and show a **Delivery Point** selector instead. The dropdown lists all existing project sites and every saved custom delivery point (e.g. "Petrosafe Store", supplier addresses). Engineers can add a new delivery point inline; new entries are persisted to the database and immediately available in the dropdown for all future trip requests (by any engineer).

Staff Transport is unchanged — Project selector behaves exactly as today.

## UX

1. Toggle transport type → **Material Transport**:
   - Label "Project" becomes "Delivery Point".
   - Dropdown options (in order):
     - Project sites already in the system (deduped, alphabetized).
     - Saved custom delivery points (from new `delivery_points` table).
     - "➕ Add new delivery point…" row → reveals an inline input + Save button.
2. Saving a new delivery point:
   - Trims and case-insensitively deduplicates against existing sites + saved delivery points.
   - Persists to `delivery_points` (name, created_by).
   - Auto-selects the new value in the current trip and appends it to the dropdown for every trip card on the page.
3. Zone badge continues to auto-detect from the chosen delivery point name.
4. Loading a previous material submission: the saved site rehydrates as the Delivery Point selection.

## Data mapping (no new columns on trip tables)
- If the chosen delivery point matches an existing project's site, we still submit as a custom entry (project_id blank) so the row's site is exactly the delivery point and `work_type` remains the material category. `project_name` is set to `"Material Transport"` for clarity in admin/driver views.
- If it's a saved custom or freshly added delivery point, same treatment: `project_id` blank, `site = <delivery point>`, `project_name = "Material Transport"`.

Rehydrate: when loading past submissions with the `[MATERIAL:...]` tag, prefill `delivery_point = row.site`.

## Files touched

- **New migration**: `delivery_points` table
  - Columns: `id uuid pk`, `name text not null unique (case-insensitive via lower(name) unique index)`, `created_by uuid`, `created_at`, `updated_at`.
  - GRANTs to `authenticated` (SELECT/INSERT) and `service_role` (ALL).
  - RLS: any authenticated user can SELECT; any authenticated user can INSERT with `created_by = auth.uid()`; admins can DELETE.
- **New file** `src/lib/deliveryPoints.ts`: `fetchDeliveryPoints()`, `addDeliveryPoint(name)`.
- **`src/pages/EngineerTripSubmit.tsx`**:
  - Load delivery points on mount; keep in state so a newly added point shows across all draft cards.
  - Add `delivery_point?: string` to `TripDraft`.
  - When `transport_type === 'material'`, render the new Delivery Point selector in place of the Project block (Trip No stays where it is).
  - Update `validate()` to require `delivery_point` for material trips (instead of project_id).
  - Update `handleSubmit` payload builder for material rows: `project_id: ''`, `project_name: 'Material Transport'`, `site: delivery_point`, category → `work_type`, tag → `notes` (existing logic).
  - Update the previous-submission hydrator to set `delivery_point` from `row.site` when the notes have a material tag.

No changes needed in admin trip planning, dispatch, or driver views — they already read `site`, `work_type`, and the `[MATERIAL:...]` tag which continue to render correctly.

## Verification
- Switch a draft to Material → Project field disappears, Delivery Point dropdown appears with project sites + "Add new delivery point…".
- Add "Petrosafe Store" → appears at top of the list, auto-selected on current trip, available on other trip cards, and persisted (reload page → still there).
- Submit → trip row has `site = "Petrosafe Store"`, `work_type = <category>`, notes prefixed with `[MATERIAL:PICKUP|DELIVERY]`.
- Load previous submissions → material trip rehydrates with the correct delivery point selected.
- Staff transport flow is untouched.