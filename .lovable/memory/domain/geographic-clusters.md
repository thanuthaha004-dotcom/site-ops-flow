---
name: Geographic Zones & Driver Allocation
description: Dubai 4-zone clustering rules used by trip planning to merge nearby sites at the same time slot
type: feature
---
## Dubai Zone Definitions (used by `getAreaCluster` in src/lib/tripPlanning.ts)

- **Zone 1**: JAFZA, DIP, DIC, Dubai South, Jumeirah Village (JVC/JVT), Production City (IMPZ), Sports City, Barsha South, Arjan, Furjan, Motor City
- **Zone 2**: Jebel Ali, Dubai Marina, Emirates Hills, Discovery Gardens, Al Khail, JLT, Internet City, Palm Jumeirah, Jumeirah, Umm Suqeim, Al Barsha
- **Zone 3**: Ras Al Khor, Majan, Nad Al Sheba, Nad Al Hamar, Muhaisnah, Khawaneej, Qusais/Al Qusais, Head Office, Warqa, Warsan, Silicon Oasis (DSO)
- **Zone 4**: Al Safa, Bur Dubai, Karama, Deira, Garhoud, Mamzar, Al Nahda, DAFZA, International City
- **Hub - Al Quoz Camp**: Al Quoz Labour Camp — central hub, **never auto-merged** with any zone (kept as own trip)
- **Sharjah / Ajman / Al Ain / Abu Dhabi**: kept as separate zones (outlying, dispatcher visibility)

## Merging rules
- Workers in the **same zone + same time slot** are grouped onto one trip.
- Inefficient trips (<70% utilization) may merge with another zone IF combined headcount ≤ 12 AND neither side is the Hub.
- The Hub stays its own trip even if utilization is low.

**Why**: Reduces total trips while keeping long-distance routes (Sharjah, Abu Dhabi) visible and isolating Al Quoz Camp pickups.
