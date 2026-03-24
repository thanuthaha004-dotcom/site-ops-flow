import * as XLSX from 'xlsx';
import type { Project, Worker, Vehicle, ProjectType, ProjectStatus, Priority, VehicleStatus, WorkerStatus } from '@/data/mockData';

function readSheet(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function parseProjectsExcel(file: File): Promise<Project[]> {
  const rows = await readSheet(file);
  return rows.map((r, i) => ({
    id: r['id'] || r['ID'] || `PRJ-${String(i + 1).padStart(3, '0')}`,
    code: r['code'] || r['Code'] || r['Project Code'] || `PRJ-${String(i + 1).padStart(3, '0')}`,
    name: r['name'] || r['Name'] || r['Project Name'] || '',
    type: (r['type'] || r['Type'] || 'LPG') as ProjectType,
    site: r['site'] || r['Site'] || r['Location'] || '',
    status: (r['status'] || r['Status'] || 'Active') as ProjectStatus,
    priority: (r['priority'] || r['Priority'] || 'Medium') as Priority,
    startDate: r['startDate'] || r['Start Date'] || r['start_date'] || '',
    endDate: r['endDate'] || r['End Date'] || r['end_date'] || '',
    progress: Number(r['progress'] || r['Progress'] || 0),
    workersAssigned: Number(r['workersAssigned'] || r['Workers Assigned'] || 0),
    workersRequired: Number(r['workersRequired'] || r['Workers Required'] || 1),
    engineer: r['engineer'] || r['Engineer'] || '',
    workerNames: (r['workerNames'] || r['Worker Names'] || r['Workers'] || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    workType: r['workType'] || r['Work Type'] || r['work_type'] || '',
  }));
}

export async function parseWorkersExcel(file: File): Promise<Worker[]> {
  const rows = await readSheet(file);
  return rows.map((r, i) => ({
    id: r['id'] || r['ID'] || `WK-${String(i + 1).padStart(3, '0')}`,
    name: r['name'] || r['Name'] || r['Worker Name'] || '',
    role: r['role'] || r['Role'] || '',
    department: r['department'] || r['Department'] || '',
    skills: (r['skills'] || r['Skills'] || '').split(',').map(s => s.trim()).filter(Boolean),
    status: (r['status'] || r['Status'] || 'Available') as WorkerStatus,
    currentSite: r['currentSite'] || r['Current Site'] || r['Site'] || '—',
    phone: r['phone'] || r['Phone'] || '',
  }));
}

export async function parseVehiclesExcel(file: File): Promise<Vehicle[]> {
  const rows = await readSheet(file);
  return rows.map((r, i) => ({
    id: r['id'] || r['ID'] || `VH-${String(i + 1).padStart(3, '0')}`,
    number: r['number'] || r['Number'] || r['Vehicle Number'] || '',
    type: r['type'] || r['Type'] || 'Utility Van',
    brand: r['brand'] || r['Brand'] || r['Vehicle Brand'] || '',
    department: r['department'] || r['Department'] || '',
    capacity: Number(r['capacity'] || r['Capacity'] || 6),
    status: (r['status'] || r['Status'] || 'Idle') as VehicleStatus,
    driver: r['driver'] || r['Driver'] || '—',
    utilization: Number(r['utilization'] || r['Utilization'] || 0),
    fuelLevel: Number(r['fuelLevel'] || r['Fuel Level'] || r['fuel'] || 100),
    currentRoute: r['currentRoute'] || r['Current Route'] || r['Route'] || '—',
  }));
}
