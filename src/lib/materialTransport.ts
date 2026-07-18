// Helpers for the [MATERIAL:PICKUP|DELIVERY] tag that Material Transport
// trips encode into the notes field of daily_trip_requests / trip_schedules.

export const MATERIAL_TAG_RE = /^\s*\[MATERIAL:(PICKUP|DELIVERY)\]\s*/i;

export interface MaterialInfo {
  isMaterial: boolean;
  direction: 'pickup' | 'delivery' | null;
  cleanNotes: string;
}

export function parseMaterialNotes(notes: string | null | undefined): MaterialInfo {
  const raw = notes || '';
  const m = raw.match(MATERIAL_TAG_RE);
  if (!m) return { isMaterial: false, direction: null, cleanNotes: raw };
  return {
    isMaterial: true,
    direction: m[1].toUpperCase() === 'DELIVERY' ? 'delivery' : 'pickup',
    cleanNotes: raw.replace(MATERIAL_TAG_RE, '').trim(),
  };
}

export function directionLabel(dir: 'pickup' | 'delivery' | null): string {
  if (dir === 'delivery') return 'Material Delivery';
  if (dir === 'pickup') return 'Material Pickup';
  return 'Material';
}
