
# Performance Plan — Login & Dashboard

Goal: reduce the time between clicking "Sign In" and seeing the dashboard, and cut redundant data fetches app-wide.

## What's slow today (evidence from the code)

1. **Big JS bundle on the login page.** `src/App.tsx` imports every page (Dashboard, Projects, Schedule, Fleet, Workforce, Attendance, TripPlanning, Engineers, EngineerTripSubmit, MyTripRequests, DriverDashboard, MyTrips, TripDetail, DriverApprovals, PendingApproval, ResetPassword, NotFound) at the top. All of them — including Recharts, XLSX helpers, etc. — download before login can even render.
2. **Auth blocks on two sequential fetches.** `AuthContext` waits for `getSession` → then `user_roles` + `profiles` before `loading` becomes false. Nothing renders in the meantime.
3. **Dashboard refetches on every mount.** `Dashboard.tsx` calls `fetchProjects()` and `fetchVehicles()` in `useEffect` with no cache. Navigating away and back re-hits the DB. Same pattern in most pages.
4. **Dashboard pulls full rows** (`select *`) just to compute counts and averages, and to render 4 vehicles.
5. **QueryClient defaults** aren't tuned — default `staleTime: 0` means every mount refetches.

## Fix Plan

### 1. Code-split routes (biggest win for login speed)
- Convert every route component in `App.tsx` to `React.lazy(() => import(...))`.
- Wrap `<Routes>` in `<Suspense fallback={<Loader/>}>`.
- Keep `Login`, `AuthProvider`, and `AppLayout` eager so the login screen paints immediately.

### 2. Tune React Query as the app-wide cache
- `defaultOptions.queries`: `staleTime: 60_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: false`.
- Migrate `Dashboard.tsx` (and later other pages) from `useEffect + useState` to `useQuery(['projects'])` / `useQuery(['vehicles'])`. Re-entering the dashboard becomes instant.

### 3. Faster auth boot
- In `AuthContext`, set `user` + `session` and flip `loading=false` as soon as `getSession()` resolves, so the layout can render. Fetch role/profile in the background and update state when ready.
- Guard admin-only routes with a small "checking permissions…" state instead of blocking the whole app.

### 4. Slimmer dashboard query
- Add lightweight selectors in `src/lib/supabaseData.ts`:
  - `fetchProjectsSummary()` — selects only `id, name, type, site, status, progress, priority`.
  - `fetchVehiclesSummary()` — selects only `id, number, driver, status, utilization`, ordered/limited for the fleet widget.
- Dashboard uses these instead of the full `fetch*` calls.

### 5. Prefetch what users almost always visit next
- On successful login, `queryClient.prefetchQuery` for the landing page's data (dashboard for admin, my-requests for engineer, my-trips for driver). Kicks off the fetch during the route transition rather than after mount.

## Out of scope for this pass
- Rewriting every page to React Query (only Dashboard now; others can follow).
- Server-side pagination.
- Adding DB indexes (no slow-query evidence yet — will check with `slow_queries` if problems remain after the client fixes).

## Files touched
- `src/App.tsx` — lazy routes + Suspense + QueryClient defaults.
- `src/contexts/AuthContext.tsx` — non-blocking role/profile fetch.
- `src/pages/Dashboard.tsx` — use React Query + summary selectors.
- `src/lib/supabaseData.ts` — add `fetchProjectsSummary`, `fetchVehiclesSummary`.

Reply "go" to execute, or tell me what to change.
