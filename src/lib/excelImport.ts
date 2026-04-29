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
    staffCode: r['staffCode'] || r['Staff Code'] || r['staff_code'] || r['StaffCode'] || r['STAFF CODE'] || r['Code'] || r['code'] || '',
    name: r['name'] || r['Name'] || r['Worker Name'] || r['Full Name'] || r['full_name'] || r['FullName'] || r['FULL NAME'] || r['worker_name'] || '',
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
    driver: r['driver'] || r['Driver'] || r['Driver Name'] || r['driver name'] || r['DriverName'] || r['DRIVER'] || '',
    utilization: Number(r['utilization'] || r['Utilization'] || 0),
    fuelLevel: Number(r['fuelLevel'] || r['Fuel Level'] || r['fuel'] || 100),
    currentRoute: r['currentRoute'] || r['Current Route'] || r['Route'] || '—',
  }));
}

// ============= Trip Request bulk upload =============

export type TripRequestRow = {
  project: string;
  workers: string[];
  start_time: string;
  end_time: string;
  pickup_location: string;
  vehicle_number: string;
  driver_name: string;
  notes: string;
  execution_order?: number;
};

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    if (r[k] !== undefined && String(r[k]).trim() !== '') return String(r[k]).trim();
  }
  return '';
};

// Excel time cells can come back as a fractional day number (0.5 = 12:00).
const normalizeTime = (raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0 && n < 1) {
    const totalMin = Math.round(n * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  return v;
};

export async function parseTripRequestsExcel(file: File): Promise<TripRequestRow[]> {
  const rows = await readSheet(file);
  return rows
    .map((r, i): TripRequestRow => ({
      project: pick(r, 'Project', 'project', 'Project Name', 'Project Code', 'Code'),
      workers: pick(r, 'Workers', 'workers', 'Worker Names', 'Worker Name')
        .split(',').map(s => s.trim()).filter(Boolean),
      start_time: normalizeTime(pick(r, 'Start Time', 'start_time', 'StartTime', 'Start')),
      end_time: normalizeTime(pick(r, 'End Time', 'end_time', 'EndTime', 'End')),
      pickup_location: pick(r, 'Pickup Location', 'pickup_location', 'Pickup', 'Pickup Point'),
      vehicle_number: pick(r, 'Vehicle Number', 'vehicle_number', 'Vehicle'),
      driver_name: pick(r, 'Driver', 'driver', 'Driver Name', 'driver_name'),
      notes: pick(r, 'Notes', 'notes', 'Remarks'),
      execution_order: Number(pick(r, 'Execution Order', 'execution_order', 'Order', 'Sequence')) || (i + 1),
    }))
    .filter(r => r.project || r.workers.length > 0 || r.notes);
}

export function downloadTripRequestsTemplate() {
  const headers = [
    'Project', 'Workers', 'Start Time', 'End Time',
    'Pickup Location', 'Vehicle Number', 'Driver', 'Notes', 'Execution Order',
  ];
  const example = [
    {
      'Project': 'Ambuja Tower LPG',
      'Workers': 'Ahmed Khan, Ravi Kumar, John Doe',
      'Start Time': '07:00',
      'End Time': '16:00',
      'Pickup Location': 'Al Quoz Labour Camp',
      'Vehicle Number': 'DXB-12345',
      'Driver': 'Saeed Ullah',
      'Notes': 'Pipe installation phase 2',
      'Execution Order': 1,
    },
    {
      'Project': 'Marina Heights Fire Fighting',
      'Workers': 'Suresh, Imran',
      'Start Time': '08:30',
      'End Time': '17:00',
      'Pickup Location': 'Al Quoz Labour Camp',
      'Vehicle Number': '',
      'Driver': '',
      'Notes': 'Detection system testing',
      'Execution Order': 2,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(example, { header: headers });
  ws['!cols'] = [
    { wch: 28 }, { wch: 36 }, { wch: 11 }, { wch: 11 },
    { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 32 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trip Requests');

  const instructions = [
    ['Field', 'Required', 'Description'],
    ['Project', 'Yes', 'Exact project name or code (must exist in the system).'],
    ['Workers', 'Yes*', 'Comma-separated worker names. *Required unless Notes explains a solo trip.'],
    ['Start Time', 'No', 'Format HH:MM (24-hour), e.g. 07:00.'],
    ['End Time', 'No', 'Format HH:MM (24-hour), e.g. 16:00. Must be after Start Time.'],
    ['Pickup Location', 'No', 'Defaults to "Al Quoz Labour Camp" if empty.'],
    ['Vehicle Number', 'No', 'Optional preferred vehicle. Dispatcher may reassign.'],
    ['Driver', 'No', 'Auto-fills from vehicle if left blank.'],
    ['Notes', 'No', 'Required only when no workers are listed (reason for solo trip).'],
    ['Execution Order', 'No', 'Sequence number; lower runs first. Defaults to row order.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instructions);
  ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  XLSX.writeFile(wb, 'trip-requests-template.xlsx');
}
