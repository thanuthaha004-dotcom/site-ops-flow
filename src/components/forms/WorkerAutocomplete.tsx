import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Worker } from '@/data/mockData';

interface Props {
  workforce: Worker[];
  excludeNames: string[];
  value: string;
  onChange: (v: string) => void;
  onAdd: (name: string) => void;
  placeholder?: string;
}

const MAX_RESULTS = 8;

export default function WorkerAutocomplete({
  workforce, excludeNames, value, onChange, onAdd, placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const excludeSet = useMemo(
    () => new Set(excludeNames.map(n => n.trim().toUpperCase())),
    [excludeNames]
  );

  const suggestions = useMemo(() => {
    const q = value.trim().toUpperCase();
    if (!q) return [];
    return workforce
      .filter(w => {
        if (excludeSet.has((w.name || '').trim().toUpperCase())) return false;
        const inName = (w.name || '').toUpperCase().includes(q);
        const inCode = (w.staffCode || '').toUpperCase().includes(q);
        return inName || inCode;
      })
      .slice(0, MAX_RESULTS);
  }, [workforce, excludeSet, value]);

  const exactMatch = useMemo(() => {
    const q = value.trim().toUpperCase();
    if (!q) return false;
    return workforce.some(w => (w.name || '').trim().toUpperCase() === q);
  }, [workforce, value]);

  const showCustomRow = value.trim().length > 0 && !exactMatch;
  const totalRows = suggestions.length + (showCustomRow ? 1 : 0);

  useEffect(() => { setHighlight(0); }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commit = (name: string) => {
    const raw = name.trim();
    if (!raw) return;
    onAdd(raw);
    onChange('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(totalRows - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && totalRows > 0 && highlight < suggestions.length) {
        commit(suggestions[highlight].name);
      } else {
        commit(value);
      }
    }
  };

  return (
    <div className="flex gap-2 mt-2 relative" ref={wrapRef}>
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'Search workforce or type a new name…'}
          className="w-full text-sm rounded-md border border-input bg-background px-3 py-2"
        />
        {open && totalRows > 0 && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border border-input bg-popover shadow-md max-h-64 overflow-y-auto">
            {suggestions.map((w, i) => (
              <button
                type="button"
                key={w.id}
                onMouseDown={(e) => { e.preventDefault(); commit(w.name); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm flex flex-col ${
                  i === highlight ? 'bg-accent/20' : 'hover:bg-accent/10'
                }`}
              >
                <span className="font-medium">{w.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {w.staffCode ? `${w.staffCode} · ` : ''}{w.department || w.role || '—'}
                </span>
              </button>
            ))}
            {showCustomRow && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); commit(value); }}
                onMouseEnter={() => setHighlight(suggestions.length)}
                className={`w-full text-left px-3 py-2 text-sm border-t border-border ${
                  highlight === suggestions.length ? 'bg-accent/20' : 'hover:bg-accent/10'
                }`}
              >
                <span className="text-muted-foreground">Add </span>
                <span className="font-medium">"{value.trim()}"</span>
                <span className="text-muted-foreground"> as custom name</span>
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => commit(value)}
        className="text-xs px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}
