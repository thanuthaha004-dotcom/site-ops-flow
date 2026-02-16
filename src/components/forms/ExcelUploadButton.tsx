import { useRef } from 'react';
import { Upload } from 'lucide-react';

interface Props {
  onFileSelect: (file: File) => void;
  label?: string;
}

export default function ExcelUploadButton({ onFileSelect, label = 'Import Excel' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
      >
        <Upload className="h-4 w-4" />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileSelect(file);
            e.target.value = '';
          }
        }}
      />
    </>
  );
}
