export type ProjectType = 'LPG' | 'Fire Fighting' | 'Small Job' | 'AMC';
export type ProjectStatus = 'Active' | 'Scheduled' | 'Completed' | 'On Hold';
export type Priority = 'High' | 'Medium' | 'Low';
export type VehicleStatus = 'Active' | 'Idle' | 'Maintenance';
export type WorkerStatus = 'On Site' | 'Available' | 'Off Duty';

export interface Project {
  id: string;
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
}

export interface Vehicle {
  id: string;
  number: string;
  type: string;
  capacity: number;
  status: VehicleStatus;
  driver: string;
  utilization: number;
  fuelLevel: number;
  currentRoute: string;
}

export interface Worker {
  id: string;
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

export const projects: Project[] = [];

export const vehicles: Vehicle[];

export const workers: Worker[] = [];

export const workers: Worker[] = [
  { id: 'WK-001', name: 'Anil Thorat', role: 'Site Engineer', department: 'LPG', skills: ['Pipe Fitting', 'Welding', 'Testing'], status: 'On Site', currentSite: 'Ambuja Tower', phone: '+91 98765 43210' },
  { id: 'WK-002', name: 'Sunil Gaikwad', role: 'Technician', department: 'Fire Fighting', skills: ['Sprinkler Systems', 'Alarm Installation'], status: 'On Site', currentSite: 'Phoenix Mall', phone: '+91 98765 43211' },
  { id: 'WK-003', name: 'Kiran Jadhav', role: 'Helper', department: 'LPG', skills: ['Pipe Fitting'], status: 'Available', currentSite: '—', phone: '+91 98765 43212' },
  { id: 'WK-004', name: 'Rahul Mane', role: 'Technician', department: 'AMC', skills: ['Maintenance', 'Testing', 'Documentation'], status: 'On Site', currentSite: 'Oberoi Realty', phone: '+91 98765 43213' },
  { id: 'WK-005', name: 'Sachin Pawar', role: 'Welder', department: 'LPG', skills: ['Welding', 'Fabrication'], status: 'Off Duty', currentSite: '—', phone: '+91 98765 43214' },
  { id: 'WK-006', name: 'Vikas Shinde', role: 'Site Engineer', department: 'Fire Fighting', skills: ['Fire Systems', 'Hydraulics', 'Testing'], status: 'On Site', currentSite: 'Phoenix Mall', phone: '+91 98765 43215' },
  { id: 'WK-007', name: 'Ganesh Bhosle', role: 'Helper', department: 'Small Jobs', skills: ['General', 'Pipe Fitting'], status: 'Available', currentSite: '—', phone: '+91 98765 43216' },
  { id: 'WK-008', name: 'Pratik Nikam', role: 'Technician', department: 'Fire Fighting', skills: ['Alarm Systems', 'Wiring'], status: 'On Site', currentSite: 'Phoenix Mall', phone: '+91 98765 43217' },
];

export const kpis: KPI[] = [
  { label: 'Active Projects', value: '12', change: 8, trend: 'up' },
  { label: 'Vehicle Utilization', value: '78%', change: 5, trend: 'up' },
  { label: 'Workers Deployed', value: '34/48', change: -3, trend: 'down' },
  { label: 'On-Time Delivery', value: '92%', change: 2, trend: 'up' },
];

export const scheduleData = [
  { day: 'Mon', projects: 8, workers: 32, vehicles: 4 },
  { day: 'Tue', projects: 10, workers: 38, vehicles: 5 },
  { day: 'Wed', projects: 9, workers: 35, vehicles: 5 },
  { day: 'Thu', projects: 11, workers: 40, vehicles: 5 },
  { day: 'Fri', projects: 10, workers: 37, vehicles: 4 },
  { day: 'Sat', projects: 6, workers: 22, vehicles: 3 },
];

export const utilizationData = [
  { name: 'Jan', vehicles: 72, workers: 68 },
  { name: 'Feb', vehicles: 78, workers: 75 },
  { name: 'Mar', vehicles: 65, workers: 70 },
  { name: 'Apr', vehicles: 82, workers: 80 },
  { name: 'May', vehicles: 88, workers: 85 },
  { name: 'Jun', vehicles: 75, workers: 72 },
];
