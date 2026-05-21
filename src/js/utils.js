export function today() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dDiff(endDate) {
  var t = today();
  var e = new Date(endDate);
  e.setHours(0, 0, 0, 0);
  return Math.round((e - t) / 86400000);
}

export function calcStatus(contract) {
  var d = dDiff(contract.endDate);
  if (d < 0) return 'auto';
  if (d <= 30) return 'urgent';
  if (d <= 90) return 'near';
  return 'ok';
}

export var STATUS_META = {
  auto:   { label: '자동연장', color: '#185FA5', bg: '#E6F1FB', border: '#B5D4F4' },
  urgent: { label: '긴급',     color: '#A32D2D', bg: '#FCEBEB', border: '#F7C1C1' },
  near:   { label: '임박',     color: '#854F0B', bg: '#FAEEDA', border: '#FAC775' },
  ok:     { label: '여유',     color: '#3B6D11', bg: '#EAF3DE', border: '#C0DD97' },
};

export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr);
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var day = String(d.getDate()).padStart(2,'0');
  return y + '.' + m + '.' + day;
}

export function toInputDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var day = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + day;
}

export function monthKey(dateStr) {
  var d = new Date(dateStr);
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  return y + '-' + m;
}

export function monthLabel(key) {
  var parts = key.split('-');
  return parts[0] + '년 ' + parseInt(parts[1]) + '월';
}

export function excelSerialToISO(n) {
  var d = new Date(1899, 11, 30);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dDayLabel(d) {
  if (d < 0) return 'D+' + Math.abs(d) + ' (자동연장중)';
  if (d === 0) return 'D-day';
  return 'D-' + d;
}
