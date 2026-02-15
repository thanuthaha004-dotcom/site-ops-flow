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

export const projects: Project[] = [
  { id: 'PRJ-001', name: 'Ambuja Tower LPG Installation', type: 'LPG', site: 'Andheri East, Mumbai', status: 'Active', priority: 'High', startDate: '2026-02-01', endDate: '2026-03-15', progress: 65, workersAssigned: 8, workersRequired: 10, engineer: 'Rajesh Sharma' },
  { id: 'PRJ-002', name: 'Phoenix Mall Fire System', type: 'Fire Fighting', site: 'Lower Parel, Mumbai', status: 'Active', priority: 'High', startDate: '2026-01-15', endDate: '2026-04-30', progress: 40, workersAssigned: 12, workersRequired: 12, engineer: 'Amit Patel' },
  { id: 'PRJ-003', name: 'Oberoi Realty AMC Q1', type: 'AMC', site: 'Goregaon, Mumbai', status: 'Scheduled', priority: 'Medium', startDate: '2026-02-20', endDate: '2026-02-28', progress: 0, workersAssigned: 4, workersRequired: 6, engineer: 'Priya Desai' },
  { id: 'PRJ-004', name: 'Tech Park Gas Fitting', type: 'Small Job', site: 'Whitefield, Bangalore', status: 'Active', priority: 'Low', startDate: '2026-02-10', endDate: '2026-02-18', progress: 85, workersAssigned: 3, workersRequired: 3, engineer: 'Vikram Singh' },
  { id: 'PRJ-005', name: 'Hiranandani Complex Fire Safety', type: 'Fire Fighting', site: 'Powai, Mumbai', status: 'On Hold', priority: 'Medium', startDate: '2026-03-01', endDate: '2026-05-15', progress: 10, workersAssigned: 0, workersRequired: 15, engineer: 'Rajesh Sharma' },
  { id: 'PRJ-006', name: 'Lodha World Towers LPG', type: 'LPG', site: 'Worli, Mumbai', status: 'Completed', priority: 'High', startDate: '2025-12-01', endDate: '2026-02-10', progress: 100, workersAssigned: 0, workersRequired: 8, engineer: 'Amit Patel' },
];

export const vehicles: Vehicle[] = [
  { id: 'VH-001', number: 'MH-04-AB-1234', type: 'Utility Van', capacity: 8, status: 'Active', driver: 'Suresh Kumar', utilization: 87, fuelLevel: 65, currentRoute: 'Andheri → Lower Parel → Worli' },
  { id: 'VH-002', number: 'MH-04-CD-5678', type: 'Pickup Truck', capacity: 4, status: 'Active', driver: 'Ravi Patil', utilization: 72, fuelLevel: 40, currentRoute: 'Goregaon → Malad → Kandivali' },
  { id: 'VH-003', number: 'MH-04-EF-9012', type: 'Utility Van', capacity: 8, status: 'Idle', driver: 'Manoj Yadav', utilization: 45, fuelLevel: 90, currentRoute: '—' },
  { id: 'VH-004', number: 'MH-04-GH-3456', type: 'Heavy Truck', capacity: 12, status: 'Active', driver: 'Deepak Joshi', utilization: 91, fuelLevel: 30, currentRoute: 'Powai → Vikhroli → Bhandup' },
  { id: 'VH-005', number: 'KA-01-MN-7890', type: 'Utility Van', capacity: 6, status: 'Maintenance', driver: '—', utilization: 0, fuelLevel: 55, currentRoute: '—' },
];

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
