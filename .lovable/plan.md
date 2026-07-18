## Goal
Add a **Transport Type** selector (Staff Transport vs Material Transport) to each trip draft in Engineer → Submit Trip Requests. Staff keeps today's exact flow. Material swaps the Workers block for a Material Category dropdown (with custom-add) and a Pickup/Delivery direction selector. All other fields (project, site, timing, vehicle, driver, notes, execution order) stay identical.

## UX

1. New segmented control at the top of each trip card: **Staff Transport** | **Material Transport**. Default = Staff (preserves current behavior).
2. **Staff Transport** → renders the current Workers section unchanged (chips picker + WorkerAutocomplete + duplicates warning).
3. **Material Transport** → hides Workers block and shows:
   - **Material Category** dropdown with preset options:
     Fire Fighting, Fire Alarm and Panel, Pipes, Fittings, Consumables, Gas Meters and Detectors, Cables, Extinguishers, Sprinklers, PVC Conduits and Fittings, Machine Transfer, Others.
     Includes an "➕ Add custom category…" row → small inline input; custom values persist for the session (per-page state) and appear at the bottom of the dropdown.
   - **Direction** side-by-side toggle: **Material Pickup** | **Material Delivery** (radio-style buttons).
   - Notes field remains and is no longer forced to "required (solo trip)" — for material trips the worker-less warning is suppressed.

## Data mapping (no schema change)

To avoid a migration, encode material info into existing free-text columns:
- `worker_names` → `[]` for material trips (empty array is already supported for solo trips).
- `work_type` → set to the chosen material category (e.g. "Fire Fighting"). This overrides the project's default work_type only when Material Transport is selected.
- `notes` → prefixed with a machine-readable tag so downstream dispatch/UI can recognize it:
  `[MATERIAL:PICKUP] <engineer notes>` or `[MATERIAL:DELIVERY] <engineer notes>`.
- `pickup_location` stays as-is (Al Quoz camp default) for pickup trips; for delivery trips the site remains the destination.

The submit path (`submitTripRequests`) needs no signature change — only the values inside each `TripRequestInput` change.

The reverse mapping (loading previous submissions to edit) parses the `[MATERIAL:...]` prefix out of `notes` and re-hydrates the transport type + direction; if the tag is absent the draft loads as Staff (backward compatible).

## Files touched

- `src/pages/EngineerTripSubmit.tsx`
  - Extend the draft type with `transport_type: 'staff' | 'material'`, `material_category?: string`, `material_direction?: 'pickup' | 'delivery'`.
  - Add segmented control + conditional rendering (Workers block vs Material block).
  - Add small `MaterialCategorySelect` inline (native `<select>` styled like the existing project select, with a "custom…" affordance that reveals an input and pushes into a local `customCategories` state array).
  - Update `handleSubmit` payload build (lines ~255–270): when material, set `worker_names: []`, `work_type: material_category`, `notes: '[MATERIAL:PICKUP|DELIVERY] ' + notes`.
  - Update the previous-submissions hydrator (~lines 100–125): detect `[MATERIAL:...]` prefix in `notes`, set draft transport fields, strip prefix from displayed notes.
  - Suppress "Notes required for solo trip" warning when `transport_type === 'material'`.
  - Excel import rows (lines ~330–370) stay as Staff (no changes).

- No backend / RLS / types changes. No changes to `tripRequestsData.ts`, dispatch, driver views, or admin trip planning (they continue to treat these rows as normal trip requests — a material trip simply has zero workers and a material category in `work_type`; the existing "solo trip" handling already covers empty worker lists end-to-end).

## Verification

- Toggle a draft to Material → Workers block disappears, Category dropdown + Pickup/Delivery toggle appear.
- Add a custom category → it appears at the bottom of the dropdown for other drafts on the same page.
- Submit one Staff + one Material trip → both rows appear in DB; material row has empty worker_names, category in work_type, `[MATERIAL:PICKUP]` prefix in notes.
- Click "Load previous submissions to edit" → material trip re-hydrates with correct transport type, category, and direction; notes shown without the tag.
- Existing Staff-only submissions still load and submit exactly as before.
