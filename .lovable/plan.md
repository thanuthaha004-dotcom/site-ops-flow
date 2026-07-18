## Problem
Every RLS policy on `workers`, `driver_locations`, `engineers`, `vehicles`, `zone_locations`, etc. calls `public.has_role(auth.uid(), 'admin')`. Currently only `sandbox_exec` has EXECUTE on `public.has_role` — `anon` and `authenticated` do not. PostgREST evaluates the policy as the request role, hits the missing grant, and returns:

```
permission denied for function has_role
```

That's why admins (and engineers) can't load the workers list or insert a new worker.

The same fix that worked previously was reverted when we tightened SECURITY DEFINER function permissions.

## Fix
One migration that restores EXECUTE on the helper functions the RLS policies invoke, without weakening the truly-sensitive definers:

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_drives_vehicle(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_can_see_project(uuid) TO anon, authenticated;
```

These three wrappers are safe to expose — they only return booleans about the caller's own identity and are already gated by `auth.uid()` inside.

## Verification
- Admin → **Workforce**: list loads, "Add worker" succeeds.
- Engineer → **Workforce**: list loads (read-only paths).
- Live Fleet map loads `driver_locations` without 403.
- No `permission denied for function has_role` entries in the network log.
