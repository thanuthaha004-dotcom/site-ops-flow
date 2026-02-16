import { projects as mockProjects, workers as mockWorkers, vehicles as mockVehicles, type Project, type Worker, type Vehicle } from '@/data/mockData';

const KEYS = {
  projects: 'app_projects',
  workers: 'app_workers',
  vehicles: 'app_vehicles',
} as const;

function getItems<T>(key: string, fallback: T[]): T[] {
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return fallback;
}

function setItems<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function getProjects(): Project[] {
  return getItems<Project>(KEYS.projects, mockProjects);
}
export function saveProjects(items: Project[]) {
  setItems(KEYS.projects, items);
}
export function addProject(item: Project) {
  const all = getProjects();
  all.push(item);
  saveProjects(all);
  return all;
}
export function deleteProject(id: string) {
  const all = getProjects().filter(p => p.id !== id);
  saveProjects(all);
  return all;
}

export function getWorkers(): Worker[] {
  return getItems<Worker>(KEYS.workers, mockWorkers);
}
export function saveWorkers(items: Worker[]) {
  setItems(KEYS.workers, items);
}
export function addWorker(item: Worker) {
  const all = getWorkers();
  all.push(item);
  saveWorkers(all);
  return all;
}
export function deleteWorker(id: string) {
  const all = getWorkers().filter(w => w.id !== id);
  saveWorkers(all);
  return all;
}

export function getVehicles(): Vehicle[] {
  return getItems<Vehicle>(KEYS.vehicles, mockVehicles);
}
export function saveVehicles(items: Vehicle[]) {
  setItems(KEYS.vehicles, items);
}
export function addVehicle(item: Vehicle) {
  const all = getVehicles();
  all.push(item);
  saveVehicles(all);
  return all;
}
export function deleteVehicle(id: string) {
  const all = getVehicles().filter(v => v.id !== id);
  saveVehicles(all);
  return all;
}
