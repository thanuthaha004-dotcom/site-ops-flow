import { supabase } from '@/integrations/supabase/client';
import type { Project, Vehicle, Worker, ProjectType, ProjectStatus, Priority, VehicleStatus, WorkerStatus } from '@/data/mockData';

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

export async function deleteVehicleDb(id: string) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

// ── Workers ──

function rowToWorker(r: any): Worker {
  return {
    id: r.id,
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

export async function deleteWorkerDb(id: string) {
  const { error } = await supabase.from('workers').delete().eq('id', id);
  if (error) throw error;
}
