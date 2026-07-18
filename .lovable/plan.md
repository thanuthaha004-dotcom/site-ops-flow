## Goal
Let Engineer users see the Workforce page (already visible to Admins).

## Current state (verified)
- Route `/workforce` exists in `src/App.tsx` and renders `Workforce` for any signed-in user.
- Sidebar only shows the Workforce link in `adminNavItems`; `engineerNavItems` has no entry, so engineers can't navigate there.
- Database RLS on `workers` already permits engineers to SELECT (`Admins and engineers read workers` policy confirmed via query), so no backend changes needed.

## Changes
1. `src/components/layout/AppSidebar.tsx`
   - Add `{ path: '/workforce', label: 'Workforce', icon: Users }` to `engineerNavItems` (read-only navigation entry).

## Not changed
- No RLS/policy migration needed — engineers already have read access.
- Workforce page write actions (add/edit/delete/import) will still fail for engineers at the DB layer because the "Admins manage workers" policy restricts writes to admins. This matches the request ("details should be visible"). If you also want engineers to add/edit workers, tell me and I'll extend the policy plus surface a plan for it.
