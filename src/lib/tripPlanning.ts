import type { Vehicle } from '@/data/mockData';


export interface TripWorker {
  id: string;
  name: string;
  site: string;
  department: string;
  timeSlot: string;
  startTime?: string;
  endTime?: string;
  urgent?: boolean;
  /** Origin project for this worker (used to display project on driver portal). */
  projectId?: string | null;
  projectName?: string;
  /** Engineer who requested this worker for the trip. */
  engineerName?: string;
  /** Where the worker is picked up. Defaults to Al Quoz Labour Camp. */
  pickupLocation?: string;
  /** Notes from the engineer's request — shown to dispatcher and driver. */
  notes?: string;
  /** True when this row is a placeholder for a request with no personnel. */
  noPersonnel?: boolean;
  /** Vehicle number the engineer pre-selected on the request (dispatcher may override). */
  requestedVehicleNumber?: string | null;
  /** Driver name the engineer pre-selected on the request (dispatcher may override). */
  requestedDriver?: string | null;
}

export interface TripGroup {
  id: string;
  area: string;
  sites: string[];
  workers: TripWorker[];
  timeSlot: string;
  suggestedVehicle: SuggestedVehicle | null;
  status: 'pending' | 'optimized' | 'dispatched' | 'in_progress' | 'completed';
  utilization: number;
  isInefficient: boolean;
  isUrgent: boolean;
  merged?: boolean;
  /** Live tracking — populated from trip_schedules after dispatch. */
  startedAt?: string | null;
  completedAt?: string | null;
  liveTripId?: string | null;
}

export interface SuggestedVehicle {
  id: string;
  number: string;
  type: string;
  capacity: number;
  driver: string;
}

export interface TripStats {
  totalTrips: number;
  optimizedTrips: number;
  tripsSaved: number;
  avgUtilization: number;
  inefficientTrips: number;
}

export const TIME_SLOTS = ['5:30 AM', '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '9:30 AM'];
export const MIN_UTILIZATION = 0.7;

// Dubai zone clusters — workers in the same zone + same time slot get grouped onto one trip.
// Al Quoz Labour Camp = its own "Hub" (central, never auto-merged).
// Outlying emirates kept as separate zones for dispatcher visibility.
const AREA_CLUSTERS: Record<string, string[]> = {
  'Zone 1': [
    'JAFZA', 'DIP', 'DUBAI INVESTMENT PARK', 'SHAJRAT DIP', 'DIC', 'DUBAI INTERNET CITY',
    'DUBAI SOUTH', 'JUMEIRAH VILLAGE', 'JVC', 'JVT', 'PRODUCTION CITY', 'IMPZ',
    'SPORTS CITY', 'BARSHA SOUTH', 'ARJAN', 'FURJAN', 'MOTOR CITY',
  ],
  'Zone 2': [
    'JEBEL ALI', 'JABEL ALI', 'DUBAI MARINA', 'MARINA', 'EMIRATES HILLS',
    'DISCOVERY GARDENS', 'AL KHAIL', 'JLT', 'JUMEIRAH LAKE', 'INTERNET CITY',
    'PALM JUMEIRAH', 'PALM', 'JUMEIRAH', 'SAQEIM', 'UMM SUQEIM', 'AL BARSHA',
  ],
  'Zone 3': [
    'RAS AL KHOR', 'MAJAN', 'NAD AL SHAEBA', 'NAD AL SHEBA', 'NAD AL HAMAR',
    'MUHAISNAH', 'KHAWANEEJ', 'QUSAIS', 'QUASIS', 'AL QUSAIS', 'HEAD OFFICE',
    'WARQA', 'AL WARQA', 'WARSAN', 'SILICON OASIS', 'DSO',
  ],
  'Zone 4': [
    'AL SAFA', 'BUR DUBAI', 'KARAMA', 'DEIRA', 'GARHOUD', 'AL HALLAB GARHOUD',
    'MAMZAR', 'AL NAHDA', 'DAFZA', 'INTERNATIONAL CITY', 'INT CITY',
  ],
  'Hub - Al Quoz Camp': ['AL QUOZ', 'AL QOUZ', 'AL QOZ', 'LABOUR CAMP'],
  'Sharjah': ['SHARJAH'],
  'Ajman': ['AJMAN'],
  'Al Ain': ['AL AIN'],
  'Abu Dhabi': ['ABU DHABI', 'ABUDHABI'],
};

// Normalize a site string: uppercase, strip punctuation, collapse common suffixes
function normalizeSite(s: string): string {
  return s
    .toUpperCase()
    .replace(/[.,_\-/\\()]/g, ' ')
    .replace(/\b(STORE|BRANCH|BR|ST|SITE|CAMP SITE|LOCATION|LOC)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein-based similarity ratio (1 = identical, 0 = nothing in common).
// Better than Dice for short location names with 1–2 character typos.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

const FUZZY_THRESHOLD = 0.7;

export function getAreaCluster(site: string): string {
  const upper = normalizeSite(site);
  if (!upper) return 'Other';

  // 1. Exact substring match (fast path) — Hub first so "Al Quoz" doesn't match other rules
  for (const keyword of AREA_CLUSTERS['Hub - Al Quoz Camp']) {
    if (upper.includes(keyword)) return 'Hub - Al Quoz Camp';
  }
  for (const [area, keywords] of Object.entries(AREA_CLUSTERS)) {
    if (area === 'Hub - Al Quoz Camp') continue;
    if (keywords.some(k => upper.includes(k))) return area;
  }

  // 2. Fuzzy fallback — score every keyword against full input AND each token, pick best ≥ threshold.
  // This handles typos ("Jumeriah", "Jabel Ali") and noise around a known name ("Marina Walk" → MARINA).
  const tokens = upper.split(' ').filter(t => t.length >= 3);
  const candidates = [upper, ...tokens];
  let bestZone = '';
  let bestScore = 0;
  for (const [area, keywords] of Object.entries(AREA_CLUSTERS)) {
    for (const keyword of keywords) {
      for (const c of candidates) {
        const score = similarity(c, keyword);
        if (score > bestScore) {
          bestScore = score;
          bestZone = area;
        }
      }
    }
  }
  if (bestScore >= FUZZY_THRESHOLD) return bestZone;

  return site.trim() || 'Other';
}

export function suggestVehicleType(workerCount: number): { type: string; capacity: number } {
  if (workerCount <= 3) return { type: '5-seater', capacity: 5 };
  return { type: '13-seater', capacity: 13 };
}

let cachedVehicles: Vehicle[] = [];
export function setCachedVehicles(v: Vehicle[]) { cachedVehicles = v; }

export function findBestVehicle(
  workerCount: number,
  usedVehicleIds: Set<string>
): SuggestedVehicle | null {
  const vehicles = cachedVehicles;
  const available = vehicles.filter(
    v => v.status !== 'Maintenance' && !usedVehicleIds.has(v.id)
  );

  const suggestion = suggestVehicleType(workerCount);

  // Try to find a matching vehicle
  let best = available.find(v => v.capacity >= workerCount && v.capacity <= suggestion.capacity);
  if (!best) best = available.find(v => v.capacity >= workerCount);
  if (!best && available.length > 0) best = available[0];
  if (!best) return null;

  return {
    id: best.id,
    number: best.number,
    type: suggestion.type,
    capacity: suggestion.capacity,
    driver: best.driver,
  };
}

export function groupWorkersByAreaAndTime(workers: TripWorker[]): TripGroup[] {
  const groupMap = new Map<string, TripWorker[]>();

  workers.forEach(w => {
    const area = getAreaCluster(w.site);
    const key = `${area}__${w.timeSlot}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(w);
  });

  const usedVehicleIds = new Set<string>();
  const groups: TripGroup[] = [];

  groupMap.forEach((groupWorkers, key) => {
    const [area, timeSlot] = key.split('__');
    const sites = [...new Set(groupWorkers.map(w => w.site))];

    // Prefer engineer-selected vehicle. Rank requested vehicles by how many workers picked them,
    // then pick the first one that fits the group and is still free. This keeps auto-prefill
    // working even when a few workers in the group requested different vehicles.
    let vehicle: SuggestedVehicle | null = null;
    const vehicleCounts = new Map<string, number>();
    groupWorkers.forEach(w => {
      const n = (w.requestedVehicleNumber || '').trim();
      if (n) vehicleCounts.set(n, (vehicleCounts.get(n) || 0) + 1);
    });
    const rankedVehicleNums = [...vehicleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    for (const num of rankedVehicleNums) {
      const match = cachedVehicles.find(v => v.number === num);
      if (match && !usedVehicleIds.has(match.id) && match.capacity >= groupWorkers.length) {
        const suggestion = suggestVehicleType(groupWorkers.length);
        vehicle = { id: match.id, number: match.number, type: match.type || suggestion.type, capacity: match.capacity, driver: match.driver };
        break;
      }
    }
    // Even if capacity is short or vehicle is already used elsewhere, still prefill the top
    // requested number so the admin sees the engineer's choice and can adjust.
    if (!vehicle && rankedVehicleNums.length > 0) {
      const num = rankedVehicleNums[0];
      const match = cachedVehicles.find(v => v.number === num);
      const suggestion = suggestVehicleType(groupWorkers.length);
      if (match) {
        vehicle = { id: match.id, number: match.number, type: match.type || suggestion.type, capacity: match.capacity, driver: match.driver };
      } else {
        vehicle = { id: `req-${num}`, number: num, type: suggestion.type, capacity: suggestion.capacity, driver: '' };
      }
    }
    // Fall back to engineer-requested driver name only (no fleet match) so admin still sees the prefill.
    if (!vehicle) {
      const driverCounts = new Map<string, number>();
      groupWorkers.forEach(w => {
        const d = (w.requestedDriver || '').trim();
        if (d) driverCounts.set(d, (driverCounts.get(d) || 0) + 1);
      });
      const topDriver = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topDriver) {
        const suggestion = suggestVehicleType(groupWorkers.length);
        vehicle = { id: `req-${topDriver}`, number: '—', type: suggestion.type, capacity: suggestion.capacity, driver: topDriver };
      }
    }
    if (!vehicle) vehicle = findBestVehicle(groupWorkers.length, usedVehicleIds);
    if (vehicle && !vehicle.id.startsWith('req-')) usedVehicleIds.add(vehicle.id);

    // Overlay engineer-requested driver name when provided — engineer's choice wins over the
    // fleet's default driver, so admins see exactly what the engineer asked for.
    if (vehicle) {
      const driverCounts = new Map<string, number>();
      groupWorkers.forEach(w => {
        const d = (w.requestedDriver || '').trim();
        if (d) driverCounts.set(d, (driverCounts.get(d) || 0) + 1);
      });
      const topDriver = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topDriver) vehicle = { ...vehicle, driver: topDriver };
    }


    const capacity = vehicle?.capacity || suggestVehicleType(groupWorkers.length).capacity;
    const utilization = groupWorkers.length / capacity;
    const isUrgent = groupWorkers.some(w => w.urgent);

    groups.push({
      id: `TRP-${groups.length + 1}`.padStart(7, '0'),
      area,
      sites,
      workers: groupWorkers,
      timeSlot,
      suggestedVehicle: vehicle,
      status: 'pending',
      utilization,
      isInefficient: utilization < MIN_UTILIZATION && !isUrgent,
      isUrgent,
    });
  });

  return groups;
}

export function mergeNearbyTrips(groups: TripGroup[]): TripGroup[] {
  const result: TripGroup[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < groups.length; i++) {
    if (merged.has(i)) continue;

    let current = { ...groups[i], workers: [...groups[i].workers], sites: [...groups[i].sites] };

    for (let j = i + 1; j < groups.length; j++) {
      if (merged.has(j)) continue;
      if (groups[j].timeSlot !== current.timeSlot) continue;
      // Hub (Al Quoz Camp) stays its own trip — never auto-merge with zones
      if (current.area.startsWith('Hub') || groups[j].area.startsWith('Hub')) continue;

      // Merge if combined workers still fit in a 13-seater
      const combined = current.workers.length + groups[j].workers.length;
      if (combined <= 12) {
        current.workers.push(...groups[j].workers);
        current.sites = [...new Set([...current.sites, ...groups[j].sites])];
        current.area = `${current.area} + ${groups[j].area}`;
        current.merged = true;
        merged.add(j);
      }
    }

    // Recalculate after merge
    const suggestion = suggestVehicleType(current.workers.length);
    current.utilization = current.workers.length / suggestion.capacity;
    current.isInefficient = current.utilization < MIN_UTILIZATION && !current.isUrgent;

    result.push(current);
  }

  return result;
}

export function optimizeTrips(workers: TripWorker[]): { groups: TripGroup[]; stats: TripStats } {
  const initial = groupWorkersByAreaAndTime(workers);
  const inefficient = initial.filter(g => g.isInefficient);
  
  // Try merging inefficient ones
  const efficient = initial.filter(g => !g.isInefficient);
  const mergedInefficient = mergeNearbyTrips(inefficient);

  const optimized = [...efficient, ...mergedInefficient].map(g => ({
    ...g,
    status: 'optimized' as const,
  }));

  const stats: TripStats = {
    totalTrips: optimized.length,
    optimizedTrips: optimized.filter(g => g.merged).length,
    tripsSaved: initial.length - optimized.length,
    avgUtilization: optimized.length > 0
      ? Math.round((optimized.reduce((sum, g) => sum + g.utilization, 0) / optimized.length) * 100)
      : 0,
    inefficientTrips: optimized.filter(g => g.isInefficient).length,
  };

  return { groups: optimized, stats };
}

// Parse Excel time (fraction of day) to display string
export function excelTimeToString(val: number): string {
  if (val >= 1) val = val - Math.floor(val);
  const totalMinutes = Math.round(val * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function snapToTimeSlot(timeVal: number): string {
  const totalMinutes = Math.round((timeVal >= 1 ? timeVal - Math.floor(timeVal) : timeVal) * 24 * 60);
  const hours = totalMinutes / 60;
  if (hours < 5.75) return '5:30 AM';
  if (hours < 6.25) return '6:00 AM';
  if (hours < 6.75) return '6:30 AM';
  if (hours < 7.25) return '7:00 AM';
  if (hours < 8.5) return '7:30 AM';
  return '9:30 AM';
}

// Sample workers for demo
export function getSampleTripWorkers(): TripWorker[] {
  return [
    { id: 'TW-1', name: 'Amal', site: 'Bur Dubai', department: 'GAS', timeSlot: '5:30 AM' },
    { id: 'TW-2', name: 'Anas', site: 'Bur Dubai', department: 'GAS', timeSlot: '5:30 AM' },
    { id: 'TW-3', name: 'Shalam', site: 'Bur Dubai', department: 'GAS', timeSlot: '5:30 AM' },
    { id: 'TW-4', name: 'Chandaal', site: 'DAFZA', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-5', name: 'Sandeep', site: 'DAFZA', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-6', name: 'Vikram', site: 'DAFZA', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-7', name: 'Manooj', site: 'DAFZA', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-8', name: 'Rahul', site: 'DAFZA', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-9', name: 'Sameer', site: 'Jebel Ali', department: 'GAS', timeSlot: '5:30 AM' },
    { id: 'TW-10', name: 'Mukesh', site: 'Jebel Ali', department: 'GAS', timeSlot: '5:30 AM' },
    { id: 'TW-11', name: 'Ranjith', site: 'Al Quasis', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-12', name: 'Satish', site: 'Al Quasis', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-13', name: 'Asif Khan', site: 'Al Quasis', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-14', name: 'Noufal', site: 'Al Quasis', department: 'GAS', timeSlot: '7:30 AM' },
    { id: 'TW-15', name: 'Adhesh', site: 'Al Quoz', department: 'GAS', timeSlot: '9:30 AM' },
    { id: 'TW-16', name: 'Farooq', site: 'Al Quoz', department: 'GAS', timeSlot: '9:30 AM' },
  ];
}
