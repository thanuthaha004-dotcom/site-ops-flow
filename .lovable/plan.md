# Fix: Habeeb's missing 16 July trips

## Diagnosis
Habeeb drives **K 41732**. On 2026-07-16 only 1 trip (MUHAISNAH FOURTH 07:00) is saved under K 41732. His two engineer-requested 05:30 trips (AL RAFFA, NADD AL SHEBA) were dispatched under **EE 38105** because the admin ran Optimize→Dispatch *before* the previous merge-fix landed — the old merger combined all 05:30 requests into one EE 38105 trip.

The driver read-policy is working correctly. This is a stale data issue, not a code issue.

## Fix (chosen: reassign in place — least disruptive)

Run a data update to move the two 05:30 rows back onto Habeeb's vehicle. No admin action required, Habeeb sees the trips as soon as his phone refreshes.

```sql
UPDATE public.trip_schedules
SET vehicle_number = ' K 41732'
WHERE trip_date = '2026-07-16'
  AND time_slot = '5:30 AM'
  AND site IN ('AL RAFFA', 'NADD AL SHEBA');
```

Vehicle string uses the same ` K 41732` format (leading space) already present in the other K 41732 row for consistency.

## Verification
```sql
SELECT time_slot, site, vehicle_number
FROM trip_schedules
WHERE trip_date='2026-07-16' AND vehicle_number ILIKE '%41732%'
ORDER BY time_slot;
```
Expect 3 rows: AL RAFFA (5:30), NADD AL SHEBA (5:30), MUHAISNAH FOURTH (7:00).

## Not in scope
- The two rows still sit under EE 38105 in the merged 05:30 dispatch — after the reassignment, that EE 38105 group drops from 10 workers to 6, still within capacity. No other row changes needed.
- Prior dates dispatched under the old merger (e.g. 15 Jul) are left alone. Say the word if you want them audited too.
- No code changes — the merge logic is already correct for future dispatches.
