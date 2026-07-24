// staff.js — 직원 정보 (순서/색상)
export var STAFF_MAP = {
  '박주형':{ cls:'sc-박주형', border:'#185FA5', bg:'#E6F1FB' },
  '김재희':{ cls:'sc-김재희', border:'#3B6D11', bg:'#EAF3DE' },
  '손도란':{ cls:'sc-손도란', border:'#854F0B', bg:'#FAEEDA' },
  '권은진':{ cls:'sc-권은진', border:'#854F0B', bg:'#FAEEDA' },
  '이소영':{ cls:'sc-이소영', border:'#6B2FA0', bg:'#F3E6FB' },
  '김상준':{ cls:'sc-김상준', border:'#A32D2D', bg:'#FCEBEB' },
  '안은재':{ cls:'sc-안은재', border:'#0B6B5A', bg:'#E6FBF8' },
  '견병록':{ cls:'sc-견병록', border:'#6B5B0B', bg:'#FBF6E6' },
  '임성창':{ cls:'sc-임성창', border:'#444',    bg:'#F0F0EC' },
  '김동현':{ cls:'sc-김동현', border:'#A32D6B', bg:'#FBE6F0' },
};
export var STAFF_ORDER = ['박주형 본부장','김재희 차장','권은진 과장','이소영 주임','김상준 주임','견병록 매니저','안은재 주임','임성창 차장','김동현 대리'];
export function getStaffColor(name) {
  if(!name) return '';
  for(var k in STAFF_MAP) { if(name.includes(k)) return STAFF_MAP[k].cls; }
  return '';
}
export function getStaffBorderColor(name) {
  if(!name) return '#ccc';
  for(var k in STAFF_MAP) { if(name.includes(k)) return STAFF_MAP[k].border; }
  return '#ccc';
}
export function getStaffBg(name) {
  if(!name) return '#f0f0ec';
  for(var k in STAFF_MAP) { if(name.includes(k)) return STAFF_MAP[k].bg; }
  return '#f0f0ec';
}
