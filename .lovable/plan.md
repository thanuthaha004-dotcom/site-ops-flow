## Problem
The sidebar link **Workforce** was added for engineers, but `src/App.tsx` only registers the `/workforce` route inside the `role === 'admin'` branch. When an engineer navigates there, React Router falls through to `NotFound`, producing the "404 /workforce" seen in the console — the data never gets a chance to load.

## Fix
Add the `/workforce` route to the engineer branch in `src/App.tsx` so the `Workforce` page renders for engineers as well.

```tsx
) : (
  <>
    <Route path="/" element={<EngineerTripSubmit />} />
    <Route path="/projects" element={<Projects />} />
    <Route path="/submit-trips" element={<EngineerTripSubmit />} />
    <Route path="/my-requests" element={<MyTripRequests />} />
    <Route path="/workforce" element={<Workforce />} />   {/* NEW */}
  </>
)
```

No changes to the `Workforce` page, RLS policies, or data fetching — those already permit engineers (confirmed earlier). This is purely a missing route registration.

## Verification
- Log in as an engineer, click **Workforce** in the sidebar → page renders, workers list loads.
- Admin `/workforce` continues to work (unchanged).
- No more `404 Error: /workforce` in console.
