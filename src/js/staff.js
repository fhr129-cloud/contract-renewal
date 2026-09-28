// staff.js — 직원 명단 (Firestore `staff` 컬렉션에서 읽어 화면 곳곳에 뿌림)
// 코드에 이름을 적는 곳은 여기 DEFAULT_STAFF 하나뿐이며, 이것도 최초 1회 가져오기용 백업일 뿐이다.

export var DEFAULT_STAFF=[
  {name:'박주형',title:'본부장',group:'운영',team:1,lead:true, color:'#185FA5',bg:'#E6F1FB',border:'#B5D4F4',order:1, active:true},
  {name:'김재희',title:'차장',  group:'운영',team:2,lead:true, color:'#3B6D11',bg:'#EAF3DE',border:'#C0DD97',order:2, active:true},
  {name:'권은진',title:'과장',  group:'운영',team:3,lead:true, color:'#854F0B',bg:'#FAEEDA',border:'#FAC775',order:3, active:true},
  {name:'이소영',title:'주임',  group:'운영',team:0,lead:false,color:'#6B2FA0',bg:'#F3E6FB',border:'#D4A8F0',order:4, active:true},
  {name:'김상준',title:'주임',  group:'운영',team:0,lead:false,color:'#A32D2D',bg:'#FCEBEB',border:'#F7C1C1',order:5, active:true},
  {name:'안은재',title:'주임',  group:'운영',team:0,lead:false,color:'#0B6B5A',bg:'#E6FBF8',border:'#A8EDE3',order:6, active:true},
  {name:'견병록',title:'매니저',group:'운영',team:0,lead:false,color:'#6B5B0B',bg:'#FBF6E6',border:'#EDE0A8',order:7, active:true},
  {name:'임성창',title:'차장',  group:'지원',team:0,lead:false,color:'#444444',bg:'#F0F0EC',border:'#cccccc',order:8, active:true},
  {name:'김동현',title:'대리',  group:'지원',team:0,lead:false,color:'#A32D6B',bg:'#FBE6F0',border:'#F0A8D0',order:9, active:true},
  {name:'손도란',title:'',      group:'운영',team:0,lead:false,color:'#854F0B',bg:'#FAEEDA',border:'#FAC775',order:10,active:false}
];
// 새 직원 색 후보 (관리자 화면에서 고르는 팔레트)
export var COLOR_PALETTE=[
  {color:'#185FA5',bg:'#E6F1FB',border:'#B5D4F4'},{color:'#3B6D11',bg:'#EAF3DE',border:'#C0DD97'},{color:'#854F0B',bg:'#FAEEDA',border:'#FAC775'},
  {color:'#6B2FA0',bg:'#F3E6FB',border:'#D4A8F0'},{color:'#A32D2D',bg:'#FCEBEB',border:'#F7C1C1'},{color:'#0B6B5A',bg:'#E6FBF8',border:'#A8EDE3'},
  {color:'#6B5B0B',bg:'#FBF6E6',border:'#EDE0A8'},{color:'#444444',bg:'#F0F0EC',border:'#cccccc'},{color:'#A32D6B',bg:'#FBE6F0',border:'#F0A8D0'},
  {color:'#2F6F8F',bg:'#E6F2F8',border:'#A9CCE0'},{color:'#7A5230',bg:'#F5ECE4',border:'#D9B9A0'},{color:'#4E6B3A',bg:'#EEF3E8',border:'#BFD1AE'},
  {color:'#8A3A6B',bg:'#F6E8F0',border:'#D9A9C6'},{color:'#2B6B6B',bg:'#E4F3F3',border:'#A5D3D3'}
];

// ── 아래는 앱 곳곳에서 쓰는 살아있는 값. applyStaff()가 채운다 (import한 쪽에서도 같은 객체를 봄) ──
export var STAFF=[];            // 재직 중 직원 배열 (order 순)
export var STAFF_MAP={};        // { '박주형': {cls,border,bg,color,...} }
export var STAFF_ORDER=[];      // ['박주형 본부장', ...]

export function fullName(s){ return s.title?s.name+' '+s.title:s.name; }
export function getStaffColor(name){ if(!name) return ''; for(var k in STAFF_MAP){ if(name.includes(k)) return STAFF_MAP[k].cls; } return ''; }
export function getStaffBorderColor(name){ if(!name) return '#ccc'; for(var k in STAFF_MAP){ if(name.includes(k)) return STAFF_MAP[k].border; } return '#ccc'; }
export function getStaffBg(name){ if(!name) return '#f0f0ec'; for(var k in STAFF_MAP){ if(name.includes(k)) return STAFF_MAP[k].bg; } return '#f0f0ec'; }
export function teamLead(team){ var s=STAFF.filter(function(x){ return x.lead&&Number(x.team)===Number(team); })[0]; return s?fullName(s):''; }
export function teamLeadShort(team){ var s=STAFF.filter(function(x){ return x.lead&&Number(x.team)===Number(team); })[0]; return s?s.name:''; }

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function attr(s){ return String(s==null?'':s).replace(/'/g,'').replace(/"/g,''); }

// list: Firestore에서 온 전체 직원(퇴사자 포함). 화면에는 재직자만.
export function applyStaff(list){
  var all=(list||[]).slice().sort(function(a,b){ return (a.order||99)-(b.order||99)||a.name.localeCompare(b.name,'ko'); });
  var active=all.filter(function(s){ return s.active!==false; });
  STAFF.length=0; active.forEach(function(s){ STAFF.push(s); });
  Object.keys(STAFF_MAP).forEach(function(k){ delete STAFF_MAP[k]; });
  STAFF_ORDER.length=0;
  // 퇴사자도 색은 남겨둠 (과거 일정에 이름이 남아 있으므로)
  all.forEach(function(s){ STAFF_MAP[s.name]={cls:'sc-'+s.name,border:s.border||s.color||'#ccc',bg:s.bg||'#f0f0ec',color:s.color||'#444'}; });
  active.forEach(function(s){ STAFF_ORDER.push(fullName(s)); });
  window.STAFF_ALL=all;
  injectColors(all); renderChips(active); renderSelects(active);
}
function injectColors(all){
  var st=document.getElementById('staff-colors');
  if(!st){ st=document.createElement('style'); st.id='staff-colors'; document.head.appendChild(st); }
  st.textContent=all.map(function(s){ return '.sc-'+s.name+'{background:'+(s.bg||'#f0f0ec')+';color:'+(s.color||'#444')+';border-color:'+(s.border||'#ccc')+';}'; }).join('\n');
}
function renderChips(active){
  var p=document.getElementById('personal-staff-wrap');
  if(p) p.innerHTML=active.map(function(s){ var n=fullName(s); return '<div class="staff-chip" onclick="togglePersonalStaffChip(this,\''+attr(n)+'\')">'+esc(n)+'</div>'; }).join('');
  var w=document.getElementById('staff-chip-wrap');
  if(w){
    var groups=[]; active.forEach(function(s){ var g=s.group||'운영'; if(groups.indexOf(g)<0) groups.push(g); });
    w.innerHTML=groups.map(function(g,i){
      return '<div style="font-size:11px;color:#888;width:100%;margin-bottom:2px;'+(i?'margin-top:4px;':'')+'">'+esc(g)+'팀</div>'+
        active.filter(function(s){ return (s.group||'운영')===g; }).map(function(s){ var n=fullName(s); return '<div class="staff-chip" onclick="toggleStaffChip(this,\''+attr(n)+'\')">'+esc(n)+'</div>'; }).join('');
    }).join('');
  }
}
function renderSelects(active){
  var team=document.getElementById('f-team');
  if(team){ var cur=team.value; team.innerHTML=[1,2,3].map(function(t){ var l=teamLeadShort(t); return '<option value="'+t+'">'+t+'팀'+(l?' ('+esc(l)+')':'')+'</option>'; }).join(''); if(cur) team.value=cur; }
  var resp=document.getElementById('f-resp');
  if(resp){ var cur2=resp.value; resp.innerHTML='<option value="">선택...</option>'+active.filter(function(s){ return (s.group||'운영')==='운영'&&!s.lead; }).map(function(s){ var n=fullName(s); return '<option>'+esc(n)+'</option>'; }).join(''); if(cur2) resp.value=cur2; }
}
