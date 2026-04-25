import { supabase } from '@/integrations/supabase/client';
import type { Project, Vehicle, Worker, Engineer, ProjectType, ProjectStatus, Priority, VehicleStatus, WorkerStatus } from '@/data/mockData';

// ── Projects ──

function rowToProject(r: any): Project {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type as ProjectType,
    site: r.site,
    status: r.status as ProjectStatus,
    priority: r.priority as Priority,
    startDate: r.start_date,
    endDate: r.end_date,
    progress: r.progress,
    workersAssigned: r.workers_assigned,
    workersRequired: r.workers_required,
    engineer: r.engineer,
    workerNames: r.worker_names || [],
    workType: r.work_type || '',
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToProject);
}

export async function insertProject(p: Omit<Project, 'id'>): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert({
    code: p.code,
    name: p.name,
    type: p.type,
    site: p.site,
    status: p.status,
    priority: p.priority,
    start_date: p.startDate,
    end_date: p.endDate,
    progress: p.progress,
    workers_assigned: p.workersAssigned,
    workers_required: p.workersRequired,
    engineer: p.engineer,
    worker_names: p.workerNames,
    work_type: p.workType || '',
  }).select().single();
  if (error) throw error;
  return rowToProject(data);
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.code !== undefined) dbUpdates.code = updates.code;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.site !== undefined) dbUpdates.site = updates.site;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
  if (updates.workersAssigned !== undefined) dbUpdates.workers_assigned = updates.workersAssigned;
  if (updates.workersRequired !== undefined) dbUpdates.workers_required = updates.workersRequired;
  if (updates.engineer !== undefined) dbUpdates.engineer = updates.engineer;
  if (updates.workerNames !== undefined) dbUpdates.worker_names = updates.workerNames;
  if (updates.workType !== undefined) dbUpdates.work_type = updates.workType;

  const { data, error } = await supabase.from('projects').update(dbUpdates).eq('id', id).select().single();
  if (error) throw error;
  return rowToProject(data);
}

export async function deleteProjectDb(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ── Vehicles ──

function rowToVehicle(r: any): Vehicle {
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    brand: r.brand,
    department: r.department,
    capacity: r.capacity,
    status: r.status as VehicleStatus,
    driver: r.driver,
    driverUserId: r.driver_user_id ?? null,
    utilization: r.utilization,
    fuelLevel: r.fuel_level,
    currentRoute: r.current_route,
  };
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToVehicle);
}

export async function insertVehicle(v: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const { data, error } = await supabase.from('vehicles').insert({
    number: v.number,
    type: v.type,
    brand: v.brand,
    department: v.department,
    capacity: v.capacity,
    status: v.status,
    driver: v.driver,
    utilization: v.utilization,
    fuel_level: v.fuelLevel,
    current_route: v.currentRoute,
  }).select().single();
  if (error) throw error;
  return rowToVehicle(data);
}

export async function updateVehicleDb(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  const dbUpdates: any = {};
  if (updates.number !== undefined) dbUpdates.number = updates.number;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
  if (updates.department !== undefined) dbUpdates.department = updates.department;
  if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.driver !== undefined) dbUpdates.driver = updates.driver;
  if (updates.driverUserId !== undefined) dbUpdates.driver_user_id = updates.driverUserId;
  if (updates.utilization !== undefined) dbUpdates.utilization = updates.utilization;
  if (updates.fuelLevel !== undefined) dbUpdates.fuel_level = updates.fuelLevel;
  if (updates.currentRoute !== undefined) dbUpdates.current_route = updates.currentRoute;

  const { data, error } = await supabase.from('vehicles').update(dbUpdates).eq('id', id).select().single();
  if (error) throw error;
  return rowToVehicle(data);
}

export async function deleteVehicleDb(id: string) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

// ── Workers ──

function rowToWorker(r: any): Worker {
  return {
    id: r.id,
    staffCode: r.staff_code || '',
    name: r.name,
    role: r.role,
    department: r.department,
    skills: r.skills || [],
    status: r.status as WorkerStatus,
    currentSite: r.current_site,
    phone: r.phone,
  };
}

export async function fetchWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase.from('workers').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToWorker);
}

export async function insertWorker(w: Omit<Worker, 'id'>): Promise<Worker> {
  const { data, error } = await supabase.from('workers').insert({
    staff_code: w.staffCode || '',
    name: w.name,
    role: w.role,
    department: w.department,
    skills: w.skills,
    status: w.status,
    current_site: w.currentSite,
    phone: w.phone,
  }).select().single();
  if (error) throw error;
  return rowToWorker(data);
}

export async function updateWorkerDb(id: string, updates: Partial<Worker>): Promise<Worker> {
  const dbUpdates: any = {};
  if (updates.staffCode !== undefined) dbUpdates.staff_code = updates.staffCode;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.department !== undefined) dbUpdates.department = updates.department;
  if (updates.skills !== undefined) dbUpdates.skills = updates.skills;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.currentSite !== undefined) dbUpdates.current_site = updates.currentSite;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

  const { data, error } = await supabase.from('workers').update(dbUpdates).eq('id', id).select().single();
  if (error) throw error;
  return rowToWorker(data);
}

export async function deleteWorkerDb(id: string) {
  const { error } = await supabase.from('workers').delete().eq('id', id);
  if (error) throw error;
}

// ── Engineers ──

export async function fetchEngineers(): Promise<Engineer[]> {
  const { data, error } = await supabase.from('engineers').select('*').order('name');
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    department: r.department || '',
    phone: r.phone || '',
  }));
}

export async function insertEngineer(e: Omit<Engineer, 'id'>): Promise<Engineer> {
  const { data, error } = await supabase.from('engineers').insert({
    name: e.name,
    department: e.department,
    phone: e.phone || '',
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, department: data.department, phone: data.phone || '' };
}

export async function updateEngineerDb(id: string, updates: Partial<Engineer>): Promise<Engineer> {
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.department !== undefined) dbUpdates.department = updates.department;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  const { data, error } = await supabase.from('engineers').update(dbUpdates).eq('id', id).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, department: data.department, phone: data.phone || '' };
}

export async function deleteEngineerDb(id: string) {
  const { error } = await supabase.from('engineers').delete().eq('id', id);
  if (error) throw error;
}

// ── Trip Schedules ──

export interface TripScheduleRow {
  id: string;
  trip_date: string;
  worker_name: string;
  site: string;
  department: string;
  time_slot: string;
  start_time: string | null;
  end_time: string | null;
  urgent: boolean;
  project_id: string | null;
  project_name: string;
  engineer_name: string;
  pickup_location: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  status: string;
  notes: string;
}

export async function fetchTripsByDate(date: string): Promise<TripScheduleRow[]> {
  const { data, error } = await supabase
    .from('trip_schedules')
    .select('*')
    .eq('trip_date', date)
    .order('time_slot');
  if (error) throw error;
  return (data || []) as TripScheduleRow[];
}

export async function saveTripAssignments(
  date: string,
  assignments: Omit<TripScheduleRow, 'id' | 'status'>[]
): Promise<TripScheduleRow[]> {
  // Delete existing for this date first
  await supabase.from('trip_schedules').delete().eq('trip_date', date);

  if (assignments.length === 0) return [];

  const rows = assignments.map(a => ({
    trip_date: date,
    worker_name: a.worker_name,
    site: a.site,
    department: a.department,
    time_slot: a.time_slot,
    start_time: a.start_time,
    end_time: a.end_time,
    urgent: a.urgent || false,
    project_id: a.project_id,
    project_name: a.project_name,
    engineer_name: a.engineer_name || '',
    pickup_location: a.pickup_location || 'Al Quoz Labour Camp',
    vehicle_type: a.vehicle_type,
    vehicle_number: a.vehicle_number,
    notes: a.notes || '',
    status: 'assigned',
  }));

  const { data, error } = await supabase
    .from('trip_schedules')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data || []) as TripScheduleRow[];
}

export async function updateTripStatus(id: string, status: string) {
  const { error } = await supabase
    .from('trip_schedules')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function getRecentTripDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('trip_schedules')
    .select('trip_date')
    .order('trip_date', { ascending: false })
    .limit(100);
  if (error) throw error;
  const unique = [...new Set((data || []).map((r: any) => r.trip_date))];
  return unique.slice(0, 30);
}

// ── Driver-Area Defaults ──

export interface DriverAreaDefault {
  id: string;
  driver_name: string;
  area: string;
}

export async function fetchDriverAreaDefaults(): Promise<DriverAreaDefault[]> {
  const { data, error } = await supabase
    .from('driver_area_defaults')
    .select('*')
    .order('driver_name');
  if (error) throw error;
  return (data || []) as DriverAreaDefault[];
}

export async function upsertDriverAreaDefaults(driver_name: string, areas: string[]): Promise<void> {
  // Remove existing for this driver
  await supabase.from('driver_area_defaults').delete().eq('driver_name', driver_name);
  if (areas.length === 0) return;
  const rows = areas.map(area => ({ driver_name, area }));
  const { error } = await supabase.from('driver_area_defaults').insert(rows);
  if (error) throw error;
}

export async function deleteDriverAreaDefault(id: string): Promise<void> {
  const { error } = await supabase.from('driver_area_defaults').delete().eq('id', id);
  if (error) throw error;
}
