export type DateInsertFormat = 'date' | 'datetime';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateInsert(d: Date, format: DateInsertFormat): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (format === 'date') {
    return `${y}-${m}-${day}`;
  }
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}
