import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchEngineers } from '@/lib/supabaseData';
import type { Engineer } from '@/data/mockData';

interface Props {
  value: string;
  onChange: (name: string, department: string) => void;
}

export default function EngineerSelect({ value, onChange }: Props) {
  const [engineers, setEngineers] = useState<Engineer[]>([]);

  useEffect(() => {
    fetchEngineers().then(setEngineers).catch(() => {});
  }, []);

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const eng = engineers.find(e => e.name === v);
        onChange(v, eng?.department || '');
      }}
    >
      <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
      <SelectContent>
        {engineers.map(e => (
          <SelectItem key={e.id} value={e.name}>
            {e.name}{e.department ? ` — ${e.department}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
