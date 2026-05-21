export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dDiff(endDate) {
  const t = today();
  const e = new Date(endDate);
  e.setHours(0, 0, 0, 0);
  return Math.round((e - t) / 86400000);
}

export function calcStatus(contract) {
  const d = dDiff(contract.endDate);
  if (d < 0) return 'auto';
  if (d <= 30) return 'urgent';
  if (d <= 90) return 'near';
  return 'ok';
}

export const STATUS_META = {
  auto:   { label: '자동연장', color: '#185FA5', bg: '#E6F1FB', border: '#B5D4F4' },
  urgent: { label: '긴급',     color: '#A32D2D', bg: '#FCEBEB', border: '#F7C1C1' },
  near:   { label: '임박',     color: '#854F0B', bg: '#FAEEDA', border: '#FAC775' },
  ok:     { label: '여유',     color: '#3B6D11', bg: '#EAF3DE', border: '#C0DD97' },
};

export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

export function toInputDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${y}년 ${parseInt(m)}월`;
}

export function excelSerialToISO(n) {
  const d = new Date(1899, 11, 30);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dDayLabel(d) {
  if (d < 0) return `D+${Math.abs(d)} (자동연장중)`;
  if (d === 0) return 'D-da
