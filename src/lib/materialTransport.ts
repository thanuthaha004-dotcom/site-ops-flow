// Helpers for the [MATERIAL:PICKUP|DELIVERY|DIRECT] tag that Material Transport
// trips encode into the notes field of daily_trip_requests / trip_schedules.

export const MATERIAL_TAG_RE = /^\s*\[MATERIAL:(PICKUP|DELIVERY|DIRECT)\]\s*/i;

export type MaterialDirection = 'pickup' | 'delivery' | 'direct';

export interface MaterialInfo {
  isMaterial: boolean;
  direction: MaterialDirection | null;
  cleanNotes: string;
}

export function parseMaterialNotes(notes: string | null | undefined): MaterialInfo {
  const raw = notes || '';
  const m = raw.match(MATERIAL_TAG_RE);
  if (!m) return { isMaterial: false, direction: null, cleanNotes: raw };
  const tag = m[1].toUpperCase();
  const direction: MaterialDirection =
    tag === 'DELIVERY' ? 'delivery' : tag === 'DIRECT' ? 'direct' : 'pickup';
  return {
    isMaterial: true,
    direction,
    cleanNotes: raw.replace(MATERIAL_TAG_RE, '').trim(),
  };
}

export function directionLabel(dir: MaterialDirection | null): string {
  if (dir === 'delivery') return 'Material Delivery';
  if (dir === 'direct') return 'Direct Delivery';
  if (dir === 'pickup') return 'Material Pickup';
  return 'Material';
}
