## Goal
Let engineers optionally set an **Expected Completion Time** and mark a trip as **Urgent** during submission (for both Staff and Material Transport). Both fields should flow through to Admin (Smart Trip Planning + engineer request cards) and Driver (trip list + trip detail) views. The driver-captured actual end time behavior stays unchanged.

## Database
Add two nullable columns to both `daily_trip_requests` and `trip_schedules`:
- `expected_completion_time text` (free-form HH:MM string, matching how `start_time` is stored today)
- `is_urgent boolean not null default false`

No RLS/grant changes — new columns inherit existing table policies.

## Engineer submission — `src/pages/EngineerTripSubmit.tsx`
- Extend `TripDraft` with `expected_completion_time: string` and `is_urgent: boolean`.
- Add a small time input + a checkbox/toggle labeled "Urgent Requirement" in each draft card, visible for both transport types (placed near start_time).
- Include the new fields in `submitTripRequests` payloads and Excel rehydration/import (optional columns; missing = empty/false).

## Backend types & mapping — `src/lib/tripRequestsData.ts`
- Add `expected_completion_time?: string | null` and `is_urgent?: boolean` to `TripRequestInput` and the fetched request shape.
- Persist them on insert into `daily_trip_requests`.
- When dispatching (existing code that copies requests → `trip_schedules`), copy both fields through.

## Admin views
- `src/pages/TripPlanning.tsx` engineer-request cards and dispatched-trip cards: show an "Urgent" badge (amber/red) and an "Expected by HH:MM" line when set.
- `src/pages/engineer/MyTripRequests.tsx`: same badge + expected time line so the engineer sees what they submitted.

## Driver views
- `src/components/driver/TripCard.tsx`, `src/pages/driver/MyTrips.tsx`, `src/pages/driver/TripDetail.tsx`: show the same Urgent badge and Expected completion time line. Do NOT change actual end-time capture — that continues to be set when the driver marks the trip complete.

## Excel import (light touch)
- `src/lib/excelImport.ts`: recognize optional headers "Expected Completion Time" / "Expected End" and "Urgent" (yes/true/1). Missing columns default to unset/false. No template redesign required unless you ask for it.

## Out of scope
- No changes to how actual end time / duration are captured.
- No sorting/prioritization logic based on the Urgent flag in this pass (flag is display-only for now — can be wired into optimizer priority in a follow-up if you want).
- No notification/alerting on urgent trips.

## Execution order
1. Migration for the two columns on both tables (needs your approval).
2. After types regenerate: update `tripRequestsData.ts`, submission form, Excel import, then admin/driver display components.

Confirm and I'll run the migration first, then wire the UI.