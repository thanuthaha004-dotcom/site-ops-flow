# Where Habeeb's "missing" trip went

## What the data shows (2026-07-16)

The engineer submitted **3 requests for Habeeb / vehicle K 41732**:

| Trip No | Time  | Site             | Workers               |
|---------|-------|------------------|-----------------------|
| 6       | 05:30 | AL RAFFA         | Vengatesan, Elankoven |
| 7       | 05:30 | NADD AL SHEBA    | Unni, Thahir          |
| 15      | 07:00 | MUHAISNAH FOURTH | Vishal, Niranjan      |

In admin **Optimize**, Habeeb shows only **1 trip at 05:30 and 1 at 07:00** — the two 05:30 requests were silently combined into one.

## Why this happens

`src/lib/tripPlanning.ts` runs two passes:

1. `groupWorkersByAreaAndTime` — groups by **zone + time slot**.
   - AL RAFFA → Zone 4, NADD AL SHEBA → Zone 3. Two separate groups. ✅
2. `mergeNearbyTrips` — for any group with utilization < 70%, it merges with **any other same-time-slot group** as long as combined workers ≤ 12 and neither is the Al Quoz Hub.
   - Both 05:30 groups have 2 workers each (2 / 13 ≈ 15%) → inefficient → **auto-merged into one "Zone 4 + Zone 3" trip**.

The merger ignores the fact that the engineer already picked specific vehicles/drivers per trip. The workers still appear (nothing is lost), but they're stacked onto a single trip card, so it looks like one of Habeeb's trips vanished.

## The fix

Change `mergeNearbyTrips` so it **never merges two groups when either side carries an engineer-specified vehicle number or driver name that differs from the other side**. Engineer intent wins over utilization optimization.

Rules after the fix:
- Same requested vehicle **and** same requested driver → allowed to merge (still one physical trip).
- Different requested vehicle **or** different requested driver → keep as separate trips, even if inefficient.
- No engineer selection on either side → current behavior (merge if it fits).
- Hub-Al Quoz exclusion stays.

Also add a small "Requested separately by engineer" hint on trip cards that were kept apart because of this rule, so dispatchers understand why utilization looks low.

## Files to change

- `src/lib/tripPlanning.ts` — update `mergeNearbyTrips` with the compatibility check (compare top `requestedVehicleNumber` and `requestedDriver` per group).
- `src/pages/TripPlanning.tsx` — show the "kept separate — engineer request" badge on trip cards in the Optimize step.

## Out of scope

- No DB changes.
- No change to zone clustering (Zone 3 vs Zone 4 stays as-is).
- No change to Hub / Al Quoz behavior.

## Verification

After the change, reload Optimize for 2026-07-16 → Habeeb should show **3 trip cards** (AL RAFFA 05:30, NADD AL SHEBA 05:30, MUHAISNAH FOURTH 07:00), each on K 41732.
