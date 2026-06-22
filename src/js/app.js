import { listenContracts, listenHistory, listenSupports, addContract, updateContract, deleteContract, addHistory, addSupport, updateSupport, updateSupportBizName, deleteSupport, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, dDiff, dDayLabel, priceLabel } from './utils.js';

var contracts = [];
var historyData = [];
var supports = [];
var editingId = null;
var editingSupportId = null;
var currentPage = '';
var currentBizTab = 'team';
var mapInstance = null;
var calYear = new Date().getFullYear();
var calMonth = new Date().getMonth();
var calView = 'week';
var staffFilter = null;
var ssOptions = [];
var currentModalTab = 'basic';
var weekOffset = 0;
window.detailId = null;
window._typeSelectDate = null;
window._typeSelectStaff = null;

function localDateStr(d) {
  var dt=d||new Date();
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}

var STAFF_COLORS = {
  '박주형':'sc-박주형','김재희':'sc-김재희','손도란':'sc-손도란',
  '이소영':'sc-이소영','김상준':'sc-김상준','안은재':'sc-안은재',
  '견병록':'sc-견병록','임성창':'sc-임성창','김동현':'sc-김동현',
};
function getStaffColor(name) {
  if(!name) return '';
  for(var k in STAFF_COLORS) { if(name.includes(k)) return STAFF_COLORS[k]; }
  return '';
}
var STAFF_BORDER_COLORS = {
  '박주형':'#185FA5','김재희':'#3B6D11','손도란':'#854F0B',
  '이소영':'#6B2FA0','김상준':'#A32D2D','안은재':'#0B6B5A',
  '견병록':'#6B5B0B','임성창':'#444','김동현':'#A32D6B',
};
function getStaffBorderColor(name) {
  if(!name) return '#ccc';
  for(var k in STAFF_BORDER_COLORS) { if(name.includes(k)) return STAFF_BORDER_COLORS[k]; }
  return '#ccc';
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

// ── 전화번호 ──────────────────────────
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

// ── 끼니 칩 (계약 모달) ──────────────────────────
window.updateChip = function(cb) {
  var label=cb.closest('.meal-chip');
  if(label) label.classList.toggle('checked',cb.checked);
  if(cb.dataset&&cb.dataset.day==='weekday'&&cb.value){
    var rows=document.querySelectorAll('.meal-time-row');
    rows.forEach(function(row){
      if(row.getAttribute('data-meal')===cb.value){
        row.style.display=cb.checked?'flex':'none';
        if(!cb.checked){
          var st=row.querySelector('.meal-time-start'); if(st) st.value='';
          var en=row.querySelector('.meal-time-end'); if(en) en.value='';
        }
      }
    });
  }
};
window.toggleWeekend = function(day) {
  var cb=document.getElementById('meal-'+day),sub=document.getElementById('meal-'+day+'-sub');
  if(!cb||!sub) return;
  sub.style.display=cb.checked?'flex':'none';
  if(!cb.checked) sub.querySelectorAll('input[type=checkbox]').forEach(function(c){ c.checked=false; c.closest('.meal-chip')&&c.closest('.meal-chip').classList.remove('checked'); });
};
function getMeals() {
  var r={weekday:[],sat:[],sun:[],times:{}};
  document.querySelectorAll('.meal-cb[data-day="weekday"]:checked').forEach(function(cb){ r.weekday.push(cb.value); });
  document.querySelectorAll('.meal-time-row').forEach(function(row){
    var meal=row.dataset.meal;
    var start=row.querySelector('.meal-time-start').value;
    var end=row.querySelector('.meal-time-end').value;
    if(start) r.times[meal]={start:start,end:end||''};
  });
  if(document.getElementById('meal-sat')&&document.getElementById('meal-sat').checked)
    document.querySelectorAll('.meal-cb[data-day="sat"]:checked').forEach(function(cb){ r.sat.push(cb.value); });
  if(document.getElementById('meal-sun')&&document.getElementById('meal-sun').checked)
    document.querySelectorAll('.meal-cb[data-day="sun"]:checked').forEach(function(cb){ r.sun.push(cb.value); });
  return r;
}
function setMeals(meals) {
  document.querySelectorAll('.meal-cb').forEach(function(cb){ cb.checked=false; cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.remove('checked'); });
  ['sat','sun'].forEach(function(d){ var cb=document.getElementById('meal-'+d),sub=document.getElementById('meal-'+d+'-sub'); if(cb)cb.checked=false; if(sub)sub.style.display='none'; });
  document.querySelectorAll('.meal-time-row').forEach(function(row){
    row.style.display='none';
    row.querySelector('.meal-time-start').value='';
    row.querySelector('.meal-time-end').value='';
  });
  if(!meals) return;
  if(typeof meals==='string'){ meals.split('/').forEach(function(v){ var cb=document.querySelector('.meal-cb[data-day="weekday"][value="'+v.trim()+'"]'); if(cb){cb.checked=true;cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.add('checked');} }); return; }
  ['weekday','sat','sun'].forEach(function(day){
    if(!meals[day]||!meals[day].length) return;
    if(day!=='weekday'){ var cb=document.getElementById('meal-'+day),sub=document.getElementById('meal-'+day+'-sub'); if(cb)cb.checked=true; if(sub)sub.style.display='flex'; }
    meals[day].forEach(function(v){ var cb=document.querySelector('.meal-cb[data-day="'+day+'"][value="'+v+'"]'); if(cb){cb.checked=true;cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.add('checked');} });
  });
  if(meals.times){
    Object.keys(meals.times).forEach(function(meal){
      var row=document.querySelector('.meal-time-row[data-meal="'+meal+'"]');
      if(row){
        row.style.display='flex';
        row.querySelector('.meal-time-start').value=meals.times[meal].start||'';
        row.querySelector('.meal-time-end').value=meals.times[meal].end||'';
      }
    });
  }
}
function mealsDisplay(meals) {
  if(!meals) return '-';
  if(typeof meals==='string') return meals;
  var mealNames={조:'조식',중:'중식',석:'석식',야:'야식'};
  var p=[];
  if(meals.weekday&&meals.weekday.length){
    var wd=meals.weekday.map(function(v){
      var label=mealNames[v]||v;
      if(meals.times&&meals.times[v]){
        label+=' '+meals.times[v].start;
        if(meals.times[v].end) label+='~'+meals.times[v].end;
      }
      return label;
    });
    p.push('평일: '+wd.join(' / '));
  }
  if(meals.sat&&meals.sat.length) p.push('토: '+meals.sat.join('/'));
  if(meals.sun&&meals.sun.length) p.push('일: '+meals.sun.join('/'));
  return p.join(' | ')||'-';
}
function priceHistLabel(r) {
  if(r.priceType==='management') return '관리비제';
  if(r.priceType==='fixed') return (r.price?Number(r.price).toLocaleString()+'원':'0원')+' (고정)';
  return (r.price?Number(r.price).toLocaleString()+'원':'0원')+'/식';
}

// ── 담당자 ──────────────────────────
window.addContactRow = function() {
  var wrap=document.getElementById('contact-rows'); if(!wrap) return;
  var div=document.createElement('div'); div.className='contact-row';
  div.innerHTML='<input type="text" placeholder="이름 · 직책" class="contact-name">'+
    '<input type="text" placeholder="연락처" class="contact-phone" oninput="formatPhone(this)">'+
    '<input type="text" placeholder="대표번호" class="contact-tel" oninput="formatPhone(this)">'+
    '<button type="button" class="btn sm danger" onclick="removeContactRow(this)"><i class="ti ti-trash"></i></button>';
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
      '<button type="button" class="btn sm danger" onclick="removeContactRow(this)"><i class="ti ti-trash"></i></button>';
    wrap.appendChild(div);
  });
}
window.addNutriRow = function() {
  var wrap=document.getElementById('nutritionist-rows'); if(!wrap) return;
  var div=document.createElement('div'); div.className='nutri-row'; div.style.cssText='display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  div.innerHTML='<input type="text" placeholder="이름 · 직책" class="nutri-name" style="flex:1;padding:7px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;">'+
    '<input type="text" placeholder="연락처" class="nutri-phone" oninput="formatPhone(this)" style="flex:1;padding:7px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;">'+
    '<button type="button" class="btn sm danger" onclick="removeNutriRow(this)"><i class="ti ti-trash"></i></button>';
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
    if(n||p){
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
    var div=document.createElement('div'); div.className='nutri-row'; div.style.cssText='display:flex;gap:8px;align-items:center;margin-bottom:6px;';
    div.innerHTML='<input type="text" placeholder="이름 · 직책" class="nutri-name" value="'+(nt.name||'')+'" style="flex:1;padding:7px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;">'+
      '<input type="text" placeholder="연락처" class="nutri-phone" value="'+(nt.phone||'')+'" oninput="formatPhone(this)" style="flex:1;padding:7px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;">'+
      '<button type="button" class="btn sm danger" onclick="removeNutriRow(this)"><i class="ti ti-trash"></i></button>';
    wrap.appendChild(div);
  });
}

// ── 운영지원 칩 ──────────────────────────
window.toggleStaffChip = function(el, name) {
  el.classList.toggle('selected');
  var cls=getStaffColor(name);
  if(el.classList.contains('selected')){ if(cls){ el.className='staff-chip '+cls; el.classList.add('selected'); } }
  else el.className='staff-chip';
};
window.toggleMealChip = function(el) { el.classList.toggle('selected'); };
window.toggleTeamDropdown = function(id) {
  closeDropdowns();
  var el=document.getElementById(id); if(el) el.style.display=el.style.display==='none'?'block':'none';
};
window.closeDropdowns = function() {
  ['op-dropdown','sup-dropdown'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
};
document.addEventListener('click',function(e){
  if(!e.target.closest('[onclick*="toggleTeamDropdown"]')&&!e.target.closest('[id$="-dropdown"]')) window.closeDropdowns();
});
function getSelectedMeals() {
  var r=[]; document.querySelectorAll('#meal-chip-wrap .staff-chip.selected').forEach(function(c){ r.push(c.textContent.trim()); }); return r;
}
function resetMealChips() {
  document.querySelectorAll('#meal-chip-wrap .staff-chip').forEach(function(c){ c.className='staff-chip'; });
}
function setSelectedMeals(meals) {
  resetMealChips();
  if(!meals||!meals.length) return;
  document.querySelectorAll('#meal-chip-wrap .staff-chip').forEach(function(c){ if(meals.indexOf(c.textContent.trim())!==-1) c.classList.add('selected'); });
}
function getSelectedStaff() {
  var r=[]; document.querySelectorAll('#staff-chip-wrap .staff-chip.selected').forEach(function(c){ r.push(c.textContent.trim()); }); return r;
}
function resetStaffChips() {
  document.querySelectorAll('#staff-chip-wrap .staff-chip').forEach(function(c){ c.classList.remove('selected'); });
}
function setSelectedStaff(names) {
  resetStaffChips();
  if(!names||!names.length) return;
  document.querySelectorAll('#staff-chip-wrap .staff-chip').forEach(function(c){ if(names.some(function(n){ return n===c.textContent.trim(); })) c.classList.add('selected'); });
}
window.toggleSpecialMenu=function(cat){
  var wrap=document.getElementById('special-menu-wrap');
  if(!wrap) return;
  var show=cat==='특식지원'||cat==='이벤트';
  wrap.style.display=show?'block':'none';
  if(!show){ var inp=document.getElementById('sup-special-menu'); if(inp) inp.value=''; }
};

// ── 모달 탭 ──────────────────────────
window.switchModalTab = function(tab) {
  currentModalTab=tab;
  document.getElementById('tab-basic').style.display=tab==='basic'?'block':'none';
  document.getElementById('tab-hist').style.display=tab==='hist'?'block':'none';
  document.getElementById('tab-basic-btn').classList.toggle('active',tab==='basic');
  document.getElementById('tab-hist-btn').classList.toggle('active',tab==='hist');
  document.getElementById('modal-save-btn').style.display=tab==='basic'?'inline-flex':'none';
  if(tab==='hist') renderHistTab();
};

// ── 히스토리 탭 ──────────────────────────
function renderHistTab() {
  var el=document.getElementById('hist-list'); if(!el) return;
  el.innerHTML='';
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  var records=h&&h.records?h.records:[];
  if(!records.length){ el.innerHTML='<div class="empty-state"><i class="ti ti-history"></i>이력이 없어요</div>'; return; }
  el.innerHTML=records.map(function(r,i){
    var isCurrent=i===records.length-1,label=i===0?'최초':i+'차';
    if(isCurrent) label=r.addType==='terminate'?'해지':'현재';
    return '<div class="hist-tab-row">'+
      '<span class="hist-tab-label'+(isCurrent?' current':'')+(r.addType==='terminate'?' style="background:#FCEBEB;color:#A32D2D;"':'')+'">'+label+'</span>'+
      '<span class="hist-tab-info">'+(r.addType==='terminate'?
        '해지일: '+(r.endDate?fmtDate(r.endDate):'-')+(r.note?' · '+r.note:''):
        (r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-')+' · '+priceHistLabel(r)+(r.note?' · '+r.note:'')
      )+'</span>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        '<button class="btn sm" onclick="editHistRow('+i+')"><i class="ti ti-edit"></i></button>'+
        '<button class="btn sm danger" onclick="delHistRow('+i+')"><i class="ti ti-trash"></i></button>'+
      '</div></div>';
  }).join('');
}
window.addHistRow=function(type){ showHistForm(-1,{startDate:'',endDate:'',price:'',priceType:'per-meal',note:'',addType:type||'renewal'}); };
window.editHistRow=function(idx){
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  if(!h||!h.records||!h.records[idx]) return;
  showHistForm(idx,h.records[idx]);
};
window.delHistRow=async function(idx){
  if(!confirm('이 이력을 삭제할까요?')) return;
  var h=historyData.find(function(x){ return x.contractId===editingId; });
  if(!h||!h.records) return;
  var deletedRecord=h.records[idx];
  var isTerminate=deletedRecord&&deletedRecord.addType==='terminate';
  var records=h.records.slice(); records.splice(idx,1);
  var prevRecord=records.length?records[records.length-1]:null;
  var c=contracts.find(function(x){ return x.id===editingId; });
  await saveHistRecords(records,h.name);
  if(isTerminate){
    await updateContract(editingId,{
      terminated:false,
      startDate:prevRecord?prevRecord.startDate:(c?c.startDate:''),
      endDate:prevRecord?prevRecord.endDate:(c?c.endDate:''),
      price:prevRecord?prevRecord.price:(c?c.price:0),
      priceType:prevRecord?prevRecord.priceType:(c?c.priceType:'per-meal')
    });
  }
  showToast('삭제되었습니다.');
};
function showHistForm(idx,r) {
  var existing=document.getElementById('hist-form-popup'); if(existing) existing.remove();
  var isNew=idx===-1;
  var addType=r.addType||'renewal';
  var popup=document.createElement('div');
  popup.id='hist-form-popup';
  popup.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:center;justify-content:center;';
  var c=contracts.find(function(x){ return x.id===editingId; });
  var defaultEndDate=r.endDate||(c&&c.endDate?c.endDate:'');
  popup.innerHTML='<div style="background:#fff;border-radius:14px;width:400px;max-width:95vw;padding:20px;">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'+
      '<h4 style="font-size:14px;font-weight:600;">'+(isNew?(addType==='terminate'?'계약 해지':'재계약'):(idx===0?'최초':idx+'차')+' 수정')+'</h4>'+
      '<button class="btn sm" onclick="closeHistForm()"><i class="ti ti-x"></i></button></div>'+
    '<div style="display:flex;flex-direction:column;gap:10px;">'+
    (addType==='terminate'?
      '<div class="form-group"><label>해지일</label><input type="date" id="hf-end" value="'+defaultEndDate+'"></div>'+
      '<input type="hidden" id="hf-start" value="'+(r.startDate||'')+'">'+
      '<input type="hidden" id="hf-priceType" value="'+(r.priceType||'per-meal')+'">'+
      '<input type="hidden" id="hf-price" value="'+(r.price||0)+'">'+
      '<div class="form-group"><label>해지 사유</label><input type="text" id="hf-note" value="'+(r.note||'')+'" placeholder="해지 사유 (선택)"></div>'
    :
      '<div class="form-group"><label>시작일</label><input type="date" id="hf-start" value="'+(r.startDate||'')+'"></div>'+
      '<div class="form-group"><label>종료일</label><input type="date" id="hf-end" value="'+(r.endDate||'')+'"></div>'+
      '<div class="form-group"><label>단가 구분</label><select id="hf-priceType">'+
        '<option value="per-meal"'+((!r.priceType||r.priceType==='per-meal')?' selected':'')+'>식단가 (원/식)</option>'+
        '<option value="management"'+(r.priceType==='management'?' selected':'')+'>관리비제</option>'+
        '<option value="fixed"'+(r.priceType==='fixed'?' selected':'')+'>고정금액</option>'+
      '</select></div>'+
      '<div class="form-group"><label>단가 (원)</label><input type="number" id="hf-price" value="'+(r.price||0)+'"></div>'+
      '<div class="form-group"><label>비고</label><input type="text" id="hf-note" value="'+(r.note||'')+'" placeholder="특이사항"></div>'
    )+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">'+
        '<button class="btn" onclick="closeHistForm()">취소</button>'+
        '<button class="btn primary" onclick="saveHistForm('+idx+')"><i class="ti ti-check"></i> 저장</button>'+
      '</div></div></div>';
  popup.setAttribute('data-addtype', addType);
  popup.addEventListener('click',function(e){ if(e.target===popup) closeHistForm(); });
  document.body.appendChild(popup);
}
window.closeHistForm=function(){ var p=document.getElementById('hist-form-popup'); if(p) p.remove(); };
window.saveHistForm=async function(idx){
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  var records=h&&h.records?h.records.slice():[];
  var c=contracts.find(function(x){ return x.id===editingId; });
  var popup=document.getElementById('hist-form-popup');
  var detectedType=popup?popup.getAttribute('data-addtype')||'':'';
  var newRecord={
    startDate:document.getElementById('hf-start').value,
    endDate:document.getElementById('hf-end').value,
    price:parseInt(document.getElementById('hf-price').value)||0,
    priceType:document.getElementById('hf-priceType').value,
    note:document.getElementById('hf-note').value.trim(),
    updatedAt:new Date().toISOString(),
    addType:idx===-1?(detectedType==='terminate'?'terminate':h&&h.records&&h.records.length>0?'renewal':'new'):'edit'
  };
  if(idx===-1){ records.push(newRecord); } else records[idx]=newRecord;
  await saveHistRecords(records,c?c.name:'');
  var lastRecord=records[records.length-1];
  if(lastRecord&&lastRecord.endDate){
    var updateData={
      startDate:lastRecord.startDate||c.startDate,
      endDate:lastRecord.endDate,
      price:lastRecord.price||0,
      priceType:lastRecord.priceType||'per-meal'
    };
    if(lastRecord.addType==='terminate') updateData.terminated=true;
    await updateContract(editingId,updateData);
  }
  closeHistForm(); showToast(idx===-1?'이력이 추가되었습니다.':'이력이 수정되었습니다.');
  renderHistTab();
  if(c&&document.getElementById('detail-screen').style.display==='flex') renderDetail(c);
};
async function saveHistRecords(records,name) {
  var {db}=await import('./db.js');
  var {doc,setDoc,serverTimestamp}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await setDoc(doc(db,'history',editingId),{contractId:editingId,name:name||'',records:records,updatedAt:serverTimestamp()});
}

// ── 시간 드롭다운 ──────────────────────────
function buildTimeOptions(selectEl, includeEmpty) {
  var html = includeEmpty ? '<option value="">-</option>' : '';
  for(var h=0;h<24;h++){
    for(var m=0;m<60;m+=30){
      var val=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
      html+='<option value="'+val+'">'+val+'</option>';
    }
  }
  selectEl.innerHTML=html;
}
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.meal-time-start').forEach(function(el){ buildTimeOptions(el,true); });
  document.querySelectorAll('.meal-time-end').forEach(function(el){ buildTimeOptions(el,true); });
});

// ── 일정 타입 선택 ──────────────────────────
window.openTypeSelect=function(date){
  window._typeSelectDate=date||null;
  window._typeSelectStaff=null;
  document.getElementById('type-select-modal').classList.add('open');
};
window.closeTypeSelect=function(){
  document.getElementById('type-select-modal').classList.remove('open');
};
window.selectScheduleType=function(type){
  closeTypeSelect();
  var date=window._typeSelectDate;
  var staff=window._typeSelectStaff;
  window._typeSelectDate=null;
  window._typeSelectStaff=null;
  if(type==='support'){
    openSupportModal();
    if(date) document.getElementById('sup-date').value=date;
    if(staff) setTimeout(function(){ setSelectedStaff([staff]); },50);
  } else if(type==='personal'){
    openPersonalModal();
    if(date) document.getElementById('personal-date').value=date;
    if(staff) setTimeout(function(){ setPersonalStaff([staff]); },50);
  } else if(type==='team'){
    openTeamModal();
    if(date) document.getElementById('team-date').value=date;
  }
};

// ── 개인 일정 모달 ──────────────────────────
function setPersonalStaff(names){
  document.querySelectorAll('#personal-staff-wrap .staff-chip').forEach(function(c){ c.classList.remove('selected'); });
  if(!names||!names.length) return;
  document.querySelectorAll('#personal-staff-wrap .staff-chip').forEach(function(c){
    if(names.some(function(n){ return n===c.textContent.trim(); })) c.classList.add('selected');
  });
}
function getPersonalStaff(){
  var r=[];
  document.querySelectorAll('#personal-staff-wrap .staff-chip.selected').forEach(function(c){ r.push(c.textContent.trim()); });
  return r;
}
window.togglePersonalStaffChip=function(el,name){
  el.classList.toggle('selected');
};
window.selectPersonalType=function(el,type){
  document.querySelectorAll('#personal-type-wrap .staff-chip').forEach(function(c){ c.classList.remove('selected'); });
  el.classList.add('selected');
  document.getElementById('personal-type-val').value=type;
};
window.openPersonalModal=function(){
  document.getElementById('personal-modal-title').textContent='개인 일정 등록';
  document.getElementById('personal-type-val').value='';
  document.getElementById('personal-date').value='';
  document.getElementById('personal-date-end').value='';
  document.getElementById('personal-content').value='';
  document.querySelectorAll('#personal-type-wrap .staff-chip').forEach(function(c){ c.classList.remove('selected'); });
  document.querySelectorAll('#personal-staff-wrap .staff-chip').forEach(function(c){ c.classList.remove('selected'); });
  document.getElementById('personal-modal').classList.add('open');
};
window.closePersonalModal=function(){
  document.getElementById('personal-modal').classList.remove('open');
  var footer=document.querySelector('#personal-modal .sup-modal-footer');
  if(footer) footer.innerHTML='<button class="btn" onclick="closePersonalModal()">취소</button><button class="btn primary" onclick="submitPersonal()"><i class="ti ti-check"></i> 등록</button>';
};
window.submitPersonal=async function(){
  var pType=document.getElementById('personal-type-val').value;
  var date=document.getElementById('personal-date').value;
  var dateEnd=document.getElementById('personal-date-end').value;
  var content=document.getElementById('personal-content').value.trim();
  var staffNames=getPersonalStaff();
  if(!pType||!date||!staffNames.length){ showToast('일정 종류, 날짜, 담당자는 필수예요.'); return; }
  var data={
    type:'personal',
    bizName:pType,
    personalType:pType,
    date:date,
    dateEnd:dateEnd,
    staffNames:staffNames,
    staffName:staffNames.join(', '),
    category:'개인일정',
    content:content,
    meals:[]
  };
  try{
    await addSupport(data);
    showToast('등록되었습니다.');
    closePersonalModal();
  } catch(e){ showToast('오류가 발생했습니다.'); }
};

// ── 팀 공지 모달 ──────────────────────────
window.openTeamModal=function(){
  document.getElementById('team-modal-title').textContent='팀 공지 등록';
  document.getElementById('team-title').value='';
  document.getElementById('team-date').value='';
  document.getElementById('team-date-end').value='';
  document.getElementById('team-content').value='';
  document.getElementById('team-modal').classList.add('open');
};
window.closeTeamModal=function(){
  document.getElementById('team-modal').classList.remove('open');
  var footer=document.querySelector('#team-modal .sup-modal-footer');
  if(footer) footer.innerHTML='<button class="btn" onclick="closeTeamModal()">취소</button><button class="btn primary" onclick="submitTeam()"><i class="ti ti-check"></i> 등록</button>';
};
window.submitTeam=async function(){
  var title=document.getElementById('team-title').value.trim();
  var date=document.getElementById('team-date').value;
  var dateEnd=document.getElementById('team-date-end').value;
  var content=document.getElementById('team-content').value.trim();
  if(!title||!date){ showToast('제목과 날짜는 필수예요.'); return; }
  var data={
    type:'team',
    bizName:title,
    date:date,
    dateEnd:dateEnd,
    staffNames:[],
    staffName:'',
    category:'팀공지',
    content:content,
    meals:[]
  };
  try{
    await addSupport(data);
    showToast('등록되었습니다.');
    closeTeamModal();
  } catch(e){ showToast('오류가 발생했습니다.'); }
};

// ── 초기화 ──────────────────────────
async function init() {
  await seedIfEmpty();
  listenContracts(function(data){
    contracts=data;
    ssOptions=data.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    // 모달이 열려있으면 renderPage 스킵 (히스토리 탭 버튼 중복 방지)
    var modalOpen=document.getElementById('modal-overlay').classList.contains('open');
    if(currentPage&&!modalOpen) renderPage(currentPage);
    updateHomeBadge();
    if(document.getElementById('detail-screen').style.display==='flex'&&window.detailId){
      var c=contracts.find(function(x){ return x.id===window.detailId; });
      if(c) renderDetail(c);
    }
  });
  listenHistory(function(data){
    historyData=data;
    // 히스토리 탭이 열려있으면 갱신
    if(currentModalTab==='hist') renderHistTab();
  });
  
  listenSupports(function(data){
    supports=data;
    if(currentPage==='support'){ renderCalendar(); renderSupStat(supStatTab||'month'); }
    if(currentPage==='dashboard') renderDashboard();
  });
}
init();

function updateHomeBadge() {
  var urgent=contracts.filter(function(c){ return calcStatus(c)==='urgent'; }).length;
  var badge=document.getElementById('home-urgent-badge');
  if(badge){ badge.style.display=urgent>0?'block':'none'; badge.textContent=urgent; }
}

// ── 네비게이션 ──────────────────────────
window.addEventListener('popstate',function(e){ applyState(e.state||{screen:'home'}); });
function applyState(state) {
  document.getElementById('home-screen').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('detail-screen').style.display='none';
  if(mapInstance&&state.screen!=='page'){ mapInstance.remove(); mapInstance=null; }
  if(state.screen==='home'){
    document.getElementById('home-screen').style.display='flex'; currentPage='';
  } else if(state.screen==='page'){
    document.getElementById('app').style.display='flex'; currentPage=state.page;
    var titles={dashboard:'대시보드',support:'운영지원',businesses:'FS 사업장 현황',admin:'관리자 수정'};
    document.getElementById('page-title').textContent=titles[state.page]||'';
    var actions=document.getElementById('top-actions'); actions.innerHTML='';
    if(state.page==='admin') actions.innerHTML='<button class="btn primary" onclick="openAddModal()"><i class="ti ti-plus"></i> 추가</button><button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button>';
    ['dashboard','support','businesses','admin'].forEach(function(p){
      var el=document.getElementById('page-'+p); if(el) el.style.display=p===state.page?'block':'none';
    });
    renderPage(state.page);
  } else if(state.screen==='detail'){
    document.getElementById('detail-screen').style.display='flex';
    window.detailId=state.id;
    var c=contracts.find(function(x){ return x.id===state.id; });
    if(c) renderDetail(c);
  }
}
window.goHome=function(){ var s={screen:'home'}; history.pushState(s,'',''); applyState(s); };
window._goHome=window.goHome;
window.goPage=function(page){ var s={screen:'page',page:page}; history.pushState(s,'',''); applyState(s); };
window._goPage=window.goPage;
window.goDetail=function(id){ if(!id||id==='undefined') return; var s={screen:'detail',id:id}; history.pushState(s,'',''); applyState(s); };
window.goDetailByName=function(name){ var c=contracts.find(function(x){ return x.name===name; }); if(c) goDetail(c.id); };
window.goBackFromDetail=function(){ history.back(); };
function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='support'){ renderCalendar(); initSS(); renderSupStat('month'); }
  if(page==='businesses') renderBizTab();
  if(page==='admin') renderAdmin();
}

// ── 대시보드 ──────────────────────────
function renderDashboard() {
  var now=new Date();
  var days=['일','월','화','수','목','금','토'];
  var todayEl=document.getElementById('dash-today');
  if(todayEl) todayEl.textContent=now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 ('+days[now.getDay()]+')';
  var counts={total:contracts.length,urgent:0,near:0,ok:0,auto:0};
  contracts.forEach(function(c){ if(c.terminated) return; var s=calcStatus(c); if(s==='urgent') counts.urgent++; else if(s==='near') counts.near++; else if(s==='auto') counts.auto++; else counts.ok++; });
  function mk(id,cls,icon,label,count) {
    var el=document.getElementById(id); if(!el) return;
    el.innerHTML='<div class="stat-icon '+cls+'"><i class="ti '+icon+'"></i></div><div class="stat-info"><div class="stat-label">'+label+'</div><div class="stat-val '+cls+'">'+count+'</div></div>';
  }
  mk('card-total','blue','ti-building','전체 사업장',counts.total);
  mk('card-urgent','red','ti-alert-circle','긴급 (D-30)',counts.urgent);
  mk('card-near','amber','ti-clock','임박 (D-90)',counts.near);
  mk('card-auto','blue2','ti-refresh','자동연장',counts.auto);
  mk('card-ok','green','ti-check','여유',counts.ok);

  var todayStr=localDateStr(now);
  var todayItems=supports.filter(function(s){
    if(!s.date) return false;
    var start=s.date.slice(0,10);
    var end=s.dateEnd?s.dateEnd.slice(0,10):start;
    return todayStr>=start&&todayStr<=end;
  });
  var schedEl=document.getElementById('dash-today-schedule');
  if(schedEl){
    var staffOrderDash=['박주형','김재희','손도란','이소영','김상준','견병록','안은재','임성창','김동현'];
    var sortedItems=todayItems.slice().sort(function(a,b){
      var an=a.staffNames&&a.staffNames.length?a.staffNames[0]:(a.staffName||'');
      var bn=b.staffNames&&b.staffNames.length?b.staffNames[0]:(b.staffName||'');
      var ai=staffOrderDash.findIndex(function(n){ return an.includes(n); });
      var bi=staffOrderDash.findIndex(function(n){ return bn.includes(n); });
      if(ai===-1) ai=99; if(bi===-1) bi=99;
      return ai-bi;
    });
    if(!sortedItems.length){
      schedEl.innerHTML='<div class="today-schedule-empty">오늘 등록된 일정이 없어요</div>';
    } else {
      var teamItems=sortedItems.filter(function(s){ return s.type==='team'; });
      var supportItems=sortedItems.filter(function(s){ return !s.type||s.type==='support'; });
      var personalItems=sortedItems.filter(function(s){ return s.type==='personal'; });
      var html='';
      if(teamItems.length){
        html+='<div style="margin-bottom:8px;">'+
          '<div style="font-size:11px;font-weight:600;color:#854F0B;margin-bottom:4px;">📢 팀 공지</div>'+
          teamItems.map(function(s){
            return '<div onclick="openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid #FAE8B0;font-size:13px;" class="today-item-inner">'+
              '<span style="font-weight:600;flex:1;">'+s.bizName+'</span>'+
              '<span style="font-size:12px;color:#888;white-space:nowrap;">'+(s.content||'')+'</span>'+
            '</div>';
          }).join('')+
        '</div>';
      }
      if(supportItems.length){
        html+='<div style="margin-bottom:8px;">'+
          '<div style="font-size:11px;font-weight:600;color:#185FA5;margin-bottom:4px;">📋 업장 지원</div>'+
          supportItems.map(function(s){
            var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
            return '<div onclick="openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid #C8DEFA;font-size:13px;">'+
              '<span class="badge-cat '+(getStaffColor(staffStr)||'')+'">'+staffStr+'</span>'+
              '<span style="font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+s.bizName+'</span>'+
              '<span style="font-size:12px;color:#888;white-space:nowrap;flex-shrink:0;">'+(s.category||'')+'</span>'+
            '</div>';
          }).join('')+
        '</div>';
      }
      if(personalItems.length){
        html+='<div style="margin-bottom:8px;">'+
          '<div style="font-size:11px;font-weight:600;color:#555;margin-bottom:4px;">👤 개인 일정</div>'+
          personalItems.map(function(s){
            var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
            var isLeave=s.personalType==='연차'||s.personalType==='반차(오전)'||s.personalType==='반차(오후)';
            return '<div onclick="openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid #e0e0dc;font-size:13px;">'+
              '<span class="badge-cat" style="'+(isLeave?'background:#FFCDD2;color:#A32D2D;':'')+'">'+staffStr.split(' ')[0]+'</span>'+
              '<span style="font-weight:600;flex:1;">'+s.bizName+'</span>'+
              '<span style="font-size:12px;color:#888;white-space:nowrap;">'+(s.content||'')+'</span>'+
            '</div>';
          }).join('')+
        '</div>';
      }
      schedEl.innerHTML=html;
    }
  }

  var thisY=now.getFullYear(),thisM=now.getMonth();
  var nextY=thisM===11?thisY+1:thisY,nextM=thisM===11?0:thisM+1;
  function expireList(year,month){ return contracts.filter(function(c){ if(c.terminated) return false; if(!c.endDate) return false; var d=new Date(c.endDate); return d.getFullYear()===year&&d.getMonth()===month; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); }); }
  function expireHtml(list) {
    if(!list.length) return '<div style="color:#aaa;font-size:12px;padding:12px 0;">없음</div>';
    var threeMonthsAgo=new Date(now); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth()-3);
    var threeStr=localDateStr(threeMonthsAgo);
    return list.map(function(c){
      var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='near'?'#854F0B':'#185FA5';
      var recentCount=supports.filter(function(sp){ return sp.bizName===c.name&&sp.date&&sp.date>=threeStr&&sp.date<=todayStr; }).length;
      return '<div class="dash-mini-item" onclick="goDetail(\''+c.id+'\')">'+
        '<span class="dash-mini-name">'+c.name+'</span>'+
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">'+
          '<span style="font-size:11px;color:#aaa;">최근3달 '+recentCount+'회</span>'+
          '<span class="dash-mini-right" style="color:'+col+';font-weight:600;">'+dDayLabel(d)+'</span>'+
        '</div>'+
        '</div>';
    }).join('');
  }
  var thisList=expireList(thisY,thisM),nextList=expireList(nextY,nextM);
  var tmEl=document.getElementById('dash-thismonth'); if(tmEl) tmEl.innerHTML=expireHtml(thisList);
  var nmEl=document.getElementById('dash-nextmonth'); if(nmEl) nmEl.innerHTML=expireHtml(nextList);
  var tmC=document.getElementById('dash-thismonth-count'); if(tmC) tmC.textContent=thisList.length+'건';
  var nmC=document.getElementById('dash-nextmonth-count'); if(nmC) nmC.textContent=nextList.length+'건';

  // 최근 계약 업데이트
  var recentUpdates=[];
  historyData.forEach(function(h){
    if(!h.records||!h.records.length) return;
    var c=contracts.find(function(x){ return x.id===h.contractId; }); if(!c) return;
    var latest=h.records[h.records.length-1];
    if(!latest.updatedAt) return;
    if(latest.addType==='edit') return;
    var updDate=new Date(latest.updatedAt);
    var diffDays=Math.floor((now-updDate)/(1000*60*60*24));
    if(diffDays>30) return;
    var prev=h.records.length>1?h.records[h.records.length-2]:null;
    recentUpdates.push({c:c,latest:latest,prev:prev,diffDays:diffDays,updDate:updDate});
  });
  recentUpdates.sort(function(a,b){ return b.updDate-a.updDate; });
  var recentEl=document.getElementById('dash-recent-updates');
  if(recentEl){
    if(!recentUpdates.length){
      recentEl.innerHTML='<div style="color:#aaa;font-size:12px;padding:12px 0;">최근 30일 계약 변경 내역이 없어요</div>';
    } else {
      recentEl.innerHTML=recentUpdates.slice(0,10).map(function(item){
        var s=calcStatus(item.c),d=dDiff(item.c.endDate),col=s==='urgent'?'#A32D2D':s==='near'?'#854F0B':'#185FA5';
        var isNew=item.prev===null;
        var priceChanged=item.prev&&(item.prev.price!==item.latest.price||item.prev.priceType!==item.latest.priceType);
        var priceHtml='';
        var isTerminate=item.latest.addType==='terminate';
        if(isTerminate){
          priceHtml='<span style="font-size:11px;color:#A32D2D;background:#FCEBEB;padding:1px 6px;border-radius:99px;margin-left:4px;">해지</span>';
        } else if(isNew){
          priceHtml='<span style="font-size:11px;color:#3B6D11;background:#EAF3DE;padding:1px 6px;border-radius:99px;margin-left:4px;">신규</span>';
        } else if(priceChanged){
          priceHtml='<span style="font-size:11px;color:#888;margin-left:4px;">'+priceHistLabel(item.prev)+'</span>'+
            '<span style="font-size:11px;color:#888;margin:0 3px;">→</span>'+
            '<span style="font-size:11px;color:#185FA5;font-weight:600;">'+priceHistLabel(item.latest)+'</span>';
        } else {
          priceHtml='<span style="font-size:11px;color:#888;margin-left:4px;">'+priceHistLabel(item.latest)+'</span>'+
            '<span style="font-size:11px;color:#aaa;margin-left:4px;">(변동없음)</span>';
        }
        var diffStr=item.diffDays===0?'오늘':item.diffDays===1?'1일 전':item.diffDays+'일 전';
        return '<div class="dash-mini-item" onclick="goDetail(\''+item.c.id+'\')">'+
          '<div style="min-width:0;flex:1;">'+
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
              '<span class="dash-mini-name" style="flex:none;">'+item.c.name+'</span>'+
              (!item.c.terminated?'<span class="badge '+s+'" style="font-size:10px;">'+STATUS_META[s].label+'</span>':'')+
            '</div>'+
            '<div style="display:flex;align-items:center;flex-wrap:wrap;margin-top:2px;">'+
              (isNew?priceHtml:'<span style="font-size:11px;color:#555;background:#f0f0ec;padding:1px 6px;border-radius:99px;">갱신</span>'+priceHtml)+
            '</div>'+
          '</div>'+
          '<div style="flex-shrink:0;text-align:right;">'+
            '<div style="font-size:11px;color:#aaa;">'+diffStr+'</div>'+
            '<div style="font-size:11px;font-weight:600;color:'+col+';">'+dDayLabel(d)+'</div>'+
          '</div>'+
        '</div>';
      }).join('');
    }
  }

  renderSupStat('month');
}

var supStatTab='month';
window.setSupStatTab=function(tab){
  supStatTab=tab;
  ['month','quarter','year'].forEach(function(t){
    var btn=document.getElementById('sup-tab-'+t);
    if(btn) btn.classList.toggle('active-filter',t===tab);
  });
  renderSupStat(tab);
};

function renderCatStat(list){
  // 개인일정/팀공지 제외
  var filtered=list.filter(function(s){ return !s.type||s.type==='support'; });
  if(!filtered.length) return '<div style="color:#aaa;font-size:12px;padding:8px 0;">내역이 없어요</div>';
  var CATS=['운영점검','위생점검','환경개선','특식지원','이벤트','배식지원','고객미팅','기타지원'];
  var catMap={};
  filtered.forEach(function(s){
    var cat=s.category||'기타지원';
    if(!catMap[cat]) catMap[cat]={count:0,items:[]};
    catMap[cat].count++;
    catMap[cat].items.push(s);
  });
  var cats=CATS.filter(function(c){ return catMap[c]; });
  Object.keys(catMap).forEach(function(c){ if(CATS.indexOf(c)===-1) cats.push(c); });
  if(!cats.length) return '<div style="color:#aaa;font-size:12px;padding:8px 0;">내역이 없어요</div>';
  var maxCat=Math.max.apply(null,cats.map(function(c){ return catMap[c].count; }));
  return '<div style="display:flex;flex-direction:column;gap:4px;">'+
    cats.map(function(cat){
      var data=catMap[cat],barW=Math.round((data.count/maxCat)*100);
      var id='cat-'+cat.replace(/\s/g,'');
      return '<div style="border:.5px solid #e8e8e4;border-radius:8px;overflow:hidden;">'+
        '<div onclick="toggleCatGroup(\''+id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:#fafaf8;">'+
          '<span style="font-size:13px;font-weight:600;min-width:60px;">'+cat+'</span>'+
          '<div style="flex:1;background:#e8e8e4;border-radius:4px;height:8px;">'+
            '<div style="width:'+barW+'%;background:#185FA5;height:8px;border-radius:4px;transition:width .3s;"></div>'+
          '</div>'+
          '<span style="font-size:13px;font-weight:600;color:#185FA5;min-width:32px;text-align:right;">'+data.count+'건</span>'+
          '<i class="ti ti-chevron-down" id="ico-'+id+'" style="font-size:13px;color:#aaa;transition:transform .2s;"></i>'+
        '</div>'+
        '<div id="'+id+'" style="display:none;border-top:.5px solid #f0f0ec;">'+
          (function(){
            var staffMap={};
            data.items.forEach(function(s){
              var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
              names.forEach(function(n){
                var short=n.split(' ')[0];
                if(!staffMap[short]) staffMap[short]={count:0,items:[],color:getStaffColor(n)};
                staffMap[short].count++;
                staffMap[short].items.push(s);
              });
            });
            return Object.keys(staffMap).map(function(name){
              var sd=staffMap[name];
              var subId=id+'-'+name;
              return '<div style="border-bottom:.5px solid #f0f0ec;">'+
                '<div onclick="toggleCatGroup(\''+subId+'\')" style="display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;background:#fafaf8;">'+
                  '<span class="badge-cat '+sd.color+'">'+name+'</span>'+
                  '<span style="font-size:13px;font-weight:600;flex:1;">'+sd.count+'회</span>'+
                  '<i class="ti ti-chevron-down" id="ico-'+subId+'" style="font-size:12px;color:#aaa;transition:transform .2s;"></i>'+
                '</div>'+
                '<div id="'+subId+'" style="display:none;">'+
                  sd.items.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).map(function(s){
                    var c=contracts.find(function(x){ return x.name===s.bizName; }),cid=c?c.id:'';
                    var dateStr=s.date||''; if(s.dateEnd&&s.dateEnd!==s.date) dateStr+='~'+s.dateEnd.slice(5);
                    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 14px 7px 28px;border-top:.5px solid #f0f0ec;gap:8px;'+(cid?'cursor:pointer;':'')+'"'+(cid?' onclick="goDetail(\''+cid+'\')"':'')+'>'+
                      '<span style="font-size:12px;font-weight:500;'+(cid?'color:#185FA5;':'')+';flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+s.bizName+'</span>'+
                      '<span style="font-size:11px;color:#aaa;flex-shrink:0;">'+dateStr+'</span>'+
                    '</div>';
                  }).join('')+
                '</div>'+
              '</div>';
            }).join('');
          })()+
        '</div>'+
      '</div>';
    }).join('')+
  '</div>';
}

window.toggleCatGroup=function(id){
  var el=document.getElementById(id),ico=document.getElementById('ico-'+id);
  if(!el) return;
  var open=el.style.display==='none';
  el.style.display=open?'block':'none';
  if(ico) ico.style.transform=open?'rotate(180deg)':'';
};

function renderNoVisit(startM,endM,year,label){
  var todayStr=localDateStr();
  var noVisit=contracts.filter(function(c){
    var s=calcStatus(c);
    if(s!=='urgent'&&s!=='near') return false;
    return !supports.some(function(sp){
      if(sp.bizName!==c.name||!sp.date) return false;
      var d=new Date(sp.date),m=d.getMonth();
      return d.getFullYear()===year&&m>=startM&&m<=endM&&sp.date<=todayStr;
    });
  }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  if(!noVisit.length) return '<div style="margin-top:12px;padding:8px 12px;background:#EAF3DE;border-radius:8px;font-size:12px;color:#3B6D11;">✅ '+label+' 긴급/임박 사업장 모두 방문 완료!</div>';
  return '<div style="margin-top:12px;">'+
    '<div style="font-size:12px;font-weight:600;color:#A32D2D;margin-bottom:6px;">🔴 긴급/임박 미방문 ('+label+') '+noVisit.length+'곳</div>'+
    noVisit.map(function(c){
      var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':'#854F0B';
      return '<div class="dash-mini-item" onclick="goDetail(\''+c.id+'\')">'+
        '<span class="dash-mini-name">'+c.name+'</span>'+
        '<span style="font-size:12px;font-weight:600;color:'+col+';">'+dDayLabel(d)+'</span>'+
        '</div>';
    }).join('')+
  '</div>';
}

function renderSupStat(tab){
  var now=new Date(),thisY=now.getFullYear(),thisM=now.getMonth();
  var statEl=document.getElementById('dash-sup-stat'); if(!statEl) return;
  var todayStr=localDateStr(now);

  if(tab==='month'){
    var monthStr=thisY+'-'+String(thisM+1).padStart(2,'0');
    var monthSups=supports.filter(function(s){ return s.date&&s.date.startsWith(monthStr)&&s.date<=todayStr; });
    if(!monthSups.length){ statEl.innerHTML='<div style="color:#aaa;font-size:12px;padding:12px 0;">이번달 지원 내역이 없어요</div>'; return; }
    statEl.innerHTML=renderCatStat(monthSups);

  } else if(tab==='quarter'){
    var curQ=Math.floor(thisM/3);
    var quarters=['1분기','2분기','3분기','4분기'];
    var qSubs=['1~3월','4~6월','7~9월','10~12월'];
    var qData=quarters.map(function(_,qi){
      var qStartM=qi*3,qEndM=qi*3+2;
      var items=supports.filter(function(s){
        if(!s.date) return false;
        var d=new Date(s.date),m=d.getMonth();
        return d.getFullYear()===thisY&&m>=qStartM&&m<=qEndM&&s.date<=todayStr;
      });
      return {label:quarters[qi],sub:qSubs[qi],items:items,current:qi===curQ};
    });
    var html='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">';
    qData.forEach(function(q,qi){
      var id='q-detail-'+qi;
      html+='<div style="border:.5px solid '+(q.current?'#B5D4F4':'#e8e8e4')+';border-radius:8px;overflow:hidden;">'+
        '<div onclick="toggleCatGroup(\''+id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;background:'+(q.current?'#E6F1FB':'#fafaf8')+';">'+
          '<div>'+
            '<div style="font-size:12px;font-weight:600;color:'+(q.current?'#185FA5':'#555')+';">'+q.label+'</div>'+
            '<div style="font-size:10px;color:#aaa;">'+q.sub+'</div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span style="font-size:16px;font-weight:700;color:'+(q.current?'#185FA5':'#1a1a18')+';">'+q.items.length+'건</span>'+
            '<i class="ti ti-chevron-down" id="ico-q-detail-'+qi+'" style="font-size:13px;color:#aaa;transition:transform .2s;"></i>'+
          '</div>'+
        '</div>'+
        '<div id="'+id+'" style="display:'+(q.current?'block':'none')+';">'+
          '<div style="padding:8px;">'+renderCatStat(q.items)+'</div>'+
        '</div>'+
      '</div>';
      if(q.current){
        setTimeout(function(){
          var ico=document.getElementById('ico-q-detail-'+qi);
          if(ico) ico.style.transform='rotate(180deg)';
        },50);
      }
    });
    html+='</div>';
    html+=renderNoVisit(curQ*3,curQ*3+2,thisY,'이번 분기');
    statEl.innerHTML=html;

  } else if(tab==='year'){
    var monthLabels=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var totalYear=supports.filter(function(s){ return s.date&&s.date.startsWith(thisY+'')&&s.date<=todayStr&&(!s.type||s.type==='support'); }).length;
    var bizYear={};
    supports.forEach(function(s){ if(s.date&&s.date.startsWith(thisY+'')&&s.date<=todayStr&&(!s.type||s.type==='support')) bizYear[s.bizName]=true; });
    var html='<div style="display:flex;gap:8px;margin-bottom:12px;">'+
      '<div style="background:#E6F1FB;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">'+
        '<div style="font-size:11px;color:#185FA5;font-weight:600;">올해 총 지원</div>'+
        '<div style="font-size:22px;font-weight:700;color:#185FA5;">'+totalYear+'<span style="font-size:12px;font-weight:400;">회</span></div>'+
      '</div>'+
      '<div style="background:#f5f5f3;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">'+
        '<div style="font-size:11px;color:#555;font-weight:600;">방문 업장수</div>'+
        '<div style="font-size:22px;font-weight:700;color:#1a1a18;">'+Object.keys(bizYear).length+'<span style="font-size:12px;font-weight:400;">개소</span></div>'+
      '</div>'+
    '</div>';
    html+='<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">';
    monthLabels.forEach(function(mLabel,mi){
      var mStr=thisY+'-'+String(mi+1).padStart(2,'0');
      var mItems=supports.filter(function(s){ return s.date&&s.date.startsWith(mStr)&&s.date<=todayStr; });
      var isCur=mi===thisM;
      var id='m-detail-'+mi;
      html+='<div style="border:.5px solid '+(isCur?'#B5D4F4':'#e8e8e4')+';border-radius:8px;overflow:hidden;">'+
        '<div onclick="toggleCatGroup(\''+id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;cursor:pointer;background:'+(isCur?'#E6F1FB':'#fafaf8')+';">'+
          '<span style="font-size:13px;font-weight:600;color:'+(isCur?'#185FA5':'#555')+';">'+mLabel+(isCur?' ● 이번달':mItems.length===0?' <span style="font-size:10px;color:#ccc;">없음</span>':'')+'</span>'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            (mItems.length?'<span style="font-size:14px;font-weight:700;color:'+(isCur?'#185FA5':'#1a1a18')+';">'+mItems.length+'건</span>':'')+
            (mItems.length?'<i class="ti ti-chevron-down" id="ico-'+id+'" style="font-size:13px;color:#aaa;transition:transform .2s;"></i>':'')+
          '</div>'+
        '</div>'+
        (mItems.length?'<div id="'+id+'" style="display:'+(isCur?'block':'none')+';">'+
          '<div style="padding:8px;">'+renderCatStat(mItems)+'</div>'+
        '</div>':'')+
      '</div>';
    });
    html+='</div>';
    html+=renderNoVisit(0,11,thisY,'올해');
    statEl.innerHTML=html;
    setTimeout(function(){
      var ico=document.getElementById('ico-m-detail-'+thisM);
      if(ico) ico.style.transform='rotate(180deg)';
    },50);
  }
}

window.toggleDashCard=function(el,filter) {
  document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); });
  var wrap=document.getElementById('dash-list-wrap'),listEl=document.getElementById('dash-list');
  if(el.dataset.lastFilter===filter){ el.dataset.lastFilter=''; wrap.style.display='none'; return; }
  el.classList.add('active-card'); el.dataset.lastFilter=filter; wrap.style.display='block';
  var list=contracts.filter(function(c){ var s=calcStatus(c); return filter==='all'?true:s===filter; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  listEl.innerHTML=list.length?list.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
    var nutriStr=c.nutritionists&&c.nutritionists.length?c.nutritionists[0].name:'';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:.5px solid #f0f0ec;cursor:pointer;gap:8px;" onclick="goDetail(\''+c.id+'\')">' +
      '<div style="min-width:0;flex:1;"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+c.name+'</div>'+
      '<div style="font-size:11px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(nutriStr?nutriStr+' · ':'')+(c.resp||'')+'</div></div>'+
      '<div style="text-align:right;flex-shrink:0;"><span class="badge '+s+'">'+STATUS_META[s].label+'</span>'+
      '<div style="font-size:11px;font-weight:500;margin-top:3px;color:'+col+'">'+dDayLabel(d)+'</div></div></div>';
  }).join(''):'<div class="empty-state"><i class="ti ti-check"></i>해당 없음</div>';
};

// ── 사업장 상세 ──────────────────────────
function renderDetail(c) {
  var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
  document.getElementById('detail-title').textContent=c.name;
  var contactHtml='';
  if(c.contacts&&c.contacts.length) contactHtml=c.contacts.map(function(ct){ return '<div>'+(ct.name||'')+(ct.phone?' · '+ct.phone:'')+(ct.tel?' · '+ct.tel:'')+'</div>'; }).join('');
  else contactHtml=(c.contactName||'-')+(c.contactPhone?' · '+c.contactPhone:'')+(c.tel?' · '+c.tel:'');
  var h=historyData.find(function(x){ return x.contractId===c.id; });
  var histHtml=h&&h.records&&h.records.length?h.records.map(function(r,i){
    var isCurrent=i===h.records.length-1,label=i===0?'최초':i+'차';
    if(isCurrent) label=r.addType==='terminate'?'해지':'현재';
    return '<div class="hist-record"><span class="hist-round">'+label+'</span>'+
      '<span class="hist-dates">'+(r.addType==='terminate'?'해지일: '+(r.endDate?fmtDate(r.endDate):'-'):(r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-'))+'</span>'+
      '<span class="hist-price">'+(r.addType==='terminate'?'':priceHistLabel(r))+'</span></div>';
  }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">히스토리 없음</div>';
  var bizSups=supports.filter(function(sp){ return sp.bizName===c.name&&(!sp.type||sp.type==='support'); }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var supHtml=bizSups.length?bizSups.map(function(sp){
    var staffStr=sp.staffNames&&sp.staffNames.length?sp.staffNames.join(', '):(sp.staffName||'');
    var dateStr=sp.date||'';
    if(sp.dateEnd&&sp.dateEnd!==sp.date) dateStr+=(' ~ '+sp.dateEnd);
    return '<div class="sup-hist-row">'+
      '<span class="badge-cat">'+(sp.category||'')+'</span>'+
      '<span style="font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+dateStr+(staffStr?' · '+staffStr:'')+'</span>'+
      '<span style="font-size:12px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;">'+(sp.content||'')+'</span>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        '<button class="btn sm" onclick="editSupport(\''+sp.id+'\')"><i class="ti ti-edit"></i></button>'+
        '<button class="btn sm danger" onclick="delSupportFromDetail(\''+sp.id+'\',\''+c.id+'\')"><i class="ti ti-trash"></i></button>'+
      '</div>'+
    '</div>';
  }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">지원 이력 없음</div>';
  document.getElementById('detail-body').innerHTML=
    '<div class="detail-section">'+
    '<div class="detail-row"><span class="detail-label">계약 상태</span><div class="detail-val" style="display:flex;align-items:center;gap:8px;">'+(c.terminated?'<span class="badge" style="background:#FCEBEB;color:#A32D2D;border-color:#F7C1C1;">해지</span>':'<span class="badge '+s+'">'+STATUS_META[s].label+'</span><span style="color:'+col+';font-weight:500;">'+dDayLabel(d)+'</span>')+'</div></div>'+
    '<div class="detail-row"><span class="detail-label">소재지</span><span class="detail-val">'+(c.addr||'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">담당자</span><span class="detail-val">'+contactHtml+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">담당영양사</span><span class="detail-val">'+(c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return (nt.name||'')+(nt.phone?' · '+nt.phone:''); }).join('<br>'):'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">팀/책임</span><span class="detail-val">'+(c.team?c.team+'팀':'-')+' / '+(c.resp||'-')+'</span></div>'+
    '</div>'+
    '<div class="detail-section"><div class="detail-section-title">계약 정보</div>'+
    '<div class="detail-row"><span class="detail-label">계약기간</span><span class="detail-val">'+fmtDate(c.startDate)+' ~ '+fmtDate(c.endDate)+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">계약단가</span><span class="detail-val">'+priceLabel(c)+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">월평균식수</span><span class="detail-val">'+(c.avgMeals?Number(c.avgMeals).toLocaleString()+'식':'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">운영끼니</span><span class="detail-val">'+mealsDisplay(c.meals)+'</span></div>'+
    (c.note?'<div class="detail-row"><span class="detail-label">특이사항</span><span class="detail-val">'+c.note+'</span></div>':'')+
    '</div>'+
    '<div class="detail-section"><div class="detail-section-title">계약 히스토리</div>'+histHtml+'</div>'+
    '<div class="detail-section"><div class="detail-section-title">운영지원 이력</div>'+supHtml+'</div>';
}

// ── 달력 ──────────────────────────
window.setCalView=function(view){
  calView=view;
  document.getElementById('view-month-btn').classList.toggle('active-filter',view==='month');
  document.getElementById('view-week-btn').classList.toggle('active-filter',view==='week');
  renderCalendar();
};
window.setStaffFilter=function(name){
  staffFilter=name;
  var labelEl=document.getElementById('active-filter-label');
  if(labelEl){ if(name){labelEl.textContent=name+' 필터 중';labelEl.style.display='inline';}else{labelEl.style.display='none';} }
  var allBtn=document.getElementById('filter-all'); if(allBtn) allBtn.classList.toggle('active-filter',!name);
  document.querySelectorAll('#page-support .btn.sm').forEach(function(b){ b.classList.remove('active-filter'); });
  if(!name&&allBtn) allBtn.classList.add('active-filter');
  renderCalendar();
};
window.changeMonth=function(dir){
  if(calView==='week'){
    if(dir===0){ weekOffset=0; }
    else weekOffset+=dir;
    renderCalendar();
    return;
  }
  if(dir===0){calYear=new Date().getFullYear();calMonth=new Date().getMonth();}
  else{calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}}
  renderCalendar();
};
function filterSupports(){
  if(!staffFilter) return supports;
  return supports.filter(function(s){
    if(s.type==='team') return true; // 팀공지는 항상 표시
    var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
    return names.some(function(n){ return n&&n.includes(staffFilter.split(' ')[0]); });
  });
}
function renderCalendar(){
  var el=document.getElementById('cal-title');
  if(calView==='week'){
    var today2=new Date();
    var dow2=today2.getDay();
    var diff2=dow2===0?-6:1-dow2;
    var base=new Date(today2.getFullYear(),today2.getMonth(),today2.getDate()+diff2+(weekOffset*7));
    var end=new Date(base.getFullYear(),base.getMonth(),base.getDate()+6);
    var baseM=base.getMonth()+1,endM=end.getMonth()+1;
    var isMobile=window.innerWidth<=600;
    if(el) el.textContent=(baseM===endM?(isMobile?baseM+'/'+base.getDate()+'~'+end.getDate():baseM+'월 '+base.getDate()+'~'+end.getDate()+'일'):(isMobile?baseM+'/'+base.getDate()+'~'+endM+'/'+end.getDate():baseM+'월 '+base.getDate()+'일 ~ '+endM+'월 '+end.getDate()+'일'));
    renderWeekView();
    setTimeout(function(){
      var calWrap=document.querySelector('#calendar').parentElement;
      var todayCol=document.querySelector('.week-header.today-col');
      if(calWrap&&todayCol){
        var offset=todayCol.offsetLeft-60;
        calWrap.scrollLeft=Math.max(0,offset);
      }
    },50);
    return;
  }
  if(el) el.textContent=calYear+'년 '+(calMonth+1)+'월';
  renderMonthView();
}
function renderMonthView(){
  var filtered=filterSupports(),dayMap={};
  filtered.forEach(function(s){
    if(!s.date) return;
    var start=s.date.slice(0,10),end=s.dateEnd?s.dateEnd.slice(0,10):start;
    var cur=new Date(start),endD=new Date(end);
    while(cur<=endD){
      var k=localDateStr(cur);
      if(!dayMap[k]) dayMap[k]=[];
      dayMap[k].push(s);
      cur.setDate(cur.getDate()+1);
    }
  });
  var firstDay=new Date(calYear,calMonth,1).getDay(),lastDate=new Date(calYear,calMonth+1,0).getDate();
  var today=localDateStr();
  var html='<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(function(d){ html+='<div class="cal-header">'+d+'</div>'; });
  for(var i=0;i<firstDay;i++) html+='<div class="cal-day empty"></div>';
  for(var d=1;d<=lastDate;d++){
    var key=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var items=dayMap[key]||[],isToday=key===today;
    var seen={},uniqueItems=[];
    items.forEach(function(s){ if(!seen[s.id]){seen[s.id]=true;uniqueItems.push(s);} });
    html+='<div class="cal-day'+(isToday?' today':'')+'" onclick="openCalPopup(\''+key+'\')">'+
      '<div class="cal-num">'+d+'</div>'+
      uniqueItems.slice(0,3).map(function(s){
        var isPersonal=s.type==='personal',isTeam=s.type==='team';
        var staffStr=s.staffNames&&s.staffNames.length?s.staffNames[0]:(s.staffName||'');
        var allStaff=s.staffNames&&s.staffNames.length?s.staffNames.map(function(n){ return n.split(' ')[0]; }).join('·'):(s.staffName?s.staffName.split(' ')[0]:'');
        var cls=isTeam?'':isPersonal?'':getStaffColor(staffStr);
        var evStyle=isTeam?'background:#FFECEC;color:#A32D2D;font-weight:700;':isPersonal?'background:#f0f0ec;color:#666;':'';
        var catLabel=s.category==='이벤트'?'이벤트':s.category?s.category.slice(0,2):'';
        var mainName=isTeam?'📢 '+s.bizName:isPersonal?s.bizName+(allStaff?'/'+allStaff:''):(allStaff?allStaff+' ':'')+s.bizName;
        return '<div class="cal-event '+(cls||'')+'" style="'+evStyle+';display:flex;align-items:center;justify-content:space-between;gap:2px;">'+
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">'+mainName+'</span>'+
          (!isTeam&&!isPersonal&&catLabel?'<span style="font-size:8px;color:#aaa;flex-shrink:0;white-space:nowrap;">'+catLabel+'</span>':'')+
        '</div>';
      }).join('')+
      (uniqueItems.length>3?'<div class="cal-more">+'+(uniqueItems.length-3)+'건</div>':'')+
      '</div>';
  }
  html+='</div>';
  var calEl=document.getElementById('calendar'); if(calEl) calEl.innerHTML=html;
  setTimeout(function(){
    var todayEl=document.querySelector('.cal-day.today');
    if(todayEl){ todayEl.scrollIntoView({block:'center',behavior:'smooth'}); }
  },50);
}
function renderWeekView(){
  var today=new Date(),startOfWeek=new Date(today);
  var dow=today.getDay();
  var diff=dow===0?-6:1-dow;
  startOfWeek.setDate(today.getDate()+diff+(weekOffset*7));
  var days=[];
  for(var i=0;i<7;i++){
    var d=new Date(startOfWeek.getFullYear(),startOfWeek.getMonth(),startOfWeek.getDate()+i);
    days.push(d);
  }
  var todayStr=localDateStr(today);
  var filtered=filterSupports();
  var staffOrder=['박주형 본부장','김재희 차장','손도란 대리','이소영 주임','김상준 주임','견병록 매니저','안은재 주임','임성창 차장','김동현 대리'];
  var dayLabels=['월','화','수','목','금','토','일'];

  // 팀 공지 행
  var html='<div class="week-grid">';
  // 헤더 행
  html+='<div class="week-header"></div>';
  days.forEach(function(d,i){
    var dStr=localDateStr(d),isToday=dStr===todayStr;
    html+='<div class="week-header'+(isToday?' today-col':'')+'">'+dayLabels[i]+'<br><span style="font-weight:600;">'+d.getDate()+'</span></div>';
  });

  // 팀공지 행
  html+='<div class="week-staff-label" style="background:#FFF9E6;"><span style="font-size:10px;font-weight:700;color:#854F0B;">📢 팀공지</span></div>';
  days.forEach(function(d){
    var dStr=localDateStr(d),isToday=dStr===todayStr;
    var teamItems=filtered.filter(function(s){
      if(s.type!=='team'||!s.date) return false;
      var start=s.date.slice(0,10),end=s.dateEnd?s.dateEnd.slice(0,10):start;
      return dStr>=start&&dStr<=end;
    });
    html+='<div class="week-cell'+(isToday?' today-col':'')+'" style="background:'+(isToday?'#fffdf0':'#FFFDF5')+';" onclick="openTypeSelectWithStaff(\''+dStr+'\',\'\')">'+
      teamItems.map(function(s){
        return '<div class="week-event" onclick="event.stopPropagation();openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;background:#FFECEC;color:#A32D2D;font-weight:700;font-size:11px;display:flex;align-items:center;gap:2px;">'+
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">'+s.bizName+'</span>'+
        '</div>';
      }).join('')+'</div>';
  });

  // 담당자 행
  staffOrder.forEach(function(staff){
    var cls=getStaffColor(staff);
    var borderCol=getStaffBorderColor(staff);
    var bgMap2={'박주형':'#E6F1FB','김재희':'#EAF3DE','손도란':'#FAEEDA','이소영':'#F3E6FB','김상준':'#FCEBEB','안은재':'#E6FBF8','견병록':'#FBF6E6','임성창':'#F0F0EC','김동현':'#FBE6F0'};
    var staffBg='#f0f0ec'; for(var sk in bgMap2){ if(staff.includes(sk)){ staffBg=bgMap2[sk]; break; } }
    // 이 담당자의 이번 주 연차/반차 여부 체크 (오늘 기준 아닌 주간 전체)
    var hasLeaveThisWeek=supports.some(function(s){
      if(s.type!=='personal') return false;
      if(!s.personalType||!(s.personalType==='연차'||s.personalType==='반차(오전)'||s.personalType==='반차(오후)')) return false;
      var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
      if(!names.some(function(n){ return n&&n.includes(staff.split(' ')[0]); })) return false;
      var start=s.date.slice(0,10),end=s.dateEnd?s.dateEnd.slice(0,10):start;
      return days.some(function(d){ var dStr=localDateStr(d); return dStr>=start&&dStr<=end; });
    });
   html+='<div class="week-staff-label"><span style="font-size:10px;font-weight:600;color:#555;padding:2px 8px;background:'+staffBg+';border-radius:4px;display:inline-block;">'+staff.split(' ')[0]+'</span></div>';
    days.forEach(function(d){
      var dStr=localDateStr(d),isToday=dStr===todayStr;
      var items=filtered.filter(function(s){
        if(s.type==='team') return false;
        if(!s.date) return false;
        var start=s.date.slice(0,10),end=s.dateEnd?s.dateEnd.slice(0,10):start;
        if(dStr<start||dStr>end) return false;
        var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
        return names.some(function(n){ return n&&n.includes(staff.split(' ')[0]); });
      });
      var mealOrder=['조식','중식','석식','야식'];
      items.sort(function(a,b){
        var am=a.meals&&a.meals.length?mealOrder.indexOf(a.meals[0]):-1;
        var bm=b.meals&&b.meals.length?mealOrder.indexOf(b.meals[0]):-1;
        if(am===-1) am=99; if(bm===-1) bm=99;
        return am-bm;
      });
      // 연차/반차면 셀 배경색 변경
      var cellBg='';
      if(isToday){
        cellBg='background:#fafff8;';
      }
      html+='<div class="week-cell'+(isToday?' today-col':'')+'" style="'+cellBg+'" onclick="openTypeSelectWithStaff(\''+dStr+'\',\''+staff+'\')" >'+
        items.map(function(s){
          var isPersonal=s.type==='personal';
          var borderColor=getStaffBorderColor(staff);
          
          var evStyle='',label='';
          if(isPersonal){
            var isLeave=s.personalType==='연차'||s.personalType==='반차(오전)'||s.personalType==='반차(오후)';
            evStyle=isLeave?'background:transparent;color:#A32D2D;font-weight:600;':'background:#e8e8e8;color:#444;';
            label=s.bizName;
          } else {
            var bgMap={
              '박주형':'#E6F1FB','김재희':'#EAF3DE','손도란':'#FAEEDA',
              '이소영':'#F3E6FB','김상준':'#FCEBEB','안은재':'#E6FBF8',
              '견병록':'#FBF6E6','임성창':'#F0F0EC','김동현':'#FBE6F0'
            };
            var bg='#f5f5f3';
            for(var k in bgMap){ if(staff.includes(k)){ bg=bgMap[k]; break; } }
            evStyle='background:'+bg+';color:#1a1a18;border-left:3px solid '+borderColor+';font-weight:600;';
            label=s.bizName;
          }
          return '<div class="week-event" onclick="event.stopPropagation();openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:2px;'+evStyle+'">'+
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">'+label+'</span>'+
            (s.category&&!isPersonal?'<span style="font-size:8px;color:#aaa;flex-shrink:0;white-space:nowrap;">'+(s.category==='이벤트'?'이벤트':s.category.slice(0,2))+'</span>':'')+
          '</div>';
        }).join('')+'</div>';
    });
  });
  html+='</div>';
  var calEl=document.getElementById('calendar'); if(calEl) calEl.innerHTML=html;
}

// ── 팝업 공통 헬퍼 ──────────────────────────
function getOrCreatePopup(){
  var popup=document.getElementById('cal-popup');
  if(!popup){
    popup=document.createElement('div'); popup.className='cal-popup'; popup.id='cal-popup';
    popup.innerHTML='<div class="cal-popup-inner"><div class="cal-popup-header"><h4 id="cal-popup-title"></h4><button class="btn sm" onclick="closeCalPopup()"><i class="ti ti-x"></i></button></div><div class="cal-popup-body" id="cal-popup-body"></div></div>';
    popup.addEventListener('click',function(e){ if(e.target===popup) closeCalPopup(); });
    document.body.appendChild(popup);
  }
  return popup;
}
function supItemHtml(s,dateKey){
  var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
  var mealStr=s.meals&&s.meals.length?s.meals.join('/'):'';
  var dateStr=s.date||'';
  if(s.dateEnd&&s.dateEnd!==s.date) dateStr+=(' ~ '+s.dateEnd);
  var c=contracts.find(function(x){ return x.name===s.bizName; });
  var cid=(c&&(!s.type||s.type==='support'))?c.id:'';
  var isPersonal=s.type==='personal',isTeam=s.type==='team';
  return '<div class="cal-sup-item">'+
    '<div style="min-width:0;flex:1;">'+
      '<div style="font-weight:600;font-size:14px;margin-bottom:6px;'+(cid?'color:#185FA5;cursor:pointer;':isTeam?'color:#854F0B;':'')+'" '+(cid?'onclick="goDetailByName(\''+s.bizName.replace(/'/g,"\\'")+'\')"':'')+'>'+
        (isTeam?'📢 ':isPersonal?'👤 ':'')+s.bizName+
      '</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">'+
        (staffStr?'<span class="badge-cat '+(getStaffColor(staffStr)||'')+'">'+staffStr+'</span>':'')+
        '<span class="badge-cat">'+(s.category||'')+'</span>'+
        (mealStr?'<span class="badge-cat">'+mealStr+'</span>':'')+
      '</div>'+
      '<div style="font-size:12px;color:#888;margin-bottom:4px;">📅 '+dateStr+'</div>'+
      (s.content?'<div style="font-size:12px;color:#555;background:#f5f5f3;padding:6px 8px;border-radius:6px;">'+s.content+'</div>':'')+
    '</div>'+
    '<div style="display:flex;gap:4px;flex-shrink:0;">'+
     (isPersonal?'<button class="btn sm" onclick="editPersonal(\''+s.id+'\')"><i class="ti ti-edit"></i></button>':'')+
      (isTeam?'<button class="btn sm" onclick="editTeam(\''+s.id+'\')"><i class="ti ti-edit"></i></button>':'')+
      (!isTeam&&!isPersonal?'<button class="btn sm" onclick="closeCalPopup();editSupport(\''+s.id+'\')"><i class="ti ti-edit"></i></button>':'')+
      '<button class="btn sm danger" onclick="delSupportFromPopup(\''+s.id+'\')"><i class="ti ti-trash"></i></button>'+
    '</div></div>';
}

window.openCalPopup=function(dateKey){
  var items=[],ids={};
  supports.forEach(function(s){
    if(!s.date||ids[s.id]) return;
    var start=s.date.slice(0,10),end=(s.dateEnd&&s.dateEnd.trim())?s.dateEnd.slice(0,10):start;
    if(dateKey>=start&&dateKey<=end){ ids[s.id]=true; items.push(s); }
  });
  if(!items.length){
    openTypeSelect(dateKey);
    return;
  }
  var popup=getOrCreatePopup();
  document.getElementById('cal-popup-title').textContent=dateKey+' 일정 ('+items.length+'건)';
  document.getElementById('cal-popup-body').innerHTML=
    '<div style="padding:8px 0 12px;">'+
      '<button class="btn primary sm" onclick="closeCalPopup();openTypeSelect(\''+dateKey+'\')">'+
        '<i class="ti ti-plus"></i> 이 날짜에 등록'+
      '</button>'+
    '</div>'+
    items.map(function(s){ return supItemHtml(s,dateKey); }).join('');
  popup.classList.add('open');
};

window.openCalPopupSingle=function(supportId){
  var s=supports.find(function(x){ return x.id===supportId; });
  if(!s) return;
  var popup=getOrCreatePopup();
  document.getElementById('cal-popup-title').textContent=s.bizName+' 일정';
  document.getElementById('cal-popup-body').innerHTML=supItemHtml(s,s.date);
  popup.classList.add('open');
};

window.closeCalPopup=function(){ var p=document.getElementById('cal-popup'); if(p) p.classList.remove('open'); };
window.editPersonal=function(id){
  var s=supports.find(function(x){ return x.id===id; }); if(!s) return;
  closeCalPopup();
  document.getElementById('personal-modal-title').textContent='개인 일정 수정';
  document.getElementById('personal-type-val').value=s.personalType||'';
  document.getElementById('personal-date').value=s.date||'';
  document.getElementById('personal-date-end').value=s.dateEnd||'';
  document.getElementById('personal-content').value=s.content||'';
  document.querySelectorAll('#personal-type-wrap .staff-chip').forEach(function(c){
    c.classList.toggle('selected',c.textContent.trim()===s.personalType);
  });
  setPersonalStaff(s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]));
  document.getElementById('personal-modal').classList.add('open');
  // 저장 버튼을 수정으로 교체
  var footer=document.querySelector('#personal-modal .sup-modal-footer');
  footer.innerHTML='<button class="btn" onclick="closePersonalModal()">취소</button>'+
    '<button class="btn primary" onclick="submitPersonalEdit(\''+id+'\')"><i class="ti ti-check"></i> 수정 저장</button>';
};
window.submitPersonalEdit=async function(id){
  var pType=document.getElementById('personal-type-val').value;
  var date=document.getElementById('personal-date').value;
  var dateEnd=document.getElementById('personal-date-end').value;
  var content=document.getElementById('personal-content').value.trim();
  var staffNames=getPersonalStaff();
  if(!pType||!date||!staffNames.length){ showToast('일정 종류, 날짜, 담당자는 필수예요.'); return; }
  try{
    await updateSupport(id,{type:'personal',bizName:pType,personalType:pType,date:date,dateEnd:dateEnd,staffNames:staffNames,staffName:staffNames.join(', '),category:'개인일정',content:content,meals:[]});
    showToast('수정되었습니다.'); closePersonalModal();
    var footer=document.querySelector('#personal-modal .sup-modal-footer');
    footer.innerHTML='<button class="btn" onclick="closePersonalModal()">취소</button><button class="btn primary" onclick="submitPersonal()"><i class="ti ti-check"></i> 등록</button>';
  } catch(e){ showToast('오류가 발생했습니다.'); }
};
window.editTeam=function(id){
  var s=supports.find(function(x){ return x.id===id; }); if(!s) return;
  closeCalPopup();
  document.getElementById('team-modal-title').textContent='팀 공지 수정';
  document.getElementById('team-title').value=s.bizName||'';
  document.getElementById('team-date').value=s.date||'';
  document.getElementById('team-date-end').value=s.dateEnd||'';
  document.getElementById('team-content').value=s.content||'';
  document.getElementById('team-modal').classList.add('open');
  var footer=document.querySelector('#team-modal .sup-modal-footer');
  footer.innerHTML='<button class="btn" onclick="closeTeamModal()">취소</button>'+
    '<button class="btn primary" onclick="submitTeamEdit(\''+id+'\')"><i class="ti ti-check"></i> 수정 저장</button>';
};
window.submitTeamEdit=async function(id){
  var title=document.getElementById('team-title').value.trim();
  var date=document.getElementById('team-date').value;
  var dateEnd=document.getElementById('team-date-end').value;
  var content=document.getElementById('team-content').value.trim();
  if(!title||!date){ showToast('제목과 날짜는 필수예요.'); return; }
  try{
    await updateSupport(id,{type:'team',bizName:title,date:date,dateEnd:dateEnd,staffNames:[],staffName:'',category:'팀공지',content:content,meals:[]});
    showToast('수정되었습니다.'); closeTeamModal();
    var footer=document.querySelector('#team-modal .sup-modal-footer');
    footer.innerHTML='<button class="btn" onclick="closeTeamModal()">취소</button><button class="btn primary" onclick="submitTeam()"><i class="ti ti-check"></i> 등록</button>';
  } catch(e){ showToast('오류가 발생했습니다.'); }
};
window.editSupportFromPopup=function(id){ closeCalPopup(); window.editSupport(id); };
window.delSupportFromPopup=async function(id){
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); closeCalPopup(); } catch(e){ showToast('오류 발생'); }
};

window.openTypeSelectWithStaff=function(date,staffName){
  window._typeSelectDate=date||null;
  window._typeSelectStaff=staffName||null;
  document.getElementById('type-select-modal').classList.add('open');
};

// ── 검색 드롭다운 ──────────────────────────
function initSS(){ renderSSOptions(''); }
function renderSSOptions(q){
  var dd=document.getElementById('ss-dropdown'); if(!dd) return;
  var fixed=['온정본사','온정CS'];
  var fixedFiltered=fixed.filter(function(n){ return !q||n.toLowerCase().includes(q.toLowerCase()); });
  var f=ssOptions.filter(function(c){ return !q||c.name.toLowerCase().includes(q.toLowerCase()); });
  var fixedHtml=fixedFiltered.map(function(n){
    return '<div class="ss-option" onmousedown="selectSS(\''+n+'\')">'+n+'</div>';
  }).join('');
  var listHtml=f.length?f.map(function(c){ return '<div class="ss-option" onmousedown="selectSS(\''+c.name.replace(/'/g,"\\'")+'\')">'+c.name+'</div>'; }).join(''):'';
  dd.innerHTML=(fixedHtml+listHtml)||'<div class="ss-option" style="color:#aaa;">없음</div>';
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

// ── 운영지원 모달 ──────────────────────────
window.openSupportModal=function(){
  editingSupportId=null;
  document.getElementById('sup-modal-title').textContent='운영지원 등록';
  document.getElementById('ss-input').value='';
  document.getElementById('sup-biz').value='';
  document.getElementById('sup-date').value='';
  if(document.getElementById('sup-date-end')) document.getElementById('sup-date-end').value='';
  document.getElementById('sup-cat').value='';
  document.getElementById('sup-content').value='';
  var smWrap=document.getElementById('special-menu-wrap'); if(smWrap) smWrap.style.display='none';
  var smInput=document.getElementById('sup-special-menu'); if(smInput) smInput.value='';
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
  var dateEnd=document.getElementById('sup-date-end')?document.getElementById('sup-date-end').value:'';
  var meals=getSelectedMeals(),staffNames=getSelectedStaff();
  var cat=document.getElementById('sup-cat').value,content=document.getElementById('sup-content').value.trim();
  var specialMenu=document.getElementById('sup-special-menu')?document.getElementById('sup-special-menu').value.trim():'';
  if((cat==='특식지원'||cat==='이벤트')&&specialMenu) content=(specialMenu+(content?' / '+content:''));
  if(!biz||!date||!cat){ showToast('업장, 일자, 카테고리는 필수예요.'); return; }
  var data={type:'support',bizName:biz,date:date,dateEnd:dateEnd,timeStart:'',timeEnd:'',meals:meals,staffName:staffNames.join(', '),staffNames:staffNames,category:cat,content:content};
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
  if(document.getElementById('sup-date-end')) document.getElementById('sup-date-end').value=s.dateEnd||'';
  document.getElementById('sup-cat').value=s.category||'';
  toggleSpecialMenu(s.category||'');
  var smInput=document.getElementById('sup-special-menu');
  if((s.category==='특식지원'||s.category==='이벤트')&&s.content&&smInput){
    var parts=s.content.split(' / ');
    smInput.value=parts[0]||'';
    document.getElementById('sup-content').value=parts.slice(1).join(' / ')||'';
  } else {
    if(smInput) smInput.value='';
    document.getElementById('sup-content').value=s.content||'';
  }
  setSelectedMeals(s.meals||[]);
  setSelectedStaff(s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]));
  document.getElementById('sup-modal-title').textContent='운영지원 수정';
  document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 수정 저장';
  document.getElementById('sup-modal').classList.add('open');
  showToast('내용 수정 후 저장하세요.');
};
window.delSupport=async function(id){
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); } catch(e){ showToast('오류 발생'); }
};
window.delSupportFromDetail=async function(id,contractId){
  if(!confirm('삭제할까요?')) return;
  try{
    await deleteSupport(id);
    showToast('삭제되었습니다.');
    var c=contracts.find(function(x){ return x.id===contractId; });
    if(c) renderDetail(c);
  } catch(e){ showToast('오류 발생'); }
};

// ── FS 사업장 현황 ──────────────────────────
window.setBizTab=function(tab){
  currentBizTab=tab;
  document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
  var idx={team:0,resp:1,region:2,newterm:3},btns=document.querySelectorAll('.tab-btn');
  if(btns[idx[tab]!==undefined?idx[tab]:0]) btns[idx[tab]!==undefined?idx[tab]:0].classList.add('active');
  if(mapInstance&&tab!=='region'){mapInstance.remove();mapInstance=null;}
  document.querySelectorAll('.team-body').forEach(function(b){ b.classList.remove('open'); });
  renderBizTab();
};
window.toggleTeam=function(id){
  var body=document.getElementById(id); if(!body) return;
  body.classList.toggle('open');
  var icon=body.previousElementSibling.querySelector('.toggle-icon');
  if(icon) icon.style.transform=body.classList.contains('open')?'rotate(180deg)':'';
};
window.renderBizTab=function(){
  var q=(document.getElementById('biz-search')?document.getElementById('biz-search').value:'').toLowerCase();
  var el=document.getElementById('biz-content'); if(!el) return;
  el.innerHTML='';
  function bizCard(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
    var nutriStr=c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return nt.name; }).join(' / '):'';
    var isUrgent=s==='urgent';
    return '<div class="biz-card'+(isUrgent?' urgent-card':'')+'" onclick="goDetail(\''+c.id+'\')">' +
      '<div class="biz-card-top"><span class="biz-name">'+c.name+'</span><span class="badge '+s+'">'+STATUS_META[s].label+'</span></div>'+
      '<div class="biz-info">'+
        '<div class="biz-info-row"><i class="ti ti-map-pin"></i><span>'+(c.addr||'-')+'</span></div>'+
        (currentBizTab==='team'?(nutriStr?'<div class="biz-info-row"><i class="ti ti-user"></i><span>'+nutriStr+'</span></div>':'')+(c.resp?'<div class="biz-info-row"><i class="ti ti-user-check"></i><span>'+c.resp+'</span></div>':''):'')+
        (currentBizTab==='resp'?(nutriStr?'<div class="biz-info-row"><i class="ti ti-user"></i><span>'+nutriStr+'</span></div>':''):'')+
      '</div>'+
      '<div class="biz-bottom"><span>'+fmtDate(c.endDate)+'</span><span style="font-weight:500;color:'+col+'">'+dDayLabel(d)+'</span></div>'+
      '</div>';
  }
  var filtered=contracts.filter(function(c){
    if(currentBizTab!=='newterm'&&c.terminated) return false;
    if(!q) return true;
    if(c.name.toLowerCase().includes(q)) return true;
    if(c.nutritionists&&c.nutritionists.some(function(nt){ return (nt.name||'').toLowerCase().includes(q); })) return true;
    return false;
  });
  if(currentBizTab==='team'){
    var t1=filtered.filter(function(c){ return c.team===1; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    var t2=filtered.filter(function(c){ return c.team===2; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    el.innerHTML='<div class="team-layout">'+
      '<div><div class="team-header blue" onclick="toggleTeam(\'t1\')"><i class="ti ti-users"></i> 1팀 — 박주형 본부장 <span>'+t1.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body'+(q&&t1.length?' open':'')+'" id="t1">'+t1.map(bizCard).join('')+'</div></div>'+
      '<div><div class="team-header green" onclick="toggleTeam(\'t2\')"><i class="ti ti-users"></i> 2팀 — 김재희 차장 <span>'+t2.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body'+(q&&t2.length?' open':'')+'" id="t2">'+t2.map(bizCard).join('')+'</div></div>'+
      '</div>';
    if(q){
      setTimeout(function(){
        ['t1','t2'].forEach(function(id){
          var body=document.getElementById(id),icon=body?body.previousElementSibling.querySelector('.toggle-icon'):null;
          if(body&&body.classList.contains('open')&&icon) icon.style.transform='rotate(180deg)';
        });
      },50);
    }
  } else if(currentBizTab==='resp'){
    var ro=['손도란 대리','이소영 주임','김상준 주임','견병록 매니저'],rc=['blue','green','amber','red'];
    var html='<div class="resp-layout">';
    ro.forEach(function(r,i){
      var rid='rb'+i,list=filtered.filter(function(c){ return c.resp===r; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
      html+='<div><div class="team-header '+rc[i]+'" onclick="toggleTeam(\''+rid+'\')"><i class="ti ti-user"></i> '+r+' <span>'+list.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body'+(q&&list.length?' open':'')+'" id="'+rid+'">'+list.map(bizCard).join('')+'</div></div>';
    });
    el.innerHTML=html+'</div>';
    if(q){
      setTimeout(function(){
        ro.forEach(function(_,i){
          var rid='rb'+i;
          var body=document.getElementById(rid),icon=body?body.previousElementSibling.querySelector('.toggle-icon'):null;
          if(body&&body.classList.contains('open')&&icon) icon.style.transform='rotate(180deg)';
        });
      },50);
    }
    } else if(currentBizTab==='newterm'){
    var thisYear=new Date().getFullYear();
    var newBiz=filtered.filter(function(c){
      if(c.terminated) return false;
      var h=historyData.find(function(x){ return x.contractId===c.id; });
      if(!h||!h.records||!h.records.length) return false;
      var first=h.records[0];
      if(!first.startDate) return false;
      return new Date(first.startDate).getFullYear()>=thisYear;
    });
    var termBiz=contracts.filter(function(c){ return c.terminated; });
   var html='<div class="team-layout">';
    // 신규
    html+='<div>'+
      '<div class="team-header green" onclick="toggleTeam(\'nt-new\')" style="margin-bottom:0;">'+
        '<i class="ti ti-sparkles"></i> 신규 <span>'+newBiz.length+'개소</span>'+
        '<i class="ti ti-chevron-down toggle-icon"></i>'+
      '</div>'+
      '<div class="team-body" id="nt-new">'+
        (newBiz.length?newBiz.slice().sort(function(a,b){
          var ah=historyData.find(function(x){ return x.contractId===a.id; });
          var bh=historyData.find(function(x){ return x.contractId===b.id; });
          var ad=ah&&ah.records&&ah.records.length?ah.records[0].startDate:'';
          var bd=bh&&bh.records&&bh.records.length?bh.records[0].startDate:'';
          return ad.localeCompare(bd);
        }).map(function(c){
          var h=historyData.find(function(x){ return x.contractId===c.id; });
          var openDate='';
          if(h&&h.records&&h.records.length){
            var first=h.records[0];
            if(first.startDate) openDate=fmtDate(first.startDate)+' 오픈';
          }
          var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
          var nutriStr=c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return nt.name; }).join(' / '):'';
          return '<div class="biz-card" onclick="goDetail(\''+c.id+'\')">'+
            '<div class="biz-card-top"><span class="biz-name">'+c.name+'</span>'+
            '<span style="font-size:11px;color:#3B6D11;background:#EAF3DE;padding:2px 8px;border-radius:99px;">신규</span></div>'+
            '<div class="biz-info">'+
              '<div class="biz-info-row"><i class="ti ti-map-pin"></i><span>'+(c.addr||'-')+'</span></div>'+
              (nutriStr?'<div class="biz-info-row"><i class="ti ti-user"></i><span>'+nutriStr+'</span></div>':'')+
            '</div>'+
            '<div class="biz-bottom"><span style="color:#3B6D11;font-weight:500;">'+openDate+'</span><span style="font-weight:500;color:'+col+'">'+dDayLabel(d)+'</span></div>'+
          '</div>';
        }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">올해 신규 사업장이 없어요</div>')+
      '</div>'+
    '</div>';
    // 해지
    html+='<div>'+
      '<div class="team-header red" onclick="toggleTeam(\'nt-term\')" style="margin-bottom:0;">'+
        '<i class="ti ti-file-off"></i> 해지 <span>'+termBiz.length+'개소</span>'+
        '<i class="ti ti-chevron-down toggle-icon"></i>'+
      '</div>'+
      '<div class="team-body" id="nt-term">'+
        (termBiz.length?termBiz.slice().sort(function(a,b){
          var ah=historyData.find(function(x){ return x.contractId===a.id; });
          var bh=historyData.find(function(x){ return x.contractId===b.id; });
          var ad=ah&&ah.records&&ah.records.length?ah.records[ah.records.length-1].endDate:'';
          var bd=bh&&bh.records&&bh.records.length?bh.records[bh.records.length-1].endDate:'';
          return ad.localeCompare(bd);
        }).map(function(c){
          var h=historyData.find(function(x){ return x.contractId===c.id; });
          var termDate='';
          if(h&&h.records&&h.records.length){
            var last=h.records[h.records.length-1];
            if(last.addType==='terminate'&&last.endDate) termDate=fmtDate(last.endDate)+' 해지';
          }
          return '<div class="biz-card" style="border-color:#F7C1C1;opacity:0.8;cursor:pointer;" onclick="goDetail(\''+c.id+'\')">'+
            '<div class="biz-card-top"><span class="biz-name" style="color:#888;">'+c.name+'</span>'+
            '<span style="font-size:11px;color:#A32D2D;background:#FCEBEB;padding:2px 8px;border-radius:99px;">해지</span></div>'+
            '<div class="biz-info"><div class="biz-info-row"><i class="ti ti-map-pin"></i><span>'+(c.addr||'-')+'</span></div></div>'+
            '<div class="biz-bottom"><span>'+(c.resp||'-')+'</span><span style="color:#A32D2D;font-weight:500;">'+termDate+'</span></div>'+
          '</div>';
        }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">해지 사업장이 없어요</div>')+
      '</div>'+
    '</div>';
    html+='</div>';
   el.innerHTML=html;
    
  } else {
    el.innerHTML='<div class="map-legend"><span><span class="leg-dot" style="background:#E24B4A;"></span>긴급</span><span><span class="leg-dot" style="background:#EF9F27;"></span>임박</span><span><span class="leg-dot" style="background:#4A90D9;"></span>여유/자동연장</span></div><div id="map"></div>';
    setTimeout(function(){
      if(mapInstance){mapInstance.remove();mapInstance=null;}
      mapInstance=L.map('map').setView([36.98,127.05],9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInstance);
      filtered.forEach(function(c){
        var coord=(c.lat&&c.lng)?{lat:c.lat,lng:c.lng}:COORDS[c.name]; if(!coord) return;
        var s=calcStatus(c),color=s==='urgent'?'#E24B4A':s==='near'?'#EF9F27':'#4A90D9';
        var marker=L.circleMarker([coord.lat,coord.lng],{radius:s==='urgent'?10:8,fillColor:color,color:'#fff',weight:2,fillOpacity:0.9}).addTo(mapInstance);
        marker.bindTooltip(c.name,{permanent:true,direction:'top',offset:[0,-8],opacity:0.97,className:'map-label'});
        marker.on('click',function(){ window.goDetail(c.id); });
      });
    },100);
  }
};

// ── 관리자 수정 ──────────────────────────
window.renderAdmin=function(){
  var searchEl=document.getElementById('admin-search'),q=searchEl?searchEl.value.toLowerCase():'';
  var statusOrder={urgent:0,near:1,ok:2,auto:3,terminated:4};
  var rows=contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q); }).sort(function(a,b){
    var as=a.terminated?'terminated':calcStatus(a);
    var bs=b.terminated?'terminated':calcStatus(b);
    var ao=statusOrder[as]!==undefined?statusOrder[as]:99;
    var bo=statusOrder[bs]!==undefined?statusOrder[bs]:99;
    if(ao!==bo) return ao-bo;
    return new Date(a.endDate)-new Date(b.endDate);
  });
  var el=document.getElementById('admin-count'); if(el) el.textContent=rows.length+'건';
  var tbody=document.getElementById('admin-tbody'); if(!tbody) return;
  tbody.innerHTML=rows.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate);
    return '<tr onclick="openEditModal(\''+c.id+'\')" style="'+(c.terminated?'opacity:0.5;':'')+'">' +
      '<td>'+(c.terminated?'<span class="badge" style="background:#FCEBEB;color:#A32D2D;border-color:#F7C1C1;">해지</span>':'<span class="badge '+s+'">'+STATUS_META[s].label+'</span>')+'</td>'+
      '<td style="font-weight:500;">'+c.name+'</td>'+
      '<td>'+fmtDate(c.endDate)+'</td>'+
      '<td style="font-size:12px;font-weight:500;color:'+(s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#888')+';">'+(c.terminated?'-':dDayLabel(d))+'</td>'+
      '<td>'+priceLabel(c)+'</td>'+
      '<td onclick="event.stopPropagation()"><button class="btn sm danger" onclick="handleDelete(\''+c.id+'\',\''+c.name.replace(/'/g,'')+'\')" ><i class="ti ti-trash"></i></button></td></tr>';
  }).join('')||'<tr><td colspan="6"><div class="empty-state">없음</div></td></tr>';
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

function showToast(msg){
  var el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(function(){ el.remove(); },2800);
}
document.getElementById('modal-overlay').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closeModal(); });
document.getElementById('sup-modal').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closeSupportModal(); });
document.getElementById('type-select-modal').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closeTypeSelect(); });
document.getElementById('personal-modal').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closePersonalModal(); });
document.getElementById('team-modal').addEventListener('mousedown',function(e){ if(e.target===e.currentTarget) closeTeamModal(); });
history.replaceState({screen:'home'},'','');
