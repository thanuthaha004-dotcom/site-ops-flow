## Goal
When an engineer bulk-uploads the Excel template, accept every row as-is — including unknown project names, sites, engineer names, drivers, vehicles, etc. Never block, never skip, never show a validation error. The uploaded data becomes the source of truth for that row and flows straight into the trip schedule.

## Current behaviour (what to change)
`src/pages/EngineerTripSubmit.tsx` → `handleExcelUpload` looks up each row's project in the local `projects` map. Rows without a match are pushed to `unmatched`, dropped from the draft list, and a warning toast fires. If nothing matches at all, the whole upload is rejected.

Additionally, the submit path (`submitTripRequests`) writes to `daily_trip_requests`, whose schema currently forces every row to reference a real project:
- `project_id uuid NOT NULL` with FK to `projects(id)`
- `UNIQUE (trip_date, project_id)` — also blocks multiple trips for the same project on the same day (an existing pain point)

So even if the UI accepted unknown projects, the DB would reject them.

## Plan

### 1. DB migration (`daily_trip_requests`)
- Make `project_id` **nullable** and keep the FK (nullable FK is fine — unknown projects store `NULL` here and rely on `project_name` text).
- **Drop** the `daily_trip_requests_trip_date_project_id_key` unique constraint. It's incompatible with (a) multiple trips per project per day and (b) rows without a project_id.
- No change needed to `trip_schedules` — `project_id` there is already nullable with `ON DELETE SET NULL`.

### 2. Excel upload handler (`src/pages/EngineerTripSubmit.tsx` → `handleExcelUpload`)
- Remove the "unmatched → skip + warn" branch.
- For each row: try to match a project by name/code (case-insensitive). If found, use its `id`, `name`, `site`, `workType`, `type`.
- If **not** found, accept the row anyway and build a draft using the Excel values verbatim:
  - `project_id: ''` (submitted as `NULL`)
  - `project_name`: value from Excel
  - `site`: `Project Location` from Excel (or blank)
  - `pickup_location`: `Pickup Location` from Excel (falls back to Al Quoz Camp)
  - `worker_names`: parsed passengers as-is
  - `start_time`, `end_time`, `vehicle_number`, `driver_name`, `execution_order`, `notes`, `engineer` (if provided) — all passed through
- Toast becomes purely informational: `Loaded N trips from Excel` — no "unknown project" warning.

### 3. Draft-validation & submit path
- `validateDrafts` currently requires `d.project_id`. Relax it: allow a draft with **no** `project_id` provided `project_name` is present (drafts created from Excel).
- `submitTripRequests` (`src/lib/tripRequestsData.ts`) — replace `project_id: r.project_id` with `project_id: r.project_id || null` so nullable inserts work. Same for the duplicate-preserved matcher (already tolerant: it falls back to `project_name` when `project_id` is empty).
- The Admin "Generate Trips" pipeline in `TripPlanning.tsx` already reads `project_name`, `site`, `worker_names`, etc. from the request and copies them into `trip_schedules`. Since `trip_schedules.project_id` is already nullable, unknown-project requests flow through without any further change.

### 4. Sanity checks after implementation
- Type-check with tsgo.
- Confirm generated Supabase types reflect the new nullable `project_id` before the front-end submit path is touched (types regenerate after the migration).
- Manually verify with a test row containing a made-up project name that: (a) the draft appears, (b) submit succeeds, (c) admin sees it in Engineer Requests, and (d) Generate Trips dispatches it.

### What stays the same
- The manual form (single-trip add) still uses the project dropdown — no behaviour change for engineers who don't use Excel.
- Existing already-dispatched requests are preserved (existing logic in `submitTripRequests`).
- No changes to the Excel template itself.

Approve to execute in this order: (1) migration, (2) UI + submit code edits, (3) type-check.