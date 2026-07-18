## Goal
In the Engineer → Submit Trip Requests form, when **Material Transport** is selected, the **Delivery Point** dropdown must list **project names** (not site/location values) plus saved custom delivery points, with the existing "➕ Add new delivery point…" option preserved.

## Change

- `src/pages/EngineerTripSubmit.tsx` — `deliveryPointOptions` currently builds from `projects.map(p => p.site)`. Change it to build from `projects.map(p => p.name)` (deduped, case-insensitive), then merge in saved `delivery_points` names, sorted alphabetically.
- Submission mapping stays as-is: the chosen delivery point string continues to be written into the trip's `site` field with `project_name = "Material Transport"`. Only the label source in the dropdown changes.
- Rehydration of previous material submissions continues to read from `r.site` — no change needed (whatever label was chosen is what gets shown back).
- Custom "Add new delivery point" flow, persistence to the `delivery_points` table, and dedupe behavior stay unchanged.

## Out of scope
- No schema changes.
- No changes to Staff Transport flow, admin/driver views, or Excel import.
