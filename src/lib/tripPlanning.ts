import type { Vehicle } from '@/data/mockData';
import { getVehicles } from '@/lib/localStorage';

export interface TripWorker {
  id: string;
  name: string;
  site: string;
  department: string;
  timeSlot: string;
  urgent?: boolean;
}

export interface TripGroup {
  id: string;
  area: string;
  sites: string[];
  workers: TripWorker[];
  timeSlot: string;
  suggestedVehicle: SuggestedVehicle | null;
  status: 'pending' | 'optimized' | 'dispatched';
  utilization: number;
  isInefficient: boolean;
  isUrgent: boolean;
  merged?: boolean;
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

export const TIME_SLOTS = ['5:30 AM', '7:30 AM', '9:30 AM'];
export const MIN_UTILIZATION = 0.7;

// Dubai area clusters
const AREA_CLUSTERS: Record<string, string[]> = {
  'Al Quoz': ['AL QUOZ', 'AL QOUZ', 'AL QOZ'],
  'DIP': ['DIP', 'SHAJRAT DIP', 'DUBAI INVESTMENT PARK'],
  'Jebel Ali': ['JABEL ALI', 'JEBEL ALI'],
  'Bur Dubai': ['BUR DUBAI'],
  'Deira': ['DEIRA', 'GARHOUD', 'AL HALLAB GARHOUD'],
  'DAFZA': ['DAFZA'],
  'Al Quasis': ['AL QUASIS', 'QUSAIS', 'QUASIS'],
  'Khawaneej': ['KHAWANEEJ'],
  'International City': ['INTERNATIONAL CITY', 'INT CITY'],
  'Silicon Oasis': ['DSO', 'SILICON OASIS'],
  'Other': [],
};

export function getAreaCluster(site: string): string {
  const upper = site.toUpperCase().trim();
  for (const [area, keywords] of Object.entries(AREA_CLUSTERS)) {
    if (area === 'Other') continue;
    if (keywords.some(k => upper.includes(k))) return area;
  }
  return site.trim() || 'Other';
}

export function suggestVehicleType(workerCount: number): { type: string; capacity: number } {
  if (workerCount <= 3) return { type: '5-seater', capacity: 5 };
  return { type: '13-seater', capacity: 13 };
}

export function findBestVehicle(
  workerCount: number,
  usedVehicleIds: Set<string>
): SuggestedVehicle | null {
  const vehicles = getVehicles();
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
    const vehicle = findBestVehicle(groupWorkers.length, usedVehicleIds);
    if (vehicle) usedVehicleIds.add(vehicle.id);

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
  if (hours < 6.5) return '5:30 AM';
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
