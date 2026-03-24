export type ProjectType = 'LPG' | 'Fire Fighting' | 'Small Job' | 'AMC Gas' | 'AMC Fire';
export type WorkType = 'Material Delivery' | 'Pipe Installation' | 'Kitchen Installation' | 'Detection System' | 'Testing' | 'Snag Work' | 'DCD Inspection' | 'Handing Over';
export type ProjectStatus = 'Active' | 'Scheduled' | 'Completed' | 'On Hold';
export type Priority = 'High' | 'Medium' | 'Low';
export type VehicleStatus = 'Active' | 'Idle' | 'Maintenance';
export type WorkerStatus = 'On Site' | 'Available' | 'Off Duty';

export interface Project {
  id: string;
  code: string;
  name: string;
  type: ProjectType;
  site: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  endDate: string;
  progress: number;
  workersAssigned: number;
  workersRequired: number;
  engineer: string;
  workerNames: string[];
  workType: string;
}

export interface Vehicle {
  id: string;
  number: string;
  type: string;
  brand: string;
  department: string;
  capacity: number;
  status: VehicleStatus;
  driver: string;
  utilization: number;
  fuelLevel: number;
  currentRoute: string;
}

export interface Worker {
  id: string;
  staffCode: string;
  name: string;
  role: string;
  department: string;
  skills: string[];
  status: WorkerStatus;
  currentSite: string;
  phone: string;
}

export interface KPI {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

export const kpis: KPI[] = [
  { label: 'Active Projects', value: '0', change: 0, trend: 'neutral' },
  { label: 'Vehicle Utilization', value: '0%', change: 0, trend: 'neutral' },
  { label: 'Workers Deployed', value: '0/0', change: 0, trend: 'neutral' },
  { label: 'On-Time Delivery', value: '0%', change: 0, trend: 'neutral' },
];

export const scheduleData = [
  { day: 'Mon', projects: 0, workers: 0, vehicles: 0 },
  { day: 'Tue', projects: 0, workers: 0, vehicles: 0 },
  { day: 'Wed', projects: 0, workers: 0, vehicles: 0 },
  { day: 'Thu', projects: 0, workers: 0, vehicles: 0 },
  { day: 'Fri', projects: 0, workers: 0, vehicles: 0 },
  { day: 'Sat', projects: 0, workers: 0, vehicles: 0 },
];

export const utilizationData = [
  { name: 'Jan', vehicles: 0, workers: 0 },
  { name: 'Feb', vehicles: 0, workers: 0 },
  { name: 'Mar', vehicles: 0, workers: 0 },
  { name: 'Apr', vehicles: 0, workers: 0 },
  { name: 'May', vehicles: 0, workers: 0 },
  { name: 'Jun', vehicles: 0, workers: 0 },
];
