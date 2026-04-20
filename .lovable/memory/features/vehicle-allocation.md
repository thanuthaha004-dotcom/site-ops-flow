---
name: Vehicle Allocation Rules
description: How vehicles/drivers are assigned to trips, including Al Quoz Camp as morning starting point
type: feature
---
## Allocation rules

1. **First trip of the day per driver** → always **Starts from Al Quoz Central Labour Camp**.
   - All vehicles are parked at Al Quoz Camp overnight, so trip #1 of each driver originates there regardless of pickup zone.
   - Shown in the UI as a small badge "Starts from Al Quoz Camp" on the relevant trip card in Smart Trip Planning > Optimize step.
   - Logic: for each driver, the trip with the earliest TIME_SLOTS index is tagged.

2. **Subsequent trips** → driver/vehicle is assigned **manually** by the dispatcher in the Optimize step.
   - The system shows all available drivers in a dropdown; dispatcher picks based on the live locator/GPS app (external, not yet integrated).
   - Default driver per area (from `driver_area_defaults` table) is suggested but overridable.

3. **Future (Phase B)** — when the locator/GPS app is integrated:
   - Replace manual selection with auto-pick by actual nearest vehicle.
   - Use zone proximity fallback chain (Zone 1↔2, Zone 2↔1&4, Zone 3↔4, Zone 4↔3&2; Hub→any; Sharjah/Ajman→Zone 3 then 4; Al Ain→Zone 3; Abu Dhabi→Zone 1 then 2).
   - Flag a fallback warning ONLY if a different-zone vehicle was assigned **even though** a same-zone vehicle was available.

**Why**: Until live GPS is wired up, manual assignment is more reliable than guessing. The "Starts from Al Quoz Camp" badge gives the dispatcher confidence that the first trip's logistics are correct.
