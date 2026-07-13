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
  trip_date: string;
  department: string;
  project: string;
  project_location: string;
  pickup_location: string;
  dropoff_location: string;
  workers: string[];
  start_time: string;
  end_time: string;
  engineer: string;
  vehicle_number: string;
  driver_name: string;
  notes: string;
  execution_order?: number;
};

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const pick = (r: Record<string, string>, ...keys: string[]) => {
  // Exact-match first
  for (const k of keys) {
    if (r[k] !== undefined && String(r[k]).trim() !== '') return String(r[k]).trim();
  }
  // Fuzzy match: normalize both header and alias (strip spaces/case/punctuation)
  const wanted = new Set(keys.map(normKey));
  for (const rk of Object.keys(r)) {
    if (wanted.has(normKey(rk)) && String(r[rk]).trim() !== '') {
      return String(r[rk]).trim();
    }
  }
  return '';
};

// Excel time cells can come back as a fractional day number (0.5 = 12:00),
// a plain "HH:MM", or a human string like "5.30 AM" / "5:30AM" / "17.00".
const normalizeTime = (raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';

  // Fractional day (Excel time serial)
  const n = Number(v);
  if (Number.isFinite(n) && n > 0 && n < 1) {
    const totalMin = Math.round(n * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // Match H, H:MM, H.MM, "5 30", optional AM/PM
  const m = v.match(/^(\d{1,2})[:.,\s]?(\d{2})?\s*([AaPp][Mm])?/);
  if (m) {
    let h = parseInt(m[1], 10);
    const mm = parseInt(m[2] || '0', 10);
    const ampm = (m[3] || '').toUpperCase();
    if (!Number.isFinite(h) || h < 0 || h > 23 || mm < 0 || mm > 59) return v;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  return v;
};

export async function parseTripRequestsExcel(file: File): Promise<TripRequestRow[]> {
  const rows = await readSheet(file);
  return rows
    .map((r, i): TripRequestRow => ({
      trip_date: pick(r, 'Trip Date', 'trip_date', 'Date'),
      department: pick(r, 'Department', 'department', 'Dept'),
      project: pick(r, 'Project Name', 'Project', 'project', 'Project Code', 'Code'),
      project_location: pick(r, 'Project Location', 'project_location', 'Site', 'Location'),
      pickup_location: pick(r, 'Pickup Location', 'pickup_location', 'Pickup', 'Pickup Point'),
      dropoff_location: pick(r, 'Drop-off Location', 'Dropoff Location', 'Drop Off Location', 'dropoff_location', 'Drop-off', 'Dropoff'),
      workers: pick(r, 'Passenger Details', 'Passengers', 'Workers', 'workers', 'Worker Names', 'Worker Name')
        .split(',').map(s => s.trim()).filter(Boolean),
      start_time: normalizeTime(pick(r, 'Pickup Time', 'Start Time', 'start_time', 'StartTime', 'Start')),
      end_time: normalizeTime(pick(r, 'End Time', 'end_time', 'EndTime', 'End', 'Drop-off Time', 'Dropoff Time')),
      engineer: pick(r, 'Engineer Information', 'Engineer', 'engineer', 'Engineer Name'),
      vehicle_number: pick(r, 'Vehicle Number', 'Vehicle No', 'Vehicle No.', 'Vehicle_No', 'VehicleNo', 'Vehicle #', 'vehicle_number', 'Vehicle', 'Vehicle Reg', 'Vehicle Registration', 'Reg No'),
      driver_name: pick(r, 'Driver Name', 'DriverName', 'Driver_Name', 'Driver', 'driver', 'driver_name', 'Assigned Driver'),
      notes: pick(r, 'Notes', 'notes', 'Remarks'),
      execution_order: Number(pick(r, 'Execution Order', 'execution_order', 'Order', 'Sequence')) || (i + 1),
    }))
    .filter(r => r.project || r.workers.length > 0 || r.notes);
}

export function downloadTripRequestsTemplate() {
  const headers = [
    'Trip Date', 'Department', 'Project Name', 'Project Location',
    'Pickup Location', 'Drop-off Location', 'Pickup Time', 'Passenger Details',
    'Engineer Information', 'Vehicle Number', 'Driver Name', 'Execution Order', 'Notes',
  ];
  const example = [
    {
      'Trip Date': '2026-04-29',
      'Department': 'LPG',
      'Project Name': 'Ambuja Tower LPG',
      'Project Location': 'Business Bay, Dubai',
      'Pickup Location': 'Al Quoz Labour Camp',
      'Drop-off Location': 'Ambuja Tower, Business Bay',
      'Pickup Time': '07:00',
      'Passenger Details': 'Ahmed Khan, Ravi Kumar, John Doe',
      'Engineer Information': 'Eng. Mohammed Ali',
      'Vehicle Number': 'DXB-12345',
      'Driver Name': 'Saeed Ullah',
      'Execution Order': 1,
      'Notes': 'Pipe installation phase 2',
    },
    {
      'Trip Date': '2026-04-29',
      'Department': 'Fire Fighting',
      'Project Name': 'Marina Heights Fire Fighting',
      'Project Location': 'Dubai Marina',
      'Pickup Location': 'Al Quoz Labour Camp',
      'Drop-off Location': 'Marina Heights Tower B',
      'Pickup Time': '08:30',
      'Passenger Details': 'Suresh, Imran',
      'Engineer Information': 'Eng. Rahul Verma',
      'Vehicle Number': '',
      'Driver Name': '',
      'Execution Order': 2,
      'Notes': 'Detection system testing',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(example, { header: headers });
  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 24 },
    { wch: 22 }, { wch: 26 }, { wch: 11 }, { wch: 36 },
    { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 32 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trip Requests');

  const instructions = [
    ['Field', 'Required', 'Description'],
    ['Trip Date', 'Yes', 'Date of the trip in YYYY-MM-DD format (e.g. 2026-04-29).'],
    ['Department', 'No', 'Department handling the work (LPG, Fire Fighting, AMC, etc.).'],
    ['Project Name', 'Yes', 'Exact project name or code (must exist in the system).'],
    ['Project Location', 'No', 'Site / area for the project. Auto-filled from project record if empty.'],
    ['Pickup Location', 'No', 'Defaults to "Al Quoz Labour Camp" if empty.'],
    ['Drop-off Location', 'No', 'Destination site. Defaults to the project location if empty.'],
    ['Pickup Time', 'No', 'Format HH:MM (24-hour), e.g. 07:00.'],
    ['Passenger Details', 'Yes*', 'Comma-separated worker names. *Required unless Notes explains a solo trip.'],
    ['Engineer Information', 'No', 'Engineer responsible for the trip / project.'],
    ['Vehicle Number', 'No', 'Optional preferred vehicle. Dispatcher may reassign.'],
    ['Driver Name', 'No', 'Auto-fills from vehicle if left blank.'],
    ['Execution Order', 'No', 'Sequence number; lower runs first. Defaults to row order.'],
    ['Notes', 'No', 'Required only when no passengers are listed (reason for solo trip).'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instructions);
  ws2['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 78 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  XLSX.writeFile(wb, 'trip-requests-template.xlsx');
}

