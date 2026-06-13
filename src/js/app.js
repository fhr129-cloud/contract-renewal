import { listenContracts, listenHistory, listenSupports, addContract, updateContract, deleteContract, addHistory, addSupport, updateSupport, updateSupportBizName, deleteSupport, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, dDiff, dDayLabel, priceLabel } from './utils.js';

var contracts = [];
var historyData = [];
var supports = [];
var editingId = null;
var editingSupportId = null;
var currentPage = 'dashboard';
var currentBizTab = 'team';
var mapInstance = null;
var calYear = new Date().getFullYear();
var calMonth = new Date().getMonth();
var calView = 'week';
var staffFilter = null;
var ssOptions = [];
var currentModalTab = 'basic';
window.detailId = null;

// 담당자 색상 매핑
var STAFF_CHIP_CLASS = {
  '박주형':'chip-a','김재희':'chip-b','손도란':'chip-c','이소영':'chip-d',
  '김상준':'chip-e','안은재':'chip-f','견병록':'chip-g','임성창':'chip-h','김동현':'chip-i',
};
function getStaffChipClass(name) {
  if(!name) return 'chip-h';
  for(var k in STAFF_CHIP_CLASS) { if(name.includes(k)) return STAFF_CHIP_CLASS[k]; }
  return 'chip-h';
}

var COORDS = {
  'SK가스':{lat:37.0067,lng:126.8051},'그린씨알피':{lat:37.0710,lng:127.2621},
  '다원체어스':{lat:37.6887,lng:127.3272},'대덕농협':{lat:37.0100,lng:127.2212},
  '덕일산업':{lat:37.0106,lng:127.0805},'동인물산':{lat:37.0542,lng:126.9518},
  '동인산업':{lat:36.7429,lng:127.3485},'드림메카텍':{lat:37.1447,lng:127.0234},
  '롯데웰푸드':{lat:37.1823,lng:126.9828},'메카로':{lat:37.0377,lng:127.0832},
  '발렉스':{lat:37.0501,lng:126.9711},'보성정보통신':{lat:36.9604,lng:127.0746},
  '삼양화학공업':{lat:36.1756,lng:127.7534},'삼일엘리베이터':{lat:36.6234,lng:126.6312},
  '삼전순약':{lat:37.0354,lng:127.0815},'삼정펄프':{lat:36.7555,lng:127.1225},
  '성문전자':{lat:37.0127,lng:127.0814},'세종알로이':{lat:37.0926,lng:126.9624},
  '솔레오':{lat:37.0366,lng:127.0729},'승우플라텍':{lat:37.1477,lng:127.1475},
  '신덕산업':{lat:36.9036,lng:127.0204},'신양물류':{lat:36.9704,lng:126.8425},
  '신한전기(엠투엔)':{lat:37.1634,lng:127.0854},'에스아이':{lat:37.1437,lng:127.0258},
  '엠아이텍':{lat:37.1024,lng:127.0565},'연암':{lat:36.8924,lng:127.1969},
  '오뚜기 논산':{lat:36.1943,lng:127.1246},'오뚜기 평택':{lat:37.1186,lng:127.0713},
  '오뚜기 포승':{lat:36.9747,lng:126.8366},'우보테크':{lat:37.0270,lng:126.9639},
  '우진티엠씨':{lat:37.5486,lng:126.6444},'유니젠':{lat:37.1243,lng:127.0491},
  '윤지양행':{lat:37.1641,lng:127.0312},'일렉콤':{lat:37.2463,lng:127.3770},
  '지에스아이':{lat:36.9212,lng:127.0665},'청우코아':{lat:37.0340,lng:126.9631},
  'KC글라스':{lat:36.9157,lng:127.2512},'코오롱 인더스트리':{lat:37.1827,lng:127.0944},
  '티엔씨':{lat:36.9130,lng:127.0601},'파트라':{lat:37.1328,lng:127.1721},
  '퍼슨':{lat:36.8269,lng:127.1088},'퓨어앤텍':{lat:37.1420,lng:127.0236},
  '한보일렉트':{lat:37.1142,lng:126.9780},'한석시스템':{lat:37.1348,lng:127.4051},
  '한양로보틱스':{lat:36.6353,lng:126.6826},'한온시스템 아산':{lat:36.9347,lng:127.0582},
  '한온시스템 둔포':{lat:36.9078,lng:127.0360},'에치와이':{lat:37.1049,lng:127.0843},
  '쏘나브이피씨':{lat:37.0613,lng:126.7716},'나래산업':{lat:37.0526,lng:126.9423},
  '한미에프쓰리 1공장':{lat:36.8931,lng:127.0348},'한미에프쓰리 2공장':{lat:36.8578,lng:127.0387},
  '카길 애그리 퓨리나':{lat:36.9446,lng:126.8342},'한국바이린':{lat:37.0294,lng:126.9574},
  '디이엔티 오산':{lat:37.1678,lng:127.0338},'수퍼빈(아이엠팩토리)':{lat:37.0734,lng:126.7933},
  '한국가스공사':{lat:36.9723,lng:126.8312},'동천':{lat:37.0179,lng:126.9698},
  '비씨젠':{lat:37.3097,lng:126.7400},'삼영잉크':{lat:36.9811,lng:126.8542},
  '디오토모티브':{lat:36.8938,lng:127.0230},'주강로보테크':{lat:37.0518,lng:126.9356},
  '피엘에스':{lat:36.9434,lng:126.8714},'이구산업':{lat:36.9766,lng:126.8405},
  '진보':{lat:37.0387,lng:127.0832},'EPS코리아':{lat:36.9846,lng:126.8379},
  '두손':{lat:36.9577,lng:127.2002},'지푸드':{lat:37.0332,lng:126.9580},
  '머크':{lat:36.9855,lng:126.8370},'동아전기부품':{lat:37.2189,lng:127.0734},
  '에스앤지(바스노바)':{lat:37.2826,lng:127.2131},'대한송유관공사':{lat:37.3712,lng:127.1023},
  '미소찬':{lat:36.9131,lng:127.2017},'비와이티':{lat:36.9950,lng:126.8812},
  '대성아이앤지':{lat:37.0615,lng:126.9657},'무봉산수련원':{lat:37.1058,lng:127.1012},
  '진성티이씨 1공장':{lat:37.0088,lng:127.0796},'진성티이씨 2공장':{lat:37.0103,lng:127.0833},
  '대코':{lat:37.3355,lng:126.7215},'동아전장':{lat:37.1456,lng:127.6441},
  '린데코리아':{lat:37.0712,lng:127.1312},'신세대여행사':{lat:37.2325,lng:126.9807},
  '삼아알미늄':{lat:36.9680,lng:126.8498},'필코코스팜':{lat:37.0350,lng:126.9386},
  '세명테크':{lat:36.9092,lng:127.0088},'효림정공':{lat:37.0091,lng:127.0788},
};

// ── 전화번호 하이픈 ──────────────────────────
window.formatPhone = function(input) {
  var v=input.value.replace(/[^0-9]/g,'');
  if(v.startsWith('02')){
    if(v.length<=2) input.value=v;
    else if(v.length<=5) input.value=v.slice(0,2)+'-'+v.slice(2);
    else if(v.length<=9) input.value=v.slice(0,2)+'-'+v.slice(2,5)+'-'+v.slice(5);
    else input.value=v.slice(0,2)+'-'+v.slice(2,6)+'-'+v.slice(6,10);
  } else {
    if(v.length<=3) input.value=v;
    else if(v.length<=6) input.value=v.slice(0,3)+'-'+v.slice(3);
    else if(v.length<=10) input.value=v.slice(0,3)+'-'+v.slice(3,6)+'-'+v.slice(6);
    else input.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7,11);
  }
};

// ── 끼니 칩 (계약 모달용) ──────────────────────────
window.updateChip = function(cb) {
  var label=cb.closest('.meal-chip-label');
  if(label) label.classList.toggle('checked', cb.checked);
};
window.toggleWeekend = function(day) {
  var cb=document.getElementById('meal-'+day), sub=document.getElementById('meal-'+day+'-sub');
  if(!cb||!sub) return;
  sub.style.display=cb.checked?'flex':'none';
  if(!cb.checked) sub.querySelectorAll('input[type=checkbox]').forEach(function(c){ c.checked=false; c.closest('.meal-chip-label')&&c.closest('.meal-chip-label').classList.remove('checked'); });
};
function getMeals() {
  var r={weekday:[],sat:[],sun:[]};
  document.querySelectorAll('.meal-cb[data-day="weekday"]:checked').forEach(function(cb){ r.weekday.push(cb.value); });
  if(document.getElementById('meal-sat')&&document.getElementById('meal-sat').checked)
    document.querySelectorAll('.meal-cb[data-day="sat"]:checked').forEach(function(cb){ r.sat.push(cb.value); });
  if(document.getElementById('meal-sun')&&document.getElementById('meal-sun').checked)
    document.querySelectorAll('.meal-cb[data-day="sun"]:checked').forEach(function(cb){ r.sun.push(cb.value); });
  return r;
}
function setMeals(meals) {
  document.querySelectorAll('.meal-cb').forEach(function(cb){ cb.checked=false; cb.closest('.meal-chip-label')&&cb.closest('.meal-chip-label').classList.remove('checked'); });
  ['sat','sun'].forEach(function(d){ var cb=document.getElementById('meal-'+d),sub=document.getElementById('meal-'+d+'-sub'); if(cb)cb.checked=false; if(sub)sub.style.display='none'; });
  if(!meals) return;
  if(typeof meals==='string') { meals.split('/').forEach(function(v){ var cb=document.querySelector('.meal-cb[data-day="weekday"][value="'+v.trim()+'"]'); if(cb){cb.checked=true;cb.closest('.meal-chip-label')&&cb.closest('.meal-chip-label').classList.add('checked');} }); return; }
  ['weekday','sat','sun'].forEach(function(day){
    if(!meals[day]||!meals[day].length) return;
    if(day!=='weekday'){ var cb=document.getElementById('meal-'+day),sub=document.getElementById('meal-'+day+'-sub'); if(cb)cb.checked=true; if(sub)sub.style.display='flex'; }
    meals[day].forEach(function(v){ var cb=document.querySelector('.meal-cb[data-day="'+day+'"][value="'+v+'"]'); if(cb){cb.checked=true;cb.closest('.meal-chip-label')&&cb.closest('.meal-chip-label').classList.add('checked');} });
  });
}
function mealsDisplay(meals) {
  if(!meals) return '-';
  if(typeof meals==='string') return meals;
  var p=[];
  if(meals.weekday&&meals.weekday.length) p.push('평일:'+meals.weekday.join('/'));
  if(meals.sat&&meals.sat.length) p.push('토:'+meals.sat.join('/'));
  if(meals.sun&&meals.sun.length) p.push('일:'+meals.sun.join('/'));
  return p.join(' | ')||'-';
}

// ── 운영지원 끼니/지원자 칩 ──────────────────────────
window.toggleMealChip = function(el) {
  el.classList.toggle('selected');
};
window.toggleStaffChip = function(el, name) {
  el.classList.toggle('selected');
};
window.toggleTeamDropdown = function(id) {
  closeDropdowns();
  var el=document.getElementById(id);
  if(el) el.style.display=el.style.display==='none'?'block':'none';
};
window.closeDropdowns = function() {
  ['op-dropdown','sup-dropdown'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
};
document.addEventListener('click', function(e) {
  if(!e.target.closest('[onclick*="toggleTeamDropdown"]')&&!e.target.closest('[id$="-dropdown"]')) window.closeDropdowns();
});
function getSelectedMeals() {
  var r=[]; document.querySelectorAll('#meal-chip-wrap .chip-option.selected').forEach(function(c){ r.push(c.textContent.trim()); }); return r;
}
function resetMealChips() {
  document.querySelectorAll('#meal-chip-wrap .chip-option').forEach(function(c){ c.classList.remove('selected'); });
}
function setSelectedMeals(meals) {
  resetMealChips();
  if(!meals||!meals.length) return;
  document.querySelectorAll('#meal-chip-wrap .chip-option').forEach(function(c){ if(meals.indexOf(c.textContent.trim())!==-1) c.classList.add('selected'); });
}
function getSelectedStaff() {
  var r=[]; document.querySelectorAll('#staff-chip-wrap .chip-option.selected').forEach(function(c){ r.push(c.textContent.trim()); }); return r;
}
function resetStaffChips() {
  document.querySelectorAll('#staff-chip-wrap .chip-option').forEach(function(c){ c.classList.remove('selected'); });
}
function setSelectedStaff(names) {
  resetStaffChips();
  if(!names||!names.length) return;
  document.querySelectorAll('#staff-chip-wrap .chip-option').forEach(function(c){ if(names.some(function(n){ return n===c.textContent.trim(); })) c.classList.add('selected'); });
}

// ── 담당자/영양사 ──────────────────────────
window.addContactRow = function() {
  var wrap=document.getElementById('contact-rows'); if(!wrap) return;
  var div=document.createElement('div'); div.className='contact-row';
  div.innerHTML='<input type="text" placeholder="이름 · 직책" class="contact-name">'+
    '<input type="text" placeholder="연락처" class="contact-phone" oninput="formatPhone(this)">'+
    '<input type="text" placeholder="대표번호" class="contact-tel" oninput="formatPhone(this)">'+
    '<button type="button" class="btn btn-danger btn-sm" onclick="removeContactRow(this)"><i class="ti ti-trash"></i></button>';
  wrap.appendChild(div);
};
window.removeContactRow = function(btn) {
  var row=btn.closest('.contact-row'),wrap=document.getElementById('contact-rows');
  if(wrap&&wrap.children.length>1) row.remove(); else showToast('최소 1명은 있어야 해요.');
};
function getContacts() {
  var rows=document.querySelectorAll('#contact-rows .contact-row'),r=[];
  rows.forEach(function(row){
    var n=row.querySelector('.contact-name').value.trim(),p=row.querySelector('.contact-phone').value.trim(),t=row.querySelector('.contact-tel').value.trim();
    if(n||p) r.push({name:n,phone:p,tel:t});
  }); return r;
}
function setContacts(contacts) {
  var wrap=document.getElementById('contact-rows'); if(!wrap) return;
  wrap.innerHTML='';
  var list=contacts&&contacts.length?contacts:[{name:'',phone:'',tel:''}];
  list.forEach(function(ct){
    var div=document.createElement('div'); div.className='contact-row';
    div.innerHTML='<input type="text" placeholder="이름 · 직책" class="contact-name" value="'+(ct.name||'')+'">'+
      '<input type="text" placeholder="연락처" class="contact-phone" value="'+(ct.phone||'')+'" oninput="formatPhone(this)">'+
      '<input type="text" placeholder="대표번호" class="contact-tel" value="'+(ct.tel||'')+'" oninput="formatPhone(this)">'+
      '<button type="button" class="btn btn-danger btn-sm" onclick="removeContactRow(this)"><i class="ti ti-trash"></i></button>';
    wrap.appendChild(div);
  });
}
window.addNutriRow = function() {
  var wrap=document.getElementById('nutritionist-rows'); if(!wrap) return;
  var div=document.createElement('div'); div.className='nutri-row'; div.style.cssText='display:flex;gap:8px;align-items:center;margin-top:8px;';
  div.innerHTML='<input type="text" placeholder="이름 · 직책" class="nutri-name" style="flex:1;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;">'+
    '<input type="text" placeholder="연락처" class="nutri-phone" oninput="formatPhone(this)" style="flex:1;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;">'+
    '<button type="button" class="btn btn-danger btn-sm" onclick="removeNutriRow(this)"><i class="ti ti-trash"></i></button>';
  wrap.appendChild(div);
};
window.removeNutriRow = function(btn) {
  var row=btn.closest('.nutri-row'),wrap=document.getElementById('nutritionist-rows');
  if(wrap&&wrap.children.length>1) row.remove();
  else { wrap.querySelector('.nutri-name').value=''; wrap.querySelector('.nutri-phone').value=''; }
};
function getNutritionists() {
  var rows=document.querySelectorAll('#nutritionist-rows .nutri-row'),r=[];
  rows.forEach(function(row){
    var n=row.querySelector('.nutri-name').value.trim(),p=row.querySelector('.nutri-phone').value.trim();
    if(n||p) {
      if(n&&!n.includes('영양사')&&!n.includes('팀장')&&!n.includes('과장')&&!n.includes('대리')&&!n.includes('주임')&&!n.includes('차장')&&!n.includes('부장')&&!n.includes('이사')&&!n.includes('사원')) n=n+' 영양사';
      r.push({name:n,phone:p});
    }
  }); return r;
}
function setNutritionists(list) {
  var wrap=document.getElementById('nutritionist-rows'); if(!wrap) return;
  wrap.innerHTML='';
  var data=list&&list.length?list:[{name:'',phone:''}];
  data.forEach(function(nt){
    var div=document.createElement('div'); div.className='nutri-row'; div.style.cssText='display:flex;gap:8px;align-items:center;margin-top:8px;';
    div.innerHTML='<input type="text" placeholder="이름 · 직책" class="nutri-name" value="'+(nt.name||'')+'" style="flex:1;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;">'+
      '<input type="text" placeholder="연락처" class="nutri-phone" value="'+(nt.phone||'')+'" oninput="formatPhone(this)" style="flex:1;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;">'+
      '<button type="button" class="btn btn-danger btn-sm" onclick="removeNutriRow(this)"><i class="ti ti-trash"></i></button>';
    wrap.appendChild(div);
  });
}

// ── 히스토리 탭 ──────────────────────────
window.switchModalTab = function(tab) {
  currentModalTab=tab;
  document.getElementById('tab-basic').style.display=tab==='basic'?'block':'none';
  document.getElementById('tab-hist').style.display=tab==='hist'?'block':'none';
  document.getElementById('tab-basic-btn').classList.toggle('active',tab==='basic');
  document.getElementById('tab-hist-btn').classList.toggle('active',tab==='hist');
  document.getElementById('modal-save-btn').style.display=tab==='basic'?'inline-flex':'none';
  if(tab==='hist') renderHistTab();
};
function renderHistTab() {
  var el=document.getElementById('hist-list'); if(!el) return;
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  var records=h&&h.records?h.records:[];
  if(!records.length){ el.innerHTML='<div class="empty"><i class="ti ti-history"></i><p>이력이 없어요</p></div>'; return; }
  el.innerHTML=records.map(function(r,i){
    var isCurrent=i===records.length-1, label=i===0?'최초':i+'차'; if(isCurrent) label='현재';
    return '<div class="hist-tab-row">'+
      '<span class="hist-tab-label'+(isCurrent?' current':'')+'">'+label+'</span>'+
      '<span class="hist-tab-info">'+(r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-')+
      ' · '+(r.price?Number(r.price).toLocaleString()+'원':'관리비제')+(r.note?' · '+r.note:'')+'</span>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        '<button class="btn-icon" style="width:28px;height:28px;" onclick="editHistRow('+i+')"><i class="ti ti-edit" style="font-size:14px;"></i></button>'+
        '<button class="btn-icon" style="width:28px;height:28px;background:var(--red-light);color:var(--red);" onclick="delHistRow('+i+')"><i class="ti ti-trash" style="font-size:14px;"></i></button>'+
      '</div></div>';
  }).join('');
}
window.addHistRow=function(){ showHistForm(-1,{startDate:'',endDate:'',price:'',note:''}); };
window.editHistRow=function(idx){
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  if(!h||!h.records||!h.records[idx]) return;
  showHistForm(idx,h.records[idx]);
};
window.delHistRow=async function(idx){
  if(!confirm('이 이력을 삭제할까요?')) return;
  var h=historyData.find(function(x){ return x.contractId===editingId; });
  if(!h||!h.records) return;
  var records=h.records.slice(); records.splice(idx,1);
  await saveHistRecords(records,h.name);
  showToast('삭제되었습니다.'); renderHistTab();
};
function showHistForm(idx,r) {
  var existing=document.getElementById('hist-form-popup'); if(existing) existing.remove();
  var isNew=idx===-1;
  var popup=document.createElement('div');
  popup.id='hist-form-popup';
  popup.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:500;display:flex;align-items:center;justify-content:center;';
  popup.innerHTML='<div style="background:#fff;border-radius:16px;width:400px;max-width:95vw;padding:24px;">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">'+
      '<h4 style="font-size:16px;font-weight:700;">'+(isNew?'이력 추가':(idx===0?'최초':idx+'차')+' 수정')+'</h4>'+
      '<button class="btn-icon" onclick="closeHistForm()"><i class="ti ti-x"></i></button></div>'+
    '<div style="display:flex;flex-direction:column;gap:12px;">'+
      (isNew?'<div><label class="form-label">구분</label><select class="form-select" id="hf-label"><option value="최초">최초</option>'+[1,2,3,4,5,6,7,8,9,10].map(function(n){ return '<option value="'+n+'차">'+n+'차</option>'; }).join('')+'<option value="현재">현재(최신)</option></select></div>':'')+
      '<div><label class="form-label">시작일</label><input type="date" class="form-input" id="hf-start" value="'+(r.startDate||'')+'"></div>'+
      '<div><label class="form-label">종료일</label><input type="date" class="form-input" id="hf-end" value="'+(r.endDate||'')+'"></div>'+
      '<div><label class="form-label">단가</label><input type="number" class="form-input" id="hf-price" value="'+(r.price||0)+'"></div>'+
      '<div><label class="form-label">비고</label><input type="text" class="form-input" id="hf-note" value="'+(r.note||'')+'" placeholder="특이사항"></div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">'+
        '<button class="btn btn-ghost" onclick="closeHistForm()">취소</button>'+
        '<button class="btn btn-primary" onclick="saveHistForm('+idx+')"><i class="ti ti-check"></i> 저장</button>'+
      '</div></div></div>';
  popup.addEventListener('click',function(e){ if(e.target===popup) closeHistForm(); });
  document.body.appendChild(popup);
}
window.closeHistForm=function(){ var p=document.getElementById('hist-form-popup'); if(p) p.remove(); };
window.saveHistForm=async function(idx){
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  var records=h&&h.records?h.records.slice():[];
  var c=contracts.find(function(x){ return x.id===editingId; });
  var newRecord={startDate:document.getElementById('hf-start').value,endDate:document.getElementById('hf-end').value,price:parseInt(document.getElementById('hf-price').value)||0,note:document.getElementById('hf-note').value.trim(),updatedAt:new Date().toISOString()};
  if(idx===-1){ var labelSel=document.getElementById('hf-label'),label=labelSel?labelSel.value:'최초'; if(label==='현재') records.push(newRecord); else if(label==='최초') records.unshift(newRecord); else records.push(newRecord); }
  else records[idx]=newRecord;
  await saveHistRecords(records,c?c.name:'');
  closeHistForm(); showToast(idx===-1?'이력이 추가되었습니다.':'이력이 수정되었습니다.');
  renderHistTab();
  if(c&&document.getElementById('detail-screen').style.display==='flex') renderDetail(c);
};
async function saveHistRecords(records,name) {
  var {db}=await import('./db.js');
  var {doc,setDoc,serverTimestamp}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await setDoc(doc(db,'history',editingId),{contractId:editingId,name:name||'',records:records,updatedAt:serverTimestamp()});
}

// ── 초기화 ──────────────────────────
async function init() {
  await seedIfEmpty();
  listenContracts(function(data){
    contracts=data;
    ssOptions=data.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    renderPage(currentPage);
    updateUrgentBadge();
  });
  listenHistory(function(data){ historyData=data; });
  listenSupports(function(data){
    supports=data;
    if(currentPage==='support'){ renderCalendar(); renderSupportList(); }
    if(currentPage==='dashboard') renderDashboard();
  });
}
init();

function updateUrgentBadge() {
  var urgent=contracts.filter(function(c){ return calcStatus(c)==='urgent'; }).length;
  var dot=document.querySelector('#tab-dashboard .tab-badge-dot');
  if(dot) dot.style.display=urgent>0?'block':'none';
}

// ── 네비게이션 ──────────────────────────
window.goPage=function(page){
  currentPage=page;
  // 탭 활성화
  ['dashboard','support','businesses','admin'].forEach(function(p){
    var tab=document.getElementById('tab-'+p);
    if(tab) tab.classList.toggle('active',p===page);
    var pg=document.getElementById('page-'+p);
    if(pg) pg.style.display=p===page?'block':'none';
  });
  // 헤더 제목
  var titles={dashboard:'대시보드',support:'운영지원',businesses:'FS 사업장 현황',admin:'관리'};
  var titleEl=document.getElementById('page-title'); if(titleEl) titleEl.textContent=titles[page]||'';
  var subtitleEl=document.getElementById('page-subtitle');
  var actions=document.getElementById('header-actions'); if(actions) actions.innerHTML='';
  // FAB
  var fab=document.getElementById('sup-fab'); if(fab) fab.style.display=page==='support'?'flex':'none';
  // 상세 숨기기
  var ds=document.getElementById('detail-screen'); if(ds) ds.style.display='none';
  // 페이지별 액션
  if(page==='admin'&&actions) actions.innerHTML='<button class="btn-icon" onclick="openAddModal()" title="추가"><i class="ti ti-plus" style="font-size:18px;"></i></button><button class="btn-icon" onclick="exportExcel()" title="엑셀"><i class="ti ti-download" style="font-size:18px;"></i></button>';
  // 날짜 부제목
  if(page==='dashboard'&&subtitleEl){ var now=new Date(),days=['일','월','화','수','목','금','토']; subtitleEl.textContent=now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 ('+days[now.getDay()]+')'; }
  else if(subtitleEl) subtitleEl.textContent='';
  renderPage(page);
};

window.goDetail=function(id){
  if(!id||id==='undefined') return;
  window.detailId=id;
  var c=contracts.find(function(x){ return x.id===id; });
  var ds=document.getElementById('detail-screen');
  if(ds){ ds.style.display='flex'; }
  if(c) renderDetail(c);
};
window.goBackFromDetail=function(){
  var ds=document.getElementById('detail-screen'); if(ds) ds.style.display='none';
};

function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='support'){ renderCalendar(); renderSupportList(); initSS(); }
  if(page==='businesses') renderBizTab();
  if(page==='admin') renderAdmin();
}

// ── 대시보드 ──────────────────────────
function renderDashboard() {
  // 긴급 배너
  var urgent=contracts.filter(function(c){ return calcStatus(c)==='urgent'; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  var near=contracts.filter(function(c){ return calcStatus(c)==='near'; });
  var bannerEl=document.getElementById('urgent-banner');
  if(bannerEl&&urgent.length>0){
    bannerEl.innerHTML='<div class="alert-banner alert-urgent">'+
      '<i class="ti ti-alert-triangle alert-icon" style="color:var(--red);"></i>'+
      '<div class="alert-body">'+
        '<div class="alert-title">재계약 긴급 '+urgent.length+'건</div>'+
        urgent.slice(0,3).map(function(c){ return '<div class="alert-item"><span class="status-dot dot-urgent"></span>'+c.name+' <strong>'+dDayLabel(dDiff(c.endDate))+'</strong></div>'; }).join('')+
        (urgent.length>3?'<div class="alert-item" style="color:var(--gray-400);">외 '+(urgent.length-3)+'개소 더...</div>':'')+
      '</div></div>';
  } else if(bannerEl) bannerEl.innerHTML='';

  // 통계
  var statU=document.getElementById('stat-urgent'); if(statU) statU.textContent=urgent.length;
  var statN=document.getElementById('stat-near'); if(statN) statN.textContent=near.length;

  // 오늘 일정
  var todayStr=new Date().toISOString().slice(0,10);
  var todayItems=supports.filter(function(s){ return s.date&&s.date.slice(0,10)===todayStr; }).sort(function(a,b){ return (a.timeStart||'').localeCompare(b.timeStart||''); });
  var schedEl=document.getElementById('dash-today-sched');
  if(schedEl){
    if(todayItems.length){
      schedEl.innerHTML=todayItems.map(function(s){
        var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
        var cls=getStaffChipClass(staffStr);
        var mealStr=s.meals&&s.meals.length?s.meals.join('/'):'';
        return '<div class="list-item" onclick="goDetail(\''+(contracts.find(function(x){ return x.name===s.bizName; })||{}).id+'\'||\'')">'+
          '<div class="list-item-icon" style="background:var(--blue-light);"><i class="ti ti-map-pin" style="color:var(--blue);"></i></div>'+
          '<div class="list-item-body">'+
            '<div class="list-item-title">'+s.bizName+'</div>'+
            '<div class="list-item-sub">'+(mealStr?mealStr+' · ':'')+s.category+(s.content?' · '+s.content:'')+'</div>'+
          '</div>'+
          '<div><span class="staff-chip '+cls+'">'+staffStr+'</span></div>'+
          '</div>';
      }).join('');
    } else {
      schedEl.innerHTML='<div class="empty"><i class="ti ti-calendar"></i><p>오늘 등록된 일정이 없어요</p></div>';
    }
  }

  // 이번달 만료
  var now=new Date(), thisY=now.getFullYear(), thisM=now.getMonth();
  var thisList=contracts.filter(function(c){ if(!c.endDate) return false; var d=new Date(c.endDate); return d.getFullYear()===thisY&&d.getMonth()===thisM; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  var tmEl=document.getElementById('dash-thismonth');
  if(tmEl){
    tmEl.innerHTML=thisList.length?thisList.map(function(c){
      var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'var(--red)':s==='near'?'var(--amber)':'var(--blue)';
      return '<div class="list-item" onclick="goDetail(\''+c.id+'\')">'+
        '<div class="status-dot '+(s==='urgent'?'dot-urgent':s==='near'?'dot-near':'dot-auto')+'" style="flex-shrink:0;"></div>'+
        '<div class="list-item-body"><div class="list-item-title">'+c.name+'</div>'+
        '<div class="list-item-sub">'+fmtDate(c.endDate)+(c.resp?' · '+c.resp:'')+'</div></div>'+
        '<div style="font-size:13px;font-weight:700;color:'+col+';">'+dDayLabel(d)+'</div>'+
        '</div>';
    }).join(''):'<div class="empty"><i class="ti ti-check"></i><p>이번달 만료 예정 없음</p></div>';
  }

  // 최근 7일 운영지원
  var week=new Date(now); week.setDate(week.getDate()-7);
  var weekStr=week.toISOString().slice(0,10);
  var recentSups=supports.filter(function(s){ return s.date&&s.date>=weekStr; }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var supEl=document.getElementById('dash-recent-sup');
  if(supEl){
    supEl.innerHTML=recentSups.length?recentSups.slice(0,6).map(function(s){
      var c=contracts.find(function(x){ return x.name===s.bizName; }),cid=c?c.id:'';
      var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
      var cls=getStaffChipClass(staffStr);
      return '<div class="list-item"'+(cid?' onclick="goDetail(\''+cid+'\')"':'')+'>'+
        '<div class="list-item-icon" style="background:var(--gray-100);"><i class="ti ti-notes" style="color:var(--gray-400);"></i></div>'+
        '<div class="list-item-body">'+
          '<div class="list-item-title">'+s.bizName+'</div>'+
          '<div class="list-item-sub">'+s.category+' · '+s.date+'</div>'+
        '</div>'+
        '<span class="staff-chip '+cls+'">'+staffStr+'</span>'+
        '</div>';
    }).join(''):'<div class="empty"><i class="ti ti-history"></i><p>최근 7일 지원 내역이 없어요</p></div>';
  }
}

window.showStatusList=function(filter){
  var wrap=document.getElementById('status-list-wrap'),listEl=document.getElementById('status-list');
  if(!wrap||!listEl) return;
  if(wrap.dataset.filter===filter){ wrap.style.display='none'; wrap.dataset.filter=''; return; }
  wrap.dataset.filter=filter; wrap.style.display='block';
  var list=contracts.filter(function(c){ return calcStatus(c)===filter; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  listEl.innerHTML=list.length?list.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'var(--red)':'var(--amber)';
    return '<div class="list-item" onclick="goDetail(\''+c.id+'\')">'+
      '<div class="status-dot '+(s==='urgent'?'dot-urgent':'dot-near')+'" style="flex-shrink:0;"></div>'+
      '<div class="list-item-body"><div class="list-item-title">'+c.name+'</div>'+
      '<div class="list-item-sub">'+(c.resp||'')+(c.nutritionists&&c.nutritionists.length?' · '+c.nutritionists[0].name:'')+'</div></div>'+
      '<div style="font-size:13px;font-weight:700;color:'+col+';">'+dDayLabel(d)+'</div>'+
      '</div>';
  }).join(''):'<div class="empty"><i class="ti ti-check"></i><p>해당 없음</p></div>';
};

// ── 사업장 상세 ──────────────────────────
function renderDetail(c) {
  var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'var(--red)':s==='auto'?'var(--blue)':s==='near'?'var(--amber)':'var(--green)';
  var titleEl=document.getElementById('detail-title'); if(titleEl) titleEl.textContent=c.name;
  var contactHtml='';
  if(c.contacts&&c.contacts.length) contactHtml=c.contacts.map(function(ct){ return '<div>'+(ct.name||'')+(ct.phone?' · '+ct.phone:'')+(ct.tel?' · '+ct.tel:'')+'</div>'; }).join('');
  else contactHtml=(c.contactName||'-')+(c.contactPhone?' · '+c.contactPhone:'')+(c.tel?' · '+c.tel:'');
  var h=historyData.find(function(x){ return x.contractId===c.id; });
  var histHtml=h&&h.records&&h.records.length?h.records.map(function(r,i){
    var isCurrent=i===h.records.length-1,label=i===0?'최초':i+'차'; if(isCurrent) label='현재';
    return '<div class="hist-record"><span class="hist-round">'+label+'</span>'+
      '<span style="font-size:12px;color:var(--gray-500);">'+(r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-')+'</span>'+
      '<span style="font-size:12px;font-weight:600;">'+(r.price?Number(r.price).toLocaleString()+'원':'관리비제')+'</span></div>';
  }).join(''):'<div class="empty"><i class="ti ti-history"></i><p>히스토리 없음</p></div>';
  var bizSups=supports.filter(function(sp){ return sp.bizName===c.name; }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var supHtml=bizSups.length?bizSups.map(function(sp){
    var staffStr=sp.staffNames&&sp.staffNames.length?sp.staffNames.join(', '):(sp.staffName||'');
    var cls=getStaffChipClass(staffStr);
    var mealStr=sp.meals&&sp.meals.length?sp.meals.join('/'):'';
    return '<div class="sup-hist-row">'+
      '<span class="badge badge-gray" style="font-size:10px;">'+(sp.category||'')+'</span>'+
      '<div style="min-width:0;"><div style="font-size:12px;color:var(--gray-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(sp.date||'')+(mealStr?' · '+mealStr:'')+(staffStr?' · '+staffStr:'')+'</div>'+(sp.content?'<div style="font-size:12px;color:var(--gray-400);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+sp.content+'</div>':'')+
      '</div></div>';
  }).join(''):'<div class="empty"><i class="ti ti-calendar"></i><p>지원 이력 없음</p></div>';

  var bodyEl=document.getElementById('detail-body');
  if(!bodyEl) return;
  bodyEl.innerHTML=
    '<div class="detail-section">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'+
        '<span class="badge badge-'+s+'" style="font-size:12px;padding:4px 10px;">'+STATUS_META[s].label+'</span>'+
        '<span style="font-size:16px;font-weight:700;color:'+col+';">'+dDayLabel(d)+'</span>'+
      '</div>'+
      '<div class="detail-row"><span class="detail-label">소재지</span><span class="detail-val">'+(c.addr||'-')+'</span></div>'+
      '<div class="detail-row"><span class="detail-label">담당자</span><span class="detail-val">'+contactHtml+'</span></div>'+
      '<div class="detail-row"><span class="detail-label">담당영양사</span><span class="detail-val">'+(c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return (nt.name||'')+(nt.phone?' · '+nt.phone:''); }).join('<br>'):'-')+'</span></div>'+
      '<div class="detail-row"><span class="detail-label">팀/책임</span><span class="detail-val">'+(c.team?c.team+'팀':'-')+' / '+(c.resp||'-')+'</span></div>'+
    '</div>'+
    '<div class="detail-section">'+
      '<div class="detail-section-title">계약 정보</div>'+
      '<div class="detail-row"><span class="detail-label">계약기간</span><span class="detail-val">'+fmtDate(c.startDate)+' ~ '+fmtDate(c.endDate)+'</span></div>'+
      '<div class="detail-row"><span class="detail-label">계약단가</span><span class="detail-val">'+priceLabel(c)+'</span></div>'+
      '<div class="detail-row"><span class="detail-label">월평균식수</span><span class="detail-val">'+(c.avgMeals?Number(c.avgMeals).toLocaleString()+'식':'-')+'</span></div>'+
      '<div class="detail-row"><span class="detail-label">운영끼니</span><span class="detail-val">'+mealsDisplay(c.meals)+'</span></div>'+
      (c.note?'<div class="detail-row"><span class="detail-label">특이사항</span><span class="detail-val">'+c.note+'</span></div>':'')+
    '</div>'+
    '<div class="detail-section"><div class="detail-section-title">계약 히스토리</div>'+histHtml+'</div>'+
    '<div class="detail-section"><div class="detail-section-title">운영지원 이력</div>'+supHtml+'</div>';
}

// ── 운영지원 달력 ──────────────────────────
window.setCalView=function(view){
  calView=view;
  var wb=document.getElementById('view-week-btn'),mb=document.getElementById('view-month-btn');
  if(wb){ wb.classList.toggle('active',view==='week'); }
  if(mb){ mb.classList.toggle('active',view==='month'); }
  renderCalendar();
};
window.setStaffFilter=function(name){
  staffFilter=name;
  var labelEl=document.getElementById('active-filter-label');
  if(labelEl){ if(name){labelEl.textContent=name+' 필터 중';labelEl.style.display='inline';}else{labelEl.style.display='none';} }
  var allBtn=document.getElementById('filter-all');
  if(allBtn) allBtn.classList.toggle('selected',!name);
  renderCalendar();
};
window.changeMonth=function(dir){
  if(dir===0){calYear=new Date().getFullYear();calMonth=new Date().getMonth();}
  else{calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}}
  renderCalendar();
};
function filterSupports(){
  if(!staffFilter) return supports;
  return supports.filter(function(s){
    var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
    return names.some(function(n){ return n&&n.includes(staffFilter); });
  });
}
function renderCalendar(){
  var el=document.getElementById('cal-title'); if(el) el.textContent=calYear+'년 '+(calMonth+1)+'월';
  if(calView==='week'){renderWeekView();return;}
  renderMonthView();
}
function renderMonthView(){
  var filtered=filterSupports(),dayMap={};
  filtered.forEach(function(s){ if(!s.date) return; var k=s.date.slice(0,10); if(!dayMap[k]) dayMap[k]=[]; dayMap[k].push(s); });
  var firstDay=new Date(calYear,calMonth,1).getDay(),lastDate=new Date(calYear,calMonth+1,0).getDate();
  var today=new Date().toISOString().slice(0,10);
  var html='<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(function(d){ html+='<div class="cal-header-cell">'+d+'</div>'; });
  for(var i=0;i<firstDay;i++) html+='<div class="cal-cell empty"></div>';
  for(var d=1;d<=lastDate;d++){
    var key=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var items=dayMap[key]||[],isToday=key===today;
    html+='<div class="cal-cell'+(isToday?' today':'')+'" onclick="openCalPopup(\''+key+'\')">'+
      '<div class="cal-date">'+d+'</div>'+
      '<div class="cal-dot-row">'+
        items.slice(0,4).map(function(s){
          var staffStr=s.staffNames&&s.staffNames.length?s.staffNames[0]:(s.staffName||'');
          var cls=getStaffChipClass(staffStr);
          var colors={'chip-a':'#BFDBFE','chip-b':'#BBF7D0','chip-c':'#FED7AA','chip-d':'#E9D5FF','chip-e':'#A7F3D0','chip-f':'#FDE68A','chip-g':'#FECACA','chip-h':'#E2E8F0','chip-i':'#FBCFE8'};
          return '<div class="cal-dot" style="background:'+(colors[cls]||'#E2E8F0')+';"></div>';
        }).join('')+
      '</div>'+
      items.slice(0,2).map(function(s){
        var staffStr=s.staffNames&&s.staffNames.length?s.staffNames[0]:(s.staffName||'');
        var cls=getStaffChipClass(staffStr);
        var bgColors={'chip-a':'#EFF6FF','chip-b':'#F0FDF4','chip-c':'#FFF7ED','chip-d':'#FDF4FF','chip-e':'#ECFDF5','chip-f':'#FFFBEB','chip-g':'#FEF2F2','chip-h':'#F8FAFC','chip-i':'#FDF2F8'};
        var txColors={'chip-a':'#1D4ED8','chip-b':'#15803D','chip-c':'#C2410C','chip-d':'#7E22CE','chip-e':'#065F46','chip-f':'#92400E','chip-g':'#B91C1C','chip-h':'#475569','chip-i':'#9D174D'};
        return '<div class="cal-event-pill" style="background:'+(bgColors[cls]||'#F8FAFC')+';color:'+(txColors[cls]||'#475569')+';">'+s.bizName+'</div>';
      }).join('')+
      (items.length>2?'<div style="font-size:8px;color:var(--gray-400);padding:1px 2px;">+' +(items.length-2)+'</div>':'')+
      '</div>';
  }
  html+='</div>';
  var calEl=document.getElementById('calendar'); if(calEl) calEl.innerHTML=html;
}
function renderWeekView(){
  var today=new Date(),startOfWeek=new Date(today);
  startOfWeek.setDate(today.getDate()-today.getDay()+1);
  var days=[];
  for(var i=0;i<7;i++){ var d=new Date(startOfWeek); d.setDate(startOfWeek.getDate()+i); days.push(d); }
  var todayStr=today.toISOString().slice(0,10);
  var filtered=filterSupports();
  var staffOrder=['박주형 본부장','김재희 차장','손도란 대리','이소영 주임','김상준 주임','안은재 주임','견병록 매니저','임성창 차장','김동현 대리'];
  var dayLabels=['월','화','수','목','금','토','일'];
  var bgColors={'chip-a':'#EFF6FF','chip-b':'#F0FDF4','chip-c':'#FFF7ED','chip-d':'#FDF4FF','chip-e':'#ECFDF5','chip-f':'#FFFBEB','chip-g':'#FEF2F2','chip-h':'#F8FAFC','chip-i':'#FDF2F8'};
  var txColors={'chip-a':'#1D4ED8','chip-b':'#15803D','chip-c':'#C2410C','chip-d':'#7E22CE','chip-e':'#065F46','chip-f':'#92400E','chip-g':'#B91C1C','chip-h':'#475569','chip-i':'#9D174D'};
  var html='<div class="week-view"><table class="week-table"><thead><tr><th style="text-align:left;padding-left:8px;">담당자</th>';
  days.forEach(function(d,i){
    var dStr=d.toISOString().slice(0,10),isToday=dStr===todayStr;
    html+='<th class="'+(isToday?'today-col':'')+'">'+dayLabels[i]+'<br><span style="font-size:13px;font-weight:700;">'+d.getDate()+'</span></th>';
  });
  html+='</tr></thead><tbody>';
  staffOrder.forEach(function(staff){
    var cls=getStaffChipClass(staff);
    html+='<tr><td class="week-staff-name"><span class="staff-chip '+cls+'" style="font-size:10px;">'+staff.split(' ')[0]+'</span></td>';
    days.forEach(function(d){
      var dStr=d.toISOString().slice(0,10),isToday=dStr===todayStr;
      var items=filtered.filter(function(s){
        if(!s.date||s.date.slice(0,10)!==dStr) return false;
        var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
        return names.some(function(n){ return n&&n.includes(staff.split(' ')[0]); });
      });
      html+='<td class="'+(isToday?'today-col':'')+'">'+
        items.map(function(s){
          return '<div class="week-event" style="background:'+(bgColors[cls]||'#F8FAFC')+';color:'+(txColors[cls]||'#475569')+'" onclick="openCalPopup(\''+s.date.slice(0,10)+'\')">'+s.bizName+'</div>';
        }).join('')+'</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  var calEl=document.getElementById('calendar'); if(calEl) calEl.innerHTML=html;
}

// ── 지원이력 ──────────────────────────
function renderSupportList(){
  var listEl=document.getElementById('support-list'); if(!listEl) return;
  var sorted=supports.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var el=document.getElementById('sup-list-count'); if(el) el.textContent=sorted.length+'건';
  if(!sorted.length){ listEl.innerHTML='<div class="empty"><i class="ti ti-calendar"></i><p>지원 이력이 없어요</p></div>'; return; }
  listEl.innerHTML=sorted.map(function(s){
    var c=contracts.find(function(x){ return x.name===s.bizName; }),cid=c?c.id:'';
    var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
    var cls=getStaffChipClass(staffStr);
    var mealStr=s.meals&&s.meals.length?s.meals.join('/'):'';
    return '<div class="sup-list-row">'+
      '<span style="font-size:12px;color:var(--gray-400);">'+(s.date||'').slice(5)+'</span>'+
      '<span>'+(mealStr?'<span class="badge badge-gray" style="font-size:10px;">'+mealStr+'</span>':'-')+'</span>'+
      '<div style="min-width:0;"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(cid?'color:var(--blue);cursor:pointer;':'')+'"'+(cid?' onclick="goDetail(\''+cid+'\')"':'')+'>'+s.bizName+'</div>'+
        '<div style="margin-top:2px;"><span class="staff-chip '+cls+'" style="font-size:10px;">'+staffStr+'</span></div></div>'+
      '<span class="badge badge-gray" style="font-size:10px;">'+( s.category||'-')+'</span>'+
      '<div style="display:flex;gap:4px;justify-content:flex-end;">'+
        '<button class="btn-icon" style="width:28px;height:28px;" onclick="editSupport(\''+s.id+'\')"><i class="ti ti-edit" style="font-size:14px;"></i></button>'+
        '<button class="btn-icon" style="width:28px;height:28px;background:var(--red-light);color:var(--red);" onclick="delSupport(\''+s.id+'\')"><i class="ti ti-trash" style="font-size:14px;"></i></button>'+
      '</div></div>';
  }).join('');
}

// ── 달력 팝업 ──────────────────────────
window.openCalPopup=function(dateKey){
  var items=supports.filter(function(s){ return s.date&&s.date.slice(0,10)===dateKey; });
  if(!items.length) return;
  var html=items.map(function(s){
    var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
    var cls=getStaffChipClass(staffStr);
    var mealStr=s.meals&&s.meals.length?s.meals.join('/'):'';
    return '<div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">'+s.bizName+'</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">'+
          '<span class="badge badge-gray" style="font-size:10px;">'+s.category+'</span>'+
          (mealStr?'<span class="badge badge-gray" style="font-size:10px;">'+mealStr+'</span>':'')+
          '<span class="staff-chip '+cls+'" style="font-size:10px;">'+staffStr+'</span>'+
        '</div>'+
        (s.content?'<div style="font-size:12px;color:var(--gray-500);">'+s.content+'</div>':'')+
      '</div>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        '<button class="btn-icon" style="width:28px;height:28px;" onclick="editSupportFromPopup(\''+s.id+'\')"><i class="ti ti-edit" style="font-size:14px;"></i></button>'+
        '<button class="btn-icon" style="width:28px;height:28px;background:var(--red-light);color:var(--red);" onclick="delSupportFromPopup(\''+s.id+'\',\''+dateKey+'\')"><i class="ti ti-trash" style="font-size:14px;"></i></button>'+
      '</div></div>';
  }).join('');
  var popup=document.getElementById('cal-popup');
  if(!popup){
    popup=document.createElement('div');
    popup.id='cal-popup';
    popup.style.cssText='display:none;position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:400;align-items:center;justify-content:center;';
    popup.innerHTML='<div style="background:#fff;border-radius:16px;width:420px;max-width:95vw;max-height:80vh;overflow-y:auto;">'+
      '<div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);display:flex;align-items:center;justify-content:space-between;">'+
        '<h4 id="cal-popup-title" style="font-size:15px;font-weight:700;"></h4>'+
        '<button class="btn-icon" onclick="closeCalPopup()"><i class="ti ti-x"></i></button>'+
      '</div><div style="padding:0 20px;" id="cal-popup-body"></div></div>';
    popup.addEventListener('click',function(e){ if(e.target===popup) closeCalPopup(); });
    document.body.appendChild(popup);
  }
  document.getElementById('cal-popup-title').textContent=dateKey+' 지원 내역';
  document.getElementById('cal-popup-body').innerHTML=html;
  popup.style.display='flex';
};
window.closeCalPopup=function(){ var p=document.getElementById('cal-popup'); if(p) p.style.display='none'; };
window.editSupportFromPopup=function(id){ closeCalPopup(); window.editSupport(id); };
window.delSupportFromPopup=async function(id){
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); closeCalPopup(); } catch(e){ showToast('오류 발생'); }
};

// ── 검색 드롭다운 ──────────────────────────
function initSS(){ renderSSOptions(''); }
function renderSSOptions(q){
  var dd=document.getElementById('ss-dropdown'); if(!dd) return;
  var f=ssOptions.filter(function(c){ return !q||c.name.toLowerCase().includes(q.toLowerCase()); });
  dd.innerHTML=f.length?f.map(function(c){ return '<div class="search-opt" onmousedown="selectSS(\''+c.name.replace(/'/g,"\\'")+'\')">'+c.name+'</div>'; }).join(''):'<div class="search-opt" style="color:var(--gray-400);">없음</div>';
}
window.filterSS=function(){ renderSSOptions(document.getElementById('ss-input').value); document.getElementById('sup-biz').value=''; };
window.openSS=function(){ document.getElementById('ss-dropdown').classList.add('open'); renderSSOptions(document.getElementById('ss-input').value); };
window.closeSS=function(){ document.getElementById('ss-dropdown').classList.remove('open'); };
window.selectSS=function(name){
  document.getElementById('ss-input').value=name;
  document.getElementById('sup-biz').value=name;
  document.getElementById('ss-dropdown').classList.remove('open');
  var c=contracts.find(function(x){ return x.name===name; });
  var nutriEl=document.getElementById('sup-nutri-info');
  if(nutriEl){
    if(c&&c.nutritionists&&c.nutritionists.length){ nutriEl.textContent='담당영양사: '+c.nutritionists.map(function(n){ return n.name; }).join(', '); nutriEl.style.display='block'; }
    else nutriEl.style.display='none';
  }
};

// ── 운영지원 등록/수정 모달 ──────────────────────────
window.openSupportModal=function(){
  editingSupportId=null;
  document.getElementById('sup-modal-title').textContent='운영지원 등록';
  document.getElementById('ss-input').value='';
  document.getElementById('sup-biz').value='';
  document.getElementById('sup-date').value='';
  document.getElementById('sup-cat').value='';
  document.getElementById('sup-content').value='';
  var nutriEl=document.getElementById('sup-nutri-info'); if(nutriEl) nutriEl.style.display='none';
  resetMealChips(); resetStaffChips();
  document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 등록';
  document.getElementById('sup-modal').classList.add('open');
};
window.closeSupportModal=function(){
  document.getElementById('sup-modal').classList.remove('open');
  editingSupportId=null;
};
window.submitSupport=async function(){
  var biz=document.getElementById('sup-biz').value,date=document.getElementById('sup-date').value;
  var meals=getSelectedMeals(),staffNames=getSelectedStaff();
  var cat=document.getElementById('sup-cat').value,content=document.getElementById('sup-content').value.trim();
  if(!biz||!date||!cat){ showToast('업장, 일자, 카테고리는 필수예요.'); return; }
  var data={bizName:biz,date:date,timeStart:'',timeEnd:'',meals:meals,staffName:staffNames.join(', '),staffNames:staffNames,category:cat,content:content};
  try{
    if(editingSupportId){ await updateSupport(editingSupportId,data); editingSupportId=null; showToast('수정되었습니다.'); }
    else{ await addSupport(data); showToast('등록되었습니다.'); }
    resetMealChips(); resetStaffChips();
    document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 등록';
    closeSupportModal();
  } catch(e){ showToast('오류가 발생했습니다.'); }
};
window.editSupport=function(id){
  var s=supports.find(function(x){ return x.id===id; }); if(!s) return;
  editingSupportId=id;
  window.selectSS(s.bizName||'');
  document.getElementById('sup-date').value=s.date||'';
  document.getElementById('sup-cat').value=s.category||'';
  document.getElementById('sup-content').value=s.content||'';
  setSelectedMeals(s.meals||[]);
  setSelectedStaff(s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]));
  document.getElementById('sup-modal-title').textContent='운영지원 수정';
  document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 수정 저장';
  document.getElementById('sup-modal').classList.add('open');
};
window.delSupport=async function(id){
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); } catch(e){ showToast('오류 발생'); }
};

// ── FS 사업장 현황 ──────────────────────────
window.setBizTab=function(tab){
  currentBizTab=tab;
  document.querySelectorAll('.segment-btn').forEach(function(b){ b.classList.remove('active'); });
  var btns=document.querySelectorAll('#page-businesses .segment-btn');
  var idx={team:0,resp:1,region:2};
  if(btns[idx[tab]!==undefined?idx[tab]:0]) btns[idx[tab]!==undefined?idx[tab]:0].classList.add('active');
  if(mapInstance&&tab!=='region'){ mapInstance.remove(); mapInstance=null; }
  renderBizTab();
};
window.toggleTeamSection=function(id){
  var body=document.getElementById(id); if(!body) return;
  body.style.display=body.style.display==='none'?'block':'none';
};
window.renderBizTab=function(){
  var q=(document.getElementById('biz-search')?document.getElementById('biz-search').value:'').toLowerCase();
  var el=document.getElementById('biz-content'); if(!el) return;
  var filtered=contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q)||(c.addr||'').toLowerCase().includes(q); });

  function bizCard(c){
    var s=calcStatus(c),d=dDiff(c.endDate);
    var col=s==='urgent'?'var(--red)':s==='auto'?'var(--blue)':s==='near'?'var(--amber)':'var(--green)';
    var badgeCls=s==='urgent'?'badge-urgent':s==='near'?'badge-near':s==='auto'?'badge-auto':'badge-ok';
    var nutriStr=c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return nt.name; }).join(', '):'';
    return '<div class="biz-card" onclick="goDetail(\''+c.id+'\')">'+
      '<div class="biz-card-top">'+
        '<div class="biz-card-name">'+c.name+'</div>'+
        '<span class="badge '+badgeCls+'">'+STATUS_META[s].label+'</span>'+
      '</div>'+
      '<div class="biz-card-info">'+
        (nutriStr?'<i class="ti ti-user" style="font-size:12px;"></i>'+nutriStr+' · ':'')+(c.addr||'-')+
      '</div>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">'+
        '<span style="font-size:12px;color:var(--gray-400);">'+fmtDate(c.endDate)+'</span>'+
        '<span class="biz-card-dday" style="color:'+col+';">'+dDayLabel(d)+'</span>'+
      '</div>'+
      '</div>';
  }

  if(currentBizTab==='team'){
    var t1=filtered.filter(function(c){ return c.team===1; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    var t2=filtered.filter(function(c){ return c.team===2; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    el.innerHTML=
      '<div style="margin-bottom:12px;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;cursor:pointer;" onclick="toggleTeamSection(\'t1-body\')">'+
          '<div style="font-size:15px;font-weight:700;">1팀 — 박주형 본부장</div>'+
          '<span class="badge badge-auto">'+t1.length+'개소</span>'+
        '</div>'+
        '<div id="t1-body">'+t1.map(bizCard).join('')+'</div>'+
      '</div>'+
      '<div>'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;cursor:pointer;" onclick="toggleTeamSection(\'t2-body\')">'+
          '<div style="font-size:15px;font-weight:700;">2팀 — 김재희 차장</div>'+
          '<span class="badge badge-auto">'+t2.length+'개소</span>'+
        '</div>'+
        '<div id="t2-body">'+t2.map(bizCard).join('')+'</div>'+
      '</div>';
  } else if(currentBizTab==='resp'){
    var ro=['손도란 대리','이소영 주임','김상준 주임','견병록 매니저'];
    el.innerHTML=ro.map(function(r,i){
      var list=filtered.filter(function(c){ return c.resp===r; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
      var rid='rb'+i+'-body';
      return '<div style="margin-bottom:12px;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;cursor:pointer;" onclick="toggleTeamSection(\''+rid+'\')">'+
          '<div style="font-size:15px;font-weight:700;">'+r+'</div>'+
          '<span class="badge badge-auto">'+list.length+'개소</span>'+
        '</div>'+
        '<div id="'+rid+'">'+list.map(bizCard).join('')+'</div>'+
      '</div>';
    }).join('');
  } else {
    el.innerHTML='<div style="margin-bottom:10px;display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--gray-500);">'+
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#EF4444;display:inline-block;"></span>긴급</span>'+
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#F59E0B;display:inline-block;"></span>임박</span>'+
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#3B82F6;display:inline-block;"></span>여유</span>'+
    '</div><div id="map"></div>';
    setTimeout(function(){
      if(mapInstance){mapInstance.remove();mapInstance=null;}
      mapInstance=L.map('map').setView([36.98,127.05],9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInstance);
      filtered.forEach(function(c){
        var coord=(c.lat&&c.lng)?{lat:c.lat,lng:c.lng}:COORDS[c.name]; if(!coord) return;
        var s=calcStatus(c),color=s==='urgent'?'#EF4444':s==='near'?'#F59E0B':'#3B82F6';
        var marker=L.circleMarker([coord.lat,coord.lng],{radius:s==='urgent'?9:7,fillColor:color,color:'#fff',weight:2,fillOpacity:0.9}).addTo(mapInstance);
        marker.bindTooltip(c.name,{permanent:true,direction:'top',offset:[0,-8],opacity:.95,className:'map-label'});
        marker.on('click',function(){ window.goDetail(c.id); });
      });
    },100);
  }
};

// ── 관리자 ──────────────────────────
window.renderAdmin=function(){
  var searchEl=document.getElementById('admin-search'),q=searchEl?searchEl.value.toLowerCase():'';
  var rows=contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q); }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  var el=document.getElementById('admin-count'); if(el) el.textContent=rows.length+'개소';
  var listEl=document.getElementById('admin-list'); if(!listEl) return;
  listEl.innerHTML=rows.length?rows.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate);
    var col=s==='urgent'?'var(--red)':s==='auto'?'var(--blue)':s==='near'?'var(--amber)':'var(--gray-400)';
    var badgeCls=s==='urgent'?'badge-urgent':s==='near'?'badge-near':s==='auto'?'badge-auto':'badge-ok';
    return '<div class="admin-row" onclick="openEditModal(\''+c.id+'\')">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'+
          '<span class="badge '+badgeCls+'">'+STATUS_META[s].label+'</span>'+
          '<span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+c.name+'</span>'+
        '</div>'+
        '<div style="font-size:12px;color:var(--gray-400);">'+fmtDate(c.endDate)+' · '+priceLabel(c)+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'+
        '<span style="font-size:13px;font-weight:700;color:'+col+';">'+dDayLabel(d)+'</span>'+
        '<button class="btn-icon" style="width:32px;height:32px;background:var(--red-light);color:var(--red);" onclick="event.stopPropagation();handleDelete(\''+c.id+'\',\''+c.name.replace(/'/g,'')+'\')"><i class="ti ti-trash" style="font-size:15px;"></i></button>'+
      '</div></div>';
  }).join(''):'<div class="empty"><i class="ti ti-building"></i><p>사업장이 없어요</p></div>';
};

// ── 계약 모달 ──────────────────────────
window.openAddModal=function(){
  editingId=null;
  document.getElementById('modal-title').textContent='계약 추가';
  document.getElementById('contract-form').reset();
  setContacts([]); setMeals(null); setNutritionists([]);
  switchModalTab('basic');
  document.getElementById('tab-hist-btn').style.display='none';
  document.getElementById('modal-overlay').classList.add('open');
};
window.openEditModal=function(id){
  if(!id||id==='undefined') return;
  var c=contracts.find(function(x){ return x.id===id; }); if(!c) return;
  editingId=id;
  document.getElementById('modal-title').textContent='계약 수정 — '+c.name;
  document.getElementById('f-name').value=c.name||'';
  document.getElementById('f-addr').value=c.addr||'';
  document.getElementById('f-team').value=c.team||1;
  document.getElementById('f-resp').value=c.resp||'';
  document.getElementById('f-startDate').value=toInputDate(c.startDate);
  document.getElementById('f-endDate').value=toInputDate(c.endDate);
  document.getElementById('f-price').value=c.price||'';
  document.getElementById('f-priceType').value=c.priceType||'per-meal';
  document.getElementById('f-avgMeals').value=c.avgMeals||'';
  document.getElementById('f-note').value=c.note||'';
  if(c.contacts&&c.contacts.length) setContacts(c.contacts);
  else setContacts([{name:c.contactName||'',phone:c.contactPhone||'',tel:c.tel||''}]);
  setMeals(c.meals); setNutritionists(c.nutritionists||[]);
  switchModalTab('basic');
  document.getElementById('tab-hist-btn').style.display='inline-block';
  document.getElementById('modal-overlay').classList.add('open');
};
window.closeModal=function(){ document.getElementById('modal-overlay').classList.remove('open'); };
window.saveContract=async function(){
  var name=document.getElementById('f-name').value.trim(),endDate=document.getElementById('f-endDate').value;
  if(!name||!endDate){ showToast('사업장명과 종료일은 필수입니다.'); return; }
  var contacts=getContacts(),meals=getMeals(),addr=document.getElementById('f-addr').value.trim();
  var lat=null,lng=null;
  if(addr){
    try{
      await new Promise(function(resolve){
        if(!window.kakaoReady){resolve();return;}
        var geocoder=new kakao.maps.services.Geocoder();
        geocoder.addressSearch(addr,function(result,status){
          if(status===kakao.maps.services.Status.OK){lat=parseFloat(result[0].y);lng=parseFloat(result[0].x);}
          resolve();
        });
      });
    } catch(e){}
  }
  var data={name:name,addr:addr,contacts:contacts,contactName:contacts.length?contacts[0].name:'',contactPhone:contacts.length?contacts[0].phone:'',tel:contacts.length?contacts[0].tel:'',team:parseInt(document.getElementById('f-team').value)||1,resp:document.getElementById('f-resp').value,startDate:document.getElementById('f-startDate').value,endDate:endDate,price:parseInt(document.getElementById('f-price').value)||0,priceType:document.getElementById('f-priceType').value,meals:meals,avgMeals:parseInt(document.getElementById('f-avgMeals').value)||0,autoRenew:true,note:document.getElementById('f-note').value.trim(),lat:lat,lng:lng,nutritionists:getNutritionists()};
  try{
    if(editingId){
      var oldContract=contracts.find(function(x){ return x.id===editingId; });
      var oldName=oldContract?oldContract.name:'';
      await updateContract(editingId,data);
      if(oldName&&oldName!==name){
        var supsToUpdate=supports.filter(function(s){ return s.bizName===oldName; });
        for(var i=0;i<supsToUpdate.length;i++) await updateSupportBizName(supsToUpdate[i].id,name);
        var {db}=await import('./db.js');
        var {doc,updateDoc}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await updateDoc(doc(db,'history',editingId),{name:name});
      }
      showToast('수정되었습니다.');
    } else {
      var ref=await addContract(data);
      editingId=ref.id;
      await addHistory(ref.id,name,{startDate:data.startDate,endDate:data.endDate,price:data.price,note:data.note,updatedAt:new Date().toISOString()});
      showToast('추가되었습니다.');
    }
    closeModal(); window.renderAdmin();
    var c=contracts.find(function(x){ return x.id===editingId; });
    if(c&&document.getElementById('detail-screen').style.display==='flex') renderDetail(c);
  } catch(e){ console.error(e); showToast('저장 중 오류가 발생했습니다.'); }
};
window.handleDelete=async function(id,name){
  if(!confirm(name+' 계약을 삭제할까요?')) return;
  try{ await deleteContract(id); showToast(name+' 삭제되었습니다.'); window.renderAdmin(); } catch(e){ showToast('삭제 중 오류가 발생했습니다.'); }
};
window.exportExcel=function(){
  if(!window.XLSX){ showToast('잠시 후 다시 시도해 주세요.'); return; }
  var rows=[['번호','사업장','소재지','팀','책임','담당 영양사','담당자','연락처','시작일','종료일','D-day','단가','평균식수','운영끼니','상태','비고']];
  contracts.slice().sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); }).forEach(function(c){
    var s=calcStatus(c);
    var ns=c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return nt.name+(nt.phone?' '+nt.phone:''); }).join(' / '):'';
    var cs=c.contacts&&c.contacts.length?c.contacts.map(function(ct){ return ct.name+(ct.phone?' '+ct.phone:''); }).join(' / '):(c.contactName||'');
    rows.push([c.no||'',c.name,c.addr||'',c.team||'',c.resp||'',ns,cs,c.contactPhone||'',fmtDate(c.startDate),fmtDate(c.endDate),dDiff(c.endDate),priceLabel(c),c.avgMeals||'',mealsDisplay(c.meals),STATUS_META[s].label,c.note||'']);
  });
  var wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,'계약현황');
  XLSX.writeFile(wb,'FS사업장현황_'+new Date().toISOString().slice(0,10)+'.xlsx');
  showToast('엑셀 저장되었습니다.');
};

// ── 토스트 ──────────────────────────
function showToast(msg){
  var existing=document.querySelector('.toast'); if(existing) existing.remove();
  var el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(function(){ el.remove(); },2800);
}

// ── 초기 페이지 ──────────────────────────
document.getElementById('modal-overlay').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closeModal(); });
document.getElementById('sup-modal').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closeSupportModal(); });
window.goPage('dashboard');
