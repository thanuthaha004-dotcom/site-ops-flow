## Goal
On the Engineer → Submit Trip Requests page, upgrade the "Add a name not on the project" text field so it suggests names from the full workforce (workers table) as the engineer types, while still accepting any free-text name that isn't in the list.

## Current behavior
- Each trip draft has a project-worker chip picker (names already assigned to the project).
- Below it, a plain `<input>` lets the engineer type any name and press Enter / click Add. There is no visibility into the wider workforce master list.

## Proposed change (UI only, no schema/business-logic change)

1. **Load workforce once per page load**
   - In `src/pages/EngineerTripSubmit.tsx`, fetch all workers via existing `fetchWorkers()` from `@/lib/supabaseData` on mount, store as `allWorkforce: Worker[]`.
   - Show a small "loading workforce…" hint while pending; failures fall back silently to plain input (never block submission).

2. **Replace the plain input with a combobox-style autocomplete**
   - Keep the same layout (input + Add button) but wrap the input in a popover that shows filtered suggestions as the engineer types (min 1 char).
   - Suggestion row shows: name, staff code, department.
   - Filter: case-insensitive substring match on name or staff code. Cap list to ~8 results.
   - Exclude names already in `d.worker_names` for the current draft.
   - Clicking a suggestion → adds that worker name to `worker_names` and clears the input (same code path as `addCustomWorker`).
   - Pressing Enter → if a suggestion is highlighted, add it; otherwise fall through to existing free-text add (so custom names still work).
   - Keyboard: ArrowUp/Down to move highlight, Esc to close popover.

3. **Preserve free-text entry**
   - If typed text has no exact match, still show an "Add '<typed>' as custom name" row at the bottom of the popover so the engineer can clearly add off-list people (visitors, subcontractors).
   - Placeholder updates to: "Search workforce or type a new name…".

4. **No changes to**
   - Data model, submission payload, project quick-pick chips, notes/warnings, RLS, or any backend logic.
   - The "Selected" chips list and duplicate warnings remain unchanged.

## Files touched
- `src/pages/EngineerTripSubmit.tsx` — add workforce fetch state, replace the custom-name input block (~lines 675–692) with the new autocomplete component.
- Optionally extract the autocomplete into `src/components/forms/WorkerAutocomplete.tsx` for readability (single small component, ~80 lines). Uses existing shadcn `Command`/`Popover` primitives already in the project.

## Verification
- Type 2–3 letters of an existing worker → suggestions appear with staff code/department; click adds them.
- Type a brand-new name → "Add '<name>' as custom" row appears; Enter adds it.
- Already-selected workers do not appear in suggestions.
- Submission payload identical to today (spot-check one trip end-to-end).
