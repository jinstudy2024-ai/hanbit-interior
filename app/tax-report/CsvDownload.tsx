'use client';

export function CsvDownload({
  rows,
  filename,
  label,
}: {
  rows: (string | number | boolean | null)[][];
  filename: string;
  label: string;
}) {
  function download() {
    const BOM = '﻿';
    const csv = BOM + rows.map(r =>
      r.map(c => {
        const s = c === null || c === undefined ? '' : String(c);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="btn-secondary" onClick={download}>
      ⬇ {label}
    </button>
  );
}
