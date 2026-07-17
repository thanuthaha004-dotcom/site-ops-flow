## Diagnosis

Saeed Ullah has **two driver accounts** in the system:

| Profile | Email | Vehicle linked? |
|---|---|---|
| `SAEED ULLAH` (uppercase) | transport@hwgas.ae | ✅ EE 38105 |
| `saeed ullah` (lowercase) | saeedullah@petrosafe.com | ❌ None |

Vehicle **EE 38105** has 6 trips scheduled for today (17 July 2026) — 3 at 5:30 AM, 2 at 7:00 AM, 1 at 9:30 AM. All are assigned, none started.

The driver read-policy (`current_user_drives_vehicle`) only returns trips for the vehicle whose `driver_user_id` matches the logged-in user. Since Saeed is almost certainly signing in with `saeedullah@petrosafe.com` (the newer, personal-looking address), that account is not linked to any vehicle, so his dashboard shows zero trips.

No `driver_locations` rows exist for either profile, so we can't yet confirm from telemetry which account he last used — but the mismatch alone fully explains the symptom.

## Recommended fix

**Consolidate onto the account Saeed actually logs in with** and remove the duplicate. Please confirm which of the following you want before I execute anything:

### Option A — Keep `saeedullah@petrosafe.com` (recommended if that's his real login)
1. Repoint vehicle `EE 38105`: set `vehicles.driver_user_id = ddaa4bfd-d60a-48dd-bbb5-0702c5d55b6d`.
2. Optionally normalise `vehicles.driver` text to `SAEED ULLAH`.
3. Remove the stale `transport@hwgas.ae` profile + `user_roles` row (or leave it disabled) so it can't accidentally be used again.

### Option B — Keep `transport@hwgas.ae`
1. Tell Saeed to sign out and log in with `transport@hwgas.ae`.
2. Remove the `saeedullah@petrosafe.com` profile + role.

### Option C — Just make today work, decide later
Only run step A.1 (repoint the vehicle to `saeedullah@petrosafe.com`). Leaves both profiles in place; we clean up duplicates later.

## Verification after fix

```sql
SELECT * FROM trip_schedules
WHERE trip_date = CURRENT_DATE AND vehicle_number = 'EE 38105';
-- Should return 6 rows, and Saeed's dashboard (after refresh) should show them.
```

## Notes
- No app code changes needed — this is purely a data linkage problem.
- Root cause going forward: the "Add Vehicle" / driver-approval flow should prevent creating a second driver profile with the same name. That's a separate hardening ticket; flag if you want it in this plan.

**Which option should I execute — A, B, or C?**
