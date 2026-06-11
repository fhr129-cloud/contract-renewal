import { listenContracts, listenHistory, listenSupports, addContract, updateContract, deleteContract, addHistory, addSupport, updateSupport, deleteSupport, seedIfEmpty } from './db.js';
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
var ssOptions = [];
var currentModalTab = 'basic';
window.detailId = null;

var COORDS = {
  'SK가스':{lat:37.0067,lng:126.8051},
  '그린씨알피':{lat:37.0710,lng:127.2621},
  '다원체어스':{lat:37.6887,lng:127.3272},
  '대덕농협':{lat:37.0100,lng:127.2212},
  '덕일산업':{lat:37.0106,lng:127.0805},
  '동인물산':{lat:37.0542,lng:126.9518},
  '동인산업':{lat:36.7429,lng:127.3485},
  '드림메카텍':{lat:37.1447,lng:127.0234},
  '롯데웰푸드':{lat:37.1823,lng:126.9828},
  '메카로':{lat:37.0377,lng:127.0832},
  '발렉스':{lat:37.0501,lng:126.9711},
  '보성정보통신':{lat:36.9604,lng:127.0746},
  '삼양화학공업':{lat:36.1756,lng:127.7534},
  '삼일엘리베이터':{lat:36.6234,lng:126.6312},
  '삼전순약':{lat:37.0354,lng:127.0815},
  '삼정펄프':{lat:36.7555,lng:127.1225},
  '성문전자':{lat:37.0127,lng:127.0814},
  '세종알로이':{lat:37.0926,lng:126.9624},
  '솔레오':{lat:37.0366,lng:127.0729},
  '승우플라텍':{lat:37.1477,lng:127.1475},
  '신덕산업':{lat:36.9036,lng:127.0204},
  '신양물류':{lat:36.9704,lng:126.8425},
  '신한전기(엠투엔)':{lat:37.1634,lng:127.0854},
  '에스아이':{lat:37.1437,lng:127.0258},
  '엠아이텍':{lat:37.1024,lng:127.0565},
  '연암':{lat:36.8924,lng:127.1969},
  '오뚜기 논산':{lat:36.1943,lng:127.1246},
  '오뚜기 평택':{lat:37.1186,lng:127.0713},
  '오뚜기 포승':{lat:36.9747,lng:126.8366},
  '우보테크':{lat:37.0270,lng:126.9639},
  '우진티엠씨':{lat:37.5486,lng:126.6444},
  '유니젠':{lat:37.1243,lng:127.0491},
  '윤지양행':{lat:37.1641,lng:127.0312},
  '일렉콤':{lat:37.2463,lng:127.3770},
  '지에스아이':{lat:36.9212,lng:127.0665},
  '청우코아':{lat:37.0340,lng:126.9631},
  'KC글라스':{lat:36.9157,lng:127.2512},
  '코오롱 인더스트리':{lat:37.1827,lng:127.0944},
  '티엔씨':{lat:36.9130,lng:127.0601},
  '파트라':{lat:37.1328,lng:127.1721},
  '퍼슨':{lat:36.8269,lng:127.1088},
  '퓨어앤텍':{lat:37.1420,lng:127.0236},
  '한보일렉트':{lat:37.1142,lng:126.9780},
  '한석시스템':{lat:37.1348,lng:127.4051},
  '한양로보틱스':{lat:36.6353,lng:126.6826},
  '한온시스템 아산':{lat:36.9347,lng:127.0582},
  '한온시스템 둔포':{lat:36.9078,lng:127.0360},
  '에치와이':{lat:37.1049,lng:127.0843},
  '쏘나브이피씨':{lat:37.0613,lng:126.7716},
  '나래산업':{lat:37.0526,lng:126.9423},
  '한미에프쓰리 1공장':{lat:36.8931,lng:127.0348},
  '한미에프쓰리 2공장':{lat:36.8578,lng:127.0387},
  '카길 애그리 퓨리나':{lat:36.9446,lng:126.8342},
  '한국바이린':{lat:37.0294,lng:126.9574},
  '디이엔티 오산':{lat:37.1678,lng:127.0338},
  '수퍼빈(아이엠팩토리)':{lat:37.0734,lng:126.7933},
  '한국가스공사':{lat:36.9723,lng:126.8312},
  '동천':{lat:37.0179,lng:126.9698},
  '비씨젠':{lat:37.3097,lng:126.7400},
  '삼영잉크':{lat:36.9811,lng:126.8542},
  '디오토모티브':{lat:36.8938,lng:127.0230},
  '주강로보테크':{lat:37.0518,lng:126.9356},
  '피엘에스':{lat:36.9434,lng:126.8714},
  '이구산업':{lat:36.9766,lng:126.8405},
  '진보':{lat:37.0387,lng:127.0832},
  'EPS코리아':{lat:36.9846,lng:126.8379},
  '두손':{lat:36.9577,lng:127.2002},
  '지푸드':{lat:37.0332,lng:126.9580},
  '머크':{lat:36.9855,lng:126.8370},
  '동아전기부품':{lat:37.2189,lng:127.0734},
  '에스앤지(바스노바)':{lat:37.2826,lng:127.2131},
  '대한송유관공사':{lat:37.3712,lng:127.1023},
  '미소찬':{lat:36.9131,lng:127.2017},
  '비와이티':{lat:36.9950,lng:126.8812},
  '대성아이앤지':{lat:37.0615,lng:126.9657},
  '무봉산수련원':{lat:37.1058,lng:127.1012},
  '진성티이씨 1공장':{lat:37.0088,lng:127.0796},
  '진성티이씨 2공장':{lat:37.0103,lng:127.0833},
  '대코':{lat:37.3355,lng:126.7215},
  '동아전장':{lat:37.1456,lng:127.6441},
  '린데코리아':{lat:37.0712,lng:127.1312},
  '신세대여행사':{lat:37.2325,lng:126.9807},
  '삼아알미늄':{lat:36.9680,lng:126.8498},
  '필코코스팜':{lat:37.0350,lng:126.9386},
  '세명테크':{lat:36.9092,lng:127.0088},
  '효림정공':{lat:37.0091,lng:127.0788},
};

var SUPPORT_CATS = ['위생점검','운영상황체크','특식지원','배식지원','미팅','기타'];

// ── 전화번호 자동 하이픈 ──────────────────────────
window.formatPhone = function(input) {
  var v = input.value.replace(/[^0-9]/g,'');
  if(v.startsWith('02')) {
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

// ── 끼니 칩 ──────────────────────────
window.updateChip = function(cb) {
  var label = cb.closest('.meal-chip');
  if(label) label.classList.toggle('checked', cb.checked);
};

window.toggleWeekend = function(day) {
  var cb = document.getElementById('meal-'+day);
  var sub = document.getElementById('meal-'+day+'-sub');
  if(!cb||!sub) return;
  sub.style.display = cb.checked ? 'flex' : 'none';
  if(!cb.checked) sub.querySelectorAll('input[type=checkbox]').forEach(function(c){ c.checked=false; c.closest('.meal-chip')&&c.closest('.meal-chip').classList.remove('checked'); });
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
  document.querySelectorAll('.meal-cb').forEach(function(cb){ cb.checked=false; cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.remove('checked'); });
  ['sat','sun'].forEach(function(d){
    var cb=document.getElementById('meal-'+d), sub=document.getElementById('meal-'+d+'-sub');
    if(cb) cb.checked=false; if(sub) sub.style.display='none';
  });
  if(!meals) return;
  if(typeof meals==='string') {
    meals.split('/').forEach(function(v){
      var cb=document.querySelector('.meal-cb[data-day="weekday"][value="'+v.trim()+'"]');
      if(cb){cb.checked=true;cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.add('checked');}
    }); return;
  }
  ['weekday','sat','sun'].forEach(function(day){
    if(!meals[day]||!meals[day].length) return;
    if(day!=='weekday') {
      var cb=document.getElementById('meal-'+day), sub=document.getElementById('meal-'+day+'-sub');
      if(cb){cb.checked=true;} if(sub) sub.style.display='flex';
    }
    meals[day].forEach(function(v){
      var cb=document.querySelector('.meal-cb[data-day="'+day+'"][value="'+v+'"]');
      if(cb){cb.checked=true;cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.add('checked');}
    });
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
  var row=btn.closest('.contact-row'), wrap=document.getElementById('contact-rows');
  if(wrap&&wrap.children.length>1) row.remove(); else showToast('최소 1명은 있어야 해요.');
};
function getContacts() {
  var rows=document.querySelectorAll('#contact-rows .contact-row'), r=[];
  rows.forEach(function(row){
    var n=row.querySelector('.contact-name').value.trim();
    var p=row.querySelector('.contact-phone').value.trim();
    var t=row.querySelector('.contact-tel').value.trim();
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

// ── 지원자 ──────────────────────────
window.addStaffRow = function() {
  var wrap=document.getElementById('staff-rows'); if(!wrap) return;
  var div=document.createElement('div'); div.className='staff-row'; div.style.cssText='display:flex;gap:6px;align-items:center;';
  div.innerHTML='<input type="text" class="staff-input" placeholder="예) 이소영" style="padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;width:140px;">'+
    '<button type="button" class="btn sm danger" onclick="removeStaffRow(this)"><i class="ti ti-x"></i></button>';
  wrap.appendChild(div);
};
window.removeStaffRow = function(btn) {
  var row=btn.closest('.staff-row'), wrap=document.getElementById('staff-rows');
  if(wrap&&wrap.children.length>1) row.remove();
  else { var inp=wrap.querySelector('.staff-input'); if(inp) inp.value=''; }
};

// ── 모달 탭 전환 ──────────────────────────
window.switchModalTab = function(tab) {
  currentModalTab = tab;
  document.getElementById('tab-basic').style.display = tab==='basic'?'block':'none';
  document.getElementById('tab-hist').style.display = tab==='hist'?'block':'none';
  document.getElementById('tab-basic-btn').classList.toggle('active', tab==='basic');
  document.getElementById('tab-hist-btn').classList.toggle('active', tab==='hist');
  document.getElementById('modal-save-btn').style.display = tab==='basic'?'inline-flex':'none';
  if(tab==='hist') renderHistTab();
};

// ── 히스토리 탭 렌더 ──────────────────────────
function renderHistTab() {
  var el=document.getElementById('hist-list'); if(!el) return;
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  var records=h&&h.records?h.records:[];
  if(!records.length) { el.innerHTML='<div class="empty-state"><i class="ti ti-history"></i>이력이 없어요<br><span style="font-size:12px;">추가 버튼으로 이력을 등록하세요</span></div>'; return; }
  el.innerHTML=records.map(function(r,i){
    var isCurrent = i===records.length-1;
    var label = i===0?'최초':i+'차';
    if(isCurrent) label='현재';
    return '<div class="hist-tab-row">'+
      '<span class="hist-tab-label'+(isCurrent?' current':'')+'">'+label+'</span>'+
      '<span class="hist-tab-info">'+(r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-')+
      ' · '+(r.price?Number(r.price).toLocaleString()+'원':'관리비제')+
      (r.note?' · '+r.note:'')+
      '</span>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        '<button class="btn sm" onclick="editHistRow('+i+')"><i class="ti ti-edit"></i></button>'+
        '<button class="btn sm danger" onclick="delHistRow('+i+')"><i class="ti ti-trash"></i></button>'+
      '</div>'+
    '</div>';
  }).join('');
}

window.addHistRow = function() {
  showHistForm(-1, {startDate:'',endDate:'',price:'',note:''});
};

window.editHistRow = function(idx) {
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  if(!h||!h.records||!h.records[idx]) return;
  showHistForm(idx, h.records[idx]);
};

window.delHistRow = async function(idx) {
  if(!confirm('이 이력을 삭제할까요?')) return;
  var h=historyData.find(function(x){ return x.contractId===editingId; });
  if(!h||!h.records) return;
  var records=h.records.slice(); records.splice(idx,1);
  await saveHistRecords(records, h.name);
  showToast('삭제되었습니다.');
  renderHistTab();
};

function showHistForm(idx, r) {
  var existing=document.getElementById('hist-form-popup'); if(existing) existing.remove();
  var isNew=idx===-1;
  var popup=document.createElement('div');
  popup.id='hist-form-popup';
  popup.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:center;justify-content:center;';
  popup.innerHTML=
    '<div style="background:#fff;border-radius:14px;width:400px;max-width:95vw;padding:20px;">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'+
      '<h4 style="font-size:14px;font-weight:600;">'+(isNew?'이력 추가':(idx===0?'최초':idx+'차')+' 수정')+'</h4>'+
      '<button class="btn sm" onclick="closeHistForm()"><i class="ti ti-x"></i></button>'+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:10px;">'+
      (isNew?'<div class="form-group"><label>구분</label><select id="hf-label"><option value="최초">최초</option>'+
        [1,2,3,4,5,6,7,8,9,10].map(function(n){ return '<option value="'+n+'차">'+n+'차</option>'; }).join('')+
        '<option value="현재">현재(최신)</option></select></div>':'')+
      '<div class="form-group"><label>시작일</label><input type="date" id="hf-start" value="'+(r.startDate||'')+'"></div>'+
      '<div class="form-group"><label>종료일</label><input type="date" id="hf-end" value="'+(r.endDate||'')+'"></div>'+
      '<div class="form-group"><label>단가 (원/식, 0=관리비제)</label><input type="number" id="hf-price" value="'+(r.price||0)+'"></div>'+
      '<div class="form-group"><label>비고</label><input type="text" id="hf-note" value="'+(r.note||'')+'" placeholder="특이사항"></div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">'+
        '<button class="btn" onclick="closeHistForm()">취소</button>'+
        '<button class="btn primary" onclick="saveHistForm('+idx+')"><i class="ti ti-check"></i> 저장</button>'+
      '</div>'+
    '</div></div>';
  popup.addEventListener('click',function(e){ if(e.target===popup) closeHistForm(); });
  document.body.appendChild(popup);
}

window.closeHistForm = function() {
  var p=document.getElementById('hist-form-popup'); if(p) p.remove();
};

window.saveHistForm = async function(idx) {
  var h=editingId?historyData.find(function(x){ return x.contractId===editingId; }):null;
  var records=h&&h.records?h.records.slice():[];
  var c=contracts.find(function(x){ return x.id===editingId; });
  var newRecord={
    startDate:document.getElementById('hf-start').value,
    endDate:document.getElementById('hf-end').value,
    price:parseInt(document.getElementById('hf-price').value)||0,
    note:document.getElementById('hf-note').value.trim(),
    updatedAt:new Date().toISOString()
  };
  if(idx===-1) {
    var labelSel=document.getElementById('hf-label');
    var label=labelSel?labelSel.value:'최초';
    if(label==='현재') records.push(newRecord);
    else if(label==='최초') records.unshift(newRecord);
    else records.push(newRecord);
  } else {
    records[idx]=newRecord;
  }
  await saveHistRecords(records, c?c.name:'');
  closeHistForm();
  showToast(idx===-1?'이력이 추가되었습니다.':'이력이 수정되었습니다.');
  renderHistTab();
  // 상세화면 새로고침
  if(c&&document.getElementById('detail-screen').style.display==='flex') renderDetail(c);
};

async function saveHistRecords(records, name) {
  var { db } = await import('./db.js');
  var { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await setDoc(doc(db,'history',editingId),{
    contractId:editingId, name:name||'', records:records,
    updatedAt:serverTimestamp()
  });
}

// ── 초기화 ──────────────────────────
async function init() {
  await seedIfEmpty();
  listenContracts(function(data){
    contracts=data;
    ssOptions=data.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    if(currentPage) renderPage(currentPage);
  });
  listenHistory(function(data){ historyData=data; });
  listenSupports(function(data){
    supports=data;
    if(currentPage==='support'){ renderCalendar(); renderSupportList(); }
  });
}
init();

// ── 네비게이션 ──────────────────────────
window.addEventListener('popstate',function(e){ applyState(e.state||{screen:'home'}); });

function applyState(state) {
  document.getElementById('home-screen').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('detail-screen').style.display='none';
  if(mapInstance&&state.screen!=='page') { mapInstance.remove(); mapInstance=null; }
  if(state.screen==='home') {
    document.getElementById('home-screen').style.display='flex'; currentPage='';
  } else if(state.screen==='page') {
    document.getElementById('app').style.display='flex'; currentPage=state.page;
    var titles={dashboard:'대시보드',support:'운영지원',businesses:'FS 사업장 현황',admin:'관리자 수정'};
    document.getElementById('page-title').textContent=titles[state.page]||'';
    var actions=document.getElementById('top-actions'); actions.innerHTML='';
    if(state.page==='admin') actions.innerHTML='<button class="btn primary" onclick="openAddModal()"><i class="ti ti-plus"></i> 추가</button><button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button>';
    ['dashboard','support','businesses','admin'].forEach(function(p){
      var el=document.getElementById('page-'+p); if(el) el.style.display=p===state.page?'block':'none';
    });
    renderPage(state.page);
  } else if(state.screen==='detail') {
    document.getElementById('detail-screen').style.display='flex';
    window.detailId=state.id;
    var c=contracts.find(function(x){ return x.id===state.id; });
    if(c) renderDetail(c);
  }
}

window.goHome=function(){ var s={screen:'home'}; history.pushState(s,'',''); applyState(s); };
window.goPage=function(page){ var s={screen:'page',page:page}; history.pushState(s,'',''); applyState(s); };
window.goDetail=function(id){ if(!id||id==='undefined') return; var s={screen:'detail',id:id}; history.pushState(s,'',''); applyState(s); };
window.goBackFromDetail=function(){ history.back(); };

function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='support'){ renderCalendar(); renderSupportList(); initSS(); }
  if(page==='businesses') renderBizTab();
  if(page==='admin') renderAdmin();
}

// ── 대시보드 ──────────────────────────
function renderDashboard() {
  var counts={total:contracts.length,urgent:0,near:0,ok:0,auto:0};
  contracts.forEach(function(c){ var s=calcStatus(c); if(s==='urgent') counts.urgent++; else if(s==='near') counts.near++; else if(s==='auto') counts.auto++; else counts.ok++; });
  function mk(id,cls,icon,label,count) {
    var el=document.getElementById(id); if(!el) return;
    el.innerHTML='<div class="stat-icon '+cls+'"><i class="ti '+icon+'"></i></div><div class="stat-info"><div class="stat-label">'+label+'</div><div class="stat-val '+cls+'">'+count+'</div></div>';
  }
  mk('card-total','blue','ti-building','전체 사업장',counts.total);
  mk('card-urgent','red','ti-alert-circle','긴급 (D-30)',counts.urgent);
  mk('card-near','amber','ti-clock','임박 (D-90)',counts.near);
  mk('card-auto','blue2','ti-refresh','자동연장',counts.auto);
  mk('card-ok','green','ti-check','여유',counts.ok);
}

window.toggleDashCard=function(el,filter) {
  document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); });
  var wrap=document.getElementById('dash-list-wrap'), listEl=document.getElementById('dash-list');
  if(el.dataset.lastFilter===filter){ el.dataset.lastFilter=''; wrap.style.display='none'; return; }
  el.classList.add('active-card'); el.dataset.lastFilter=filter; wrap.style.display='block';
  var list=contracts.filter(function(c){ var s=calcStatus(c); return filter==='all'?true:s===filter; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  listEl.innerHTML=list.length?list.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
    return '<div class="dash-item" onclick="goDetail(\''+c.id+'\')">' +
      '<div class="dash-left"><div class="dash-name">'+c.name+'</div><div class="dash-sub">'+(c.resp||'')+' · '+(c.addr||'').split(' ').slice(0,2).join(' ')+'</div></div>'+
      '<div class="dash-right"><span class="badge '+s+'">'+STATUS_META[s].label+'</span><div class="dash-dday" style="color:'+col+'">'+dDayLabel(d)+'</div></div></div>';
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
    var isCurrent=i===h.records.length-1;
    var label=i===0?'최초':i+'차'; if(isCurrent) label='현재';
    return '<div class="hist-record">'+
      '<span class="hist-round'+(isCurrent?' current-round':'')+'">'+label+'</span>'+
      '<span class="hist-dates">'+(r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-')+'</span>'+
      '<span class="hist-price">'+(r.price?Number(r.price).toLocaleString()+'원':'관리비제')+'</span>'+
      '</div>';
  }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">히스토리 없음</div>';
  var bizSups=supports.filter(function(sp){ return sp.bizName===c.name; }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var supHtml=bizSups.length?bizSups.map(function(sp){
    var tStr=sp.timeStart?(sp.timeStart+(sp.timeEnd?' ~ '+sp.timeEnd:'')):(sp.time||'');
    var staffStr=sp.staffNames&&sp.staffNames.length?sp.staffNames.join(', '):(sp.staffName||'');
    return '<div class="hist-record"><span class="badge-cat">'+(sp.category||'')+'</span>'+
      '<span class="hist-dates">'+(sp.date||'')+(tStr?' '+tStr:'')+(staffStr?' · '+staffStr:'')+'</span>'+
      '<span class="hist-price" style="font-weight:400;color:#555;">'+(sp.content||'')+'</span></div>';
  }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">지원 이력 없음</div>';
  document.getElementById('detail-body').innerHTML=
    '<div class="detail-section">'+
    '<div class="detail-row"><span class="detail-label">계약 상태</span><div class="detail-val" style="display:flex;align-items:center;gap:8px;"><span class="badge '+s+'">'+STATUS_META[s].label+'</span><span style="color:'+col+';font-weight:500;">'+dDayLabel(d)+'</span></div></div>'+
    '<div class="detail-row"><span class="detail-label">소재지</span><span class="detail-val">'+(c.addr||'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">담당자</span><span class="detail-val">'+contactHtml+'</span></div>'+
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

// ── 운영지원 ──────────────────────────
window.changeMonth=function(dir){
  if(dir===0){calYear=new Date().getFullYear();calMonth=new Date().getMonth();}
  else{calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}}
  renderCalendar();
};

function renderCalendar() {
  var el=document.getElementById('cal-title'); if(el) el.textContent=calYear+'년 '+(calMonth+1)+'월';
  var dayMap={};
  supports.forEach(function(s){ if(!s.date) return; var k=s.date.slice(0,10); if(!dayMap[k]) dayMap[k]=[]; dayMap[k].push(s); });
  var firstDay=new Date(calYear,calMonth,1).getDay(), lastDate=new Date(calYear,calMonth+1,0).getDate();
  var today=new Date().toISOString().slice(0,10);
  var html='<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(function(d){ html+='<div class="cal-header">'+d+'</div>'; });
  for(var i=0;i<firstDay;i++) html+='<div class="cal-day empty"></div>';
  for(var d=1;d<=lastDate;d++) {
    var key=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var items=dayMap[key]||[], isToday=key===today;
    html+='<div class="cal-day'+(isToday?' today':'')+'" onclick="openCalPopup(\''+key+'\')">'+
      '<div class="cal-num">'+d+'</div>'+
      items.slice(0,3).map(function(s){
        var staffStr=s.staffNames&&s.staffNames.length?s.staffNames[0]:(s.staffName||'');
        return '<div class="cal-event cat-'+SUPPORT_CATS.indexOf(s.category)+'">'+(s.bizName||'')+(staffStr?'/'+staffStr:'')+'</div>';
      }).join('')+
      (items.length>3?'<div class="cal-more">+' +(items.length-3)+'건</div>':'')+
      '</div>';
  }
  html+='</div>';
  var calEl=document.getElementById('calendar'); if(calEl) calEl.innerHTML=html;
}

function renderSupportList() {
  var listEl=document.getElementById('support-list'); if(!listEl) return;
  var sorted=supports.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var el=document.getElementById('sup-list-count'); if(el) el.textContent=sorted.length+'건';
  listEl.innerHTML=sorted.length?sorted.map(function(s){
    var c=contracts.find(function(x){ return x.name===s.bizName; }), cid=c?c.id:'';
    var tStr=s.timeStart?(s.timeStart+(s.timeEnd?' ~ '+s.timeEnd:'')):(s.time||'');
    var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
    return '<div class="sup-row">'+
      '<span class="badge-cat">'+(s.category||'')+'</span>'+
      '<span class="sup-meta">'+(s.date||'')+(tStr?' '+tStr:'')+'</span>'+
      '<span class="sup-biz"'+(cid?' onclick="goDetail(\''+cid+'\')"':'')+'>'+( s.bizName||'')+'</span>'+
      '<span class="sup-staff-str">'+staffStr+'</span>'+
      '<span class="sup-content-str">'+(s.content||'')+'</span>'+
      '<button class="btn sm" onclick="editSupport(\''+s.id+'\')" style="flex-shrink:0;"><i class="ti ti-edit"></i></button>'+
      '<button class="btn sm danger" onclick="delSupport(\''+s.id+'\')" style="flex-shrink:0;"><i class="ti ti-trash"></i></button>'+
      '</div>';
  }).join(''):'<div class="empty-state" style="padding:20px;"><i class="ti ti-calendar"></i>지원 이력이 없어요</div>';
}

window.openCalPopup=function(dateKey) {
  var items=supports.filter(function(s){ return s.date&&s.date.slice(0,10)===dateKey; });
  if(!items.length) return;
  var html=items.map(function(s){
    var tStr=s.timeStart?(s.timeStart+(s.timeEnd?' ~ '+s.timeEnd:'')):(s.time||'');
    var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
    return '<div class="cal-sup-item">'+
      '<div style="min-width:0;flex:1;">'+
        '<div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+s.bizName+'</div>'+
        '<div style="font-size:12px;color:#888;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+
          '<span class="badge-cat">'+s.category+'</span>'+
          (tStr?' '+tStr:'')+(staffStr?' · '+staffStr:'')+
        '</div>'+
        (s.content?'<div style="font-size:12px;color:#555;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+s.content+'</div>':'')+
      '</div>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        '<button class="btn sm" onclick="editSupportFromPopup(\''+s.id+'\')"><i class="ti ti-edit"></i></button>'+
        '<button class="btn sm danger" onclick="delSupportFromPopup(\''+s.id+'\',\''+dateKey+'\')"><i class="ti ti-trash"></i></button>'+
      '</div></div>';
  }).join('');
  var popup=document.getElementById('cal-popup');
  if(!popup){
    popup=document.createElement('div'); popup.className='cal-popup'; popup.id='cal-popup';
    popup.innerHTML='<div class="cal-popup-inner"><div class="cal-popup-header"><h4 id="cal-popup-title"></h4><button class="btn sm" onclick="closeCalPopup()"><i class="ti ti-x"></i></button></div><div class="cal-popup-body" id="cal-popup-body"></div></div>';
    popup.addEventListener('click',function(e){ if(e.target===popup) closeCalPopup(); });
    document.body.appendChild(popup);
  }
  document.getElementById('cal-popup-title').textContent=dateKey+' 지원 내역';
  document.getElementById('cal-popup-body').innerHTML=html;
  popup.classList.add('open');
};
window.closeCalPopup=function(){ var p=document.getElementById('cal-popup'); if(p) p.classList.remove('open'); };
window.editSupportFromPopup=function(id){ closeCalPopup(); window.editSupport(id); };
window.delSupportFromPopup=async function(id,dateKey){
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); closeCalPopup(); } catch(e){ showToast('오류 발생'); }
};

function initSS(){ renderSSOptions(''); }
function renderSSOptions(q){
  var dd=document.getElementById('ss-dropdown'); if(!dd) return;
  var f=ssOptions.filter(function(c){ return !q||c.name.toLowerCase().includes(q.toLowerCase()); });
  dd.innerHTML=f.length?f.map(function(c){ return '<div class="ss-option" onmousedown="selectSS(\''+c.name.replace(/'/g,"\\'")+'\')">'+c.name+'</div>'; }).join(''):'<div class="ss-option" style="color:#aaa;">없음</div>';
}
window.filterSS=function(){ renderSSOptions(document.getElementById('ss-input').value); document.getElementById('sup-biz').value=''; };
window.openSS=function(){ document.getElementById('ss-dropdown').classList.add('open'); renderSSOptions(document.getElementById('ss-input').value); };
window.closeSS=function(){ document.getElementById('ss-dropdown').classList.remove('open'); };
window.selectSS=function(name){ document.getElementById('ss-input').value=name; document.getElementById('sup-biz').value=name; document.getElementById('ss-dropdown').classList.remove('open'); };

window.submitSupport=async function(){
  var biz=document.getElementById('sup-biz').value, date=document.getElementById('sup-date').value;
  var timeStart=document.getElementById('sup-time-start')?document.getElementById('sup-time-start').value:'';
  var timeEnd=document.getElementById('sup-time-end')?document.getElementById('sup-time-end').value:'';
  var staffInputs=document.querySelectorAll('.staff-input'), staffNames=[];
  staffInputs.forEach(function(inp){ if(inp.value.trim()) staffNames.push(inp.value.trim()); });
  var cat=document.getElementById('sup-cat').value, content=document.getElementById('sup-content').value.trim();
  if(!biz||!date||!cat){ showToast('업장, 일자, 카테고리는 필수예요.'); return; }
  var data={bizName:biz,date:date,timeStart:timeStart,timeEnd:timeEnd,staffName:staffNames.join(', '),staffNames:staffNames,category:cat,content:content};
  try{
    if(editingSupportId){ await updateSupport(editingSupportId,data); editingSupportId=null; showToast('수정되었습니다.'); }
    else{ await addSupport(data); showToast('등록되었습니다.'); }
    document.getElementById('ss-input').value=''; document.getElementById('sup-biz').value='';
    document.getElementById('sup-date').value='';
    if(document.getElementById('sup-time-start')) document.getElementById('sup-time-start').value='';
    if(document.getElementById('sup-time-end')) document.getElementById('sup-time-end').value='';
    document.getElementById('sup-cat').value=''; document.getElementById('sup-content').value='';
    var wrap=document.getElementById('staff-rows');
    if(wrap){ wrap.innerHTML=''; var div=document.createElement('div'); div.className='staff-row'; div.style.cssText='display:flex;gap:6px;align-items:center;'; div.innerHTML='<input type="text" class="staff-input" placeholder="예) 손도란" style="padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;width:140px;"><button type="button" class="btn sm danger" onclick="removeStaffRow(this)"><i class="ti ti-x"></i></button>'; wrap.appendChild(div); }
    document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 등록';
    document.getElementById('sup-cancel-btn').style.display='none';
  } catch(e){ showToast('오류가 발생했습니다.'); }
};

window.editSupport=function(id){
  var s=supports.find(function(x){ return x.id===id; }); if(!s) return;
  editingSupportId=id;
  window.selectSS(s.bizName||'');
  document.getElementById('sup-date').value=s.date||'';
  if(document.getElementById('sup-time-start')) document.getElementById('sup-time-start').value=s.timeStart||s.time||'';
  if(document.getElementById('sup-time-end')) document.getElementById('sup-time-end').value=s.timeEnd||'';
  document.getElementById('sup-cat').value=s.category||'';
  document.getElementById('sup-content').value=s.content||'';
  var wrap=document.getElementById('staff-rows');
  if(wrap){
    wrap.innerHTML='';
    var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
    if(!names.length) names=[''];
    names.forEach(function(name){
      var div=document.createElement('div'); div.className='staff-row'; div.style.cssText='display:flex;gap:6px;align-items:center;';
      div.innerHTML='<input type="text" class="staff-input" value="'+name+'" style="padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;width:140px;"><button type="button" class="btn sm danger" onclick="removeStaffRow(this)"><i class="ti ti-x"></i></button>';
      wrap.appendChild(div);
    });
  }
  document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 수정 저장';
  document.getElementById('sup-cancel-btn').style.display='inline-flex';
  window.scrollTo({top:0,behavior:'smooth'});
  showToast('내용 수정 후 저장하세요.');
};

window.cancelEditSupport=function(){
  editingSupportId=null;
  ['ss-input','sup-date','sup-content'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('sup-biz').value='';
  if(document.getElementById('sup-time-start')) document.getElementById('sup-time-start').value='';
  if(document.getElementById('sup-time-end')) document.getElementById('sup-time-end').value='';
  document.getElementById('sup-cat').value='';
  var wrap=document.getElementById('staff-rows');
  if(wrap){ wrap.innerHTML=''; var div=document.createElement('div'); div.className='staff-row'; div.style.cssText='display:flex;gap:6px;align-items:center;'; div.innerHTML='<input type="text" class="staff-input" placeholder="예) 손도란" style="padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;width:140px;"><button type="button" class="btn sm danger" onclick="removeStaffRow(this)"><i class="ti ti-x"></i></button>'; wrap.appendChild(div); }
  document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 등록';
  document.getElementById('sup-cancel-btn').style.display='none';
};

window.delSupport=async function(id){
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); } catch(e){ showToast('오류 발생'); }
};

// ── FS 사업장 현황 ──────────────────────────
window.setBizTab=function(tab){
  currentBizTab=tab;
  document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
  var idx={team:0,resp:1,region:2}, btns=document.querySelectorAll('.tab-btn');
  if(btns[idx[tab]!==undefined?idx[tab]:0]) btns[idx[tab]!==undefined?idx[tab]:0].classList.add('active');
  if(mapInstance&&tab!=='region'){mapInstance.remove();mapInstance=null;}
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
  function bizCard(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
    var contactStr='';
    if(c.contacts&&c.contacts.length) contactStr=c.contacts.map(function(ct){ return (ct.name||'')+(ct.phone?' '+ct.phone:''); }).join(' / ');
    else contactStr=(c.contactName||'')+(c.contactPhone?' '+c.contactPhone:'');
    return '<div class="biz-card" onclick="goDetail(\''+c.id+'\')">' +
      '<div class="biz-card-top"><span class="biz-name">'+c.name+'</span><span class="badge '+s+'">'+STATUS_META[s].label+'</span></div>'+
      '<div class="biz-info">'+
        '<span><i class="ti ti-map-pin"></i>'+(c.addr||'-')+'</span>'+
        (contactStr?'<span><i class="ti ti-user"></i>'+contactStr+'</span>':'')+
      '</div>'+
      '<div class="biz-bottom"><span>'+fmtDate(c.endDate)+'</span><span style="font-weight:500;color:'+col+'">'+dDayLabel(d)+'</span></div>'+
      '</div>';
  }
  var filtered=contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q)||(c.addr||'').toLowerCase().includes(q); });
  if(currentBizTab==='team'){
    var t1=filtered.filter(function(c){ return c.team===1; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    var t2=filtered.filter(function(c){ return c.team===2; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    el.innerHTML='<div class="team-layout">'+
      '<div><div class="team-header blue" onclick="toggleTeam(\'t1\')"><i class="ti ti-users"></i> 1팀 — 박주형 본부장 <span>'+t1.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body" id="t1">'+t1.map(bizCard).join('')+'</div></div>'+
      '<div><div class="team-header green" onclick="toggleTeam(\'t2\')"><i class="ti ti-users"></i> 2팀 — 김재희 차장 <span>'+t2.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body" id="t2">'+t2.map(bizCard).join('')+'</div></div>'+
      '</div>';
  } else if(currentBizTab==='resp'){
    var ro=['손도란 대리','이소영 주임','김상준 주임','견병록 매니저'], rc=['blue','green','amber','red'];
    var html='<div class="resp-layout">';
    ro.forEach(function(r,i){
      var rid='rb'+i, list=filtered.filter(function(c){ return c.resp===r; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
      html+='<div><div class="team-header '+rc[i]+'" onclick="toggleTeam(\''+rid+'\')"><i class="ti ti-user"></i> '+r+' <span>'+list.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body" id="'+rid+'">'+list.map(bizCard).join('')+'</div></div>';
    });
    el.innerHTML=html+'</div>';
  } else {
    el.innerHTML='<div class="map-legend"><span><span class="leg-dot" style="background:#E24B4A;"></span>긴급</span><span><span class="leg-dot" style="background:#EF9F27;"></span>임박</span><span><span class="leg-dot" style="background:#4A90D9;"></span>여유/자동연장</span></div><div id="map"></div>';
    setTimeout(function(){
      if(mapInstance){mapInstance.remove();mapInstance=null;}
      mapInstance=L.map('map').setView([36.98,127.05],9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInstance);
      filtered.forEach(function(c){
        var coord=COORDS[c.name]; if(!coord) return;
        var s=calcStatus(c), color=s==='urgent'?'#E24B4A':s==='near'?'#EF9F27':'#4A90D9';
        var marker=L.circleMarker([coord.lat,coord.lng],{radius:s==='urgent'?10:8,fillColor:color,color:'#fff',weight:2,fillOpacity:0.9}).addTo(mapInstance);
        marker.bindTooltip('<b>'+c.name+'</b><br><span style="color:'+color+';font-weight:500;">'+STATUS_META[s].label+' '+dDayLabel(dDiff(c.endDate))+'</span><br><span style="color:#888;font-size:12px;">'+(c.addr||'')+'</span>',{permanent:false,direction:'top',offset:[0,-8],opacity:0.97});
        marker.on('click',function(){ window.goDetail(c.id); });
      });
    },100);
  }
};

// ── 관리자 수정 ──────────────────────────
function renderAdmin(){
  var q=(document.getElementById('admin-search')?document.getElementById('admin-search').value:'').toLowerCase();
  var rows=contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q); }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  var el=document.getElementById('admin-count'); if(el) el.textContent=rows.length+'건';
  var tbody=document.getElementById('admin-tbody'); if(!tbody) return;
  tbody.innerHTML=rows.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate);
    return '<tr onclick="openEditModal(\''+c.id+'\')">' +
      '<td><span class="badge '+s+'">'+STATUS_META[s].label+'</span></td>'+
      '<td style="font-weight:500;">'+c.name+'</td>'+
      '<td>'+fmtDate(c.endDate)+'</td>'+
      '<td style="font-size:12px;font-weight:500;color:'+(s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#888')+';">'+dDayLabel(d)+'</td>'+
      '<td>'+priceLabel(c)+'</td>'+
      '<td onclick="event.stopPropagation()"><button class="btn sm danger" onclick="handleDelete(\''+c.id+'\',\''+c.name.replace(/'/g,'')+'\')" ><i class="ti ti-trash"></i></button></td></tr>';
  }).join('')||'<tr><td colspan="6"><div class="empty-state">없음</div></td></tr>';
}

// ── 모달 ──────────────────────────
window.openAddModal=function(){
  editingId=null;
  document.getElementById('modal-title').textContent='계약 추가';
  document.getElementById('contract-form').reset();
  setContacts([]); setMeals(null);
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
  setMeals(c.meals);
  switchModalTab('basic');
  document.getElementById('tab-hist-btn').style.display='inline-block';
  document.getElementById('modal-overlay').classList.add('open');
};
window.closeModal=function(){ document.getElementById('modal-overlay').classList.remove('open'); };
window.saveContract=async function(){
  var name=document.getElementById('f-name').value.trim(), endDate=document.getElementById('f-endDate').value;
  if(!name||!endDate){ showToast('사업장명과 종료일은 필수입니다.'); return; }
  var contacts=getContacts(), meals=getMeals();
  var data={
    name:name, addr:document.getElementById('f-addr').value.trim(),
    contacts:contacts, contactName:contacts.length?contacts[0].name:'', contactPhone:contacts.length?contacts[0].phone:'', tel:contacts.length?contacts[0].tel:'',
    team:parseInt(document.getElementById('f-team').value)||1, resp:document.getElementById('f-resp').value,
    startDate:document.getElementById('f-startDate').value, endDate:endDate,
    price:parseInt(document.getElementById('f-price').value)||0, priceType:document.getElementById('f-priceType').value,
    meals:meals, avgMeals:parseInt(document.getElementById('f-avgMeals').value)||0,
    autoRenew:true, note:document.getElementById('f-note').value.trim(),
  };
  try{
    if(editingId){
      await updateContract(editingId,data);
      showToast('수정되었습니다.');
    } else {
      var ref=await addContract(data);
      editingId=ref.id;
      await addHistory(ref.id,name,{startDate:data.startDate,endDate:data.endDate,price:data.price,note:data.note,updatedAt:new Date().toISOString()});
      showToast('추가되었습니다.');
    }
    closeModal(); renderAdmin();
    var c=contracts.find(function(x){ return x.id===editingId; });
    if(c&&document.getElementById('detail-screen').style.display==='flex') renderDetail(c);
  } catch(e){ console.error(e); showToast('저장 중 오류가 발생했습니다.'); }
};
window.handleDelete=async function(id,name){
  if(!confirm(name+' 계약을 삭제할까요?')) return;
  try{ await deleteContract(id); showToast(name+' 삭제되었습니다.'); renderAdmin(); } catch(e){ showToast('삭제 중 오류가 발생했습니다.'); }
};
window.exportExcel=function(){
  if(!window.XLSX){ showToast('잠시 후 다시 시도해 주세요.'); return; }
  var rows=[['번호','사업장','소재지','팀','책임','담당자','연락처','시작일','종료일','D-day','단가','평균식수','운영끼니','상태','비고']];
  contracts.slice().sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); }).forEach(function(c){
    var s=calcStatus(c), cs=c.contacts&&c.contacts.length?c.contacts.map(function(ct){ return ct.name+(ct.phone?' '+ct.phone:''); }).join(' / '):(c.contactName||'');
    rows.push([c.no||'',c.name,c.addr||'',c.team||'',c.resp||'',cs,c.contactPhone||'',fmtDate(c.startDate),fmtDate(c.endDate),dDiff(c.endDate),priceLabel(c),c.avgMeals||'',mealsDisplay(c.meals),STATUS_META[s].label,c.note||'']);
  });
  var wb=XLSX.utils.book_new(), ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,'계약현황');
  XLSX.writeFile(wb,'FS사업장현황_'+new Date().toISOString().slice(0,10)+'.xlsx');
  showToast('엑셀 저장되었습니다.');
};

function showToast(msg){
  var el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(function(){ el.remove(); },2800);
}
document.getElementById('modal-overlay').addEventListener('click',function(e){ if(e.target===e.currentTarget) closeModal(); });
history.replaceState({screen:'home'},'','');
