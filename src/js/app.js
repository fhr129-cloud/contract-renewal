import { listenContracts, listenHistory, listenSupports, addContract, updateContract, deleteContract, addHistory, addSupport, deleteSupport, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, monthKey, monthLabel, dDiff, dDayLabel, priceLabel } from './utils.js';

var contracts = [];
var historyData = [];
var supports = [];
var editingId = null;
var currentPage = '';
var currentBizTab = 'team';
var mapInstance = null;
var calYear = new Date().getFullYear();
var calMonth = new Date().getMonth();
var ssOptions = [];
window.detailId = null;

var COORDS = {
  'SK가스':{lat:36.9889,lng:126.8456},'그린씨알피':{lat:37.0089,lng:127.2134},
  '다원체어스':{lat:37.6512,lng:127.3234},'대덕농협':{lat:37.0312,lng:127.2089},
  '덕일산업':{lat:37.0134,lng:127.1078},'동인물산':{lat:36.9934,lng:126.9456},
  '동인산업':{lat:36.7234,lng:127.5123},'드림메카텍':{lat:37.1089,lng:126.9823},
  '롯데웰푸드':{lat:37.1234,lng:126.9712},'메카로':{lat:37.0056,lng:127.0912},
  '발렉스':{lat:36.9978,lng:126.9234},'보성정보통신':{lat:36.9723,lng:127.0456},
  '삼양화학공업':{lat:36.1756,lng:127.7534},'삼일엘리베이터':{lat:36.6234,lng:126.6312},
  '삼전순약':{lat:37.0112,lng:127.0834},'삼정펄프':{lat:36.7623,lng:127.1934},
  '성문전자':{lat:37.0089,lng:127.0956},'세종알로이':{lat:37.0756,lng:126.8934},
  '솔레오':{lat:37.0178,lng:127.0834},'승우플라텍':{lat:37.1534,lng:127.1923},
  '신덕산업':{lat:36.8456,lng:127.0234},'신양물류':{lat:36.9845,lng:126.8534},
  '신한전기(엠투엔)':{lat:37.2089,lng:127.0712},'에스아이':{lat:37.1023,lng:126.9634},
  '엠아이텍':{lat:37.0423,lng:127.0312},'연암':{lat:36.8012,lng:127.1034},
  '오뚜기 논산':{lat:36.1834,lng:127.0956},'오뚜기 평택':{lat:37.0234,lng:127.0623},
  '오뚜기 포승':{lat:36.9756,lng:126.8412},'우보테크':{lat:36.9934,lng:126.9178},
  '우진티엠씨':{lat:37.5423,lng:126.6534},'유니젠':{lat:37.0634,lng:127.0134},
  '윤지양행':{lat:37.1489,lng:127.0634},'일렉콤':{lat:37.2712,lng:127.4312},
  '지에스아이':{lat:36.8234,lng:127.0512},'청우코아':{lat:36.9956,lng:126.9134},
  'KC글라스':{lat:36.8312,lng:127.1823},'코오롱 인더스트리':{lat:37.2134,lng:127.0834},
  '티엔씨':{lat:36.8389,lng:127.0389},'파트라':{lat:37.1623,lng:127.1834},
  '퍼슨':{lat:36.8134,lng:127.1423},'퓨어앤텍':{lat:37.1212,lng:126.9712},
  '한보일렉트':{lat:37.0834,lng:126.9034},'한석시스템':{lat:37.2034,lng:127.3423},
  '한양로보틱스':{lat:36.6023,lng:126.6512},'한온시스템 아산':{lat:36.8389,lng:127.0289},
  '한온시스템 둔포':{lat:36.8312,lng:127.0212},'에치와이':{lat:37.0312,lng:127.0389},
  '쏘나브이피씨':{lat:37.1534,lng:126.8023},'나래산업':{lat:36.9978,lng:126.9089},
  '한미에프쓰리 1공장':{lat:36.8456,lng:127.0312},'한미에프쓰리 2공장':{lat:36.8189,lng:127.0023},
  '카길 애그리 퓨리나':{lat:36.9812,lng:126.8389},'한국바이린':{lat:36.9423,lng:126.9923},
  '디이엔티 오산':{lat:37.1512,lng:127.0512},'수퍼빈(아이엠팩토리)':{lat:37.1634,lng:126.8089},
  '한국가스공사':{lat:36.9723,lng:126.8312},'동천':{lat:36.9512,lng:126.9878},
  '비씨젠':{lat:37.3156,lng:126.8312},'삼영잉크':{lat:36.9645,lng:126.8478},
  '디오토모티브':{lat:36.8334,lng:127.0189},'주강로보테크':{lat:36.9989,lng:126.9034},
  '피엘에스':{lat:36.9734,lng:126.8523},'이구산업':{lat:36.9678,lng:126.8645},
  '진보':{lat:37.0189,lng:127.0534},'EPS코리아':{lat:36.9623,lng:126.8712},
  '두손':{lat:37.0234,lng:127.2312},'지푸드':{lat:37.0012,lng:126.9089},
  '머크':{lat:36.9667,lng:126.8423},'동아전기부품':{lat:37.2189,lng:127.0734},
  '에스앤지(바스노바)':{lat:37.2112,lng:127.2189},'대한송유관공사':{lat:37.3712,lng:127.1023},
  '미소찬':{lat:36.8023,lng:127.1423},'비와이티':{lat:36.9589,lng:126.8534},
  '대성아이앤지':{lat:36.9989,lng:126.9034},'무봉산수련원':{lat:37.0234,lng:127.0512},
  '진성티이씨 1공장':{lat:37.0089,lng:127.1023},'진성티이씨 2공장':{lat:37.0078,lng:127.1034},
  '대코':{lat:37.3623,lng:126.7923},'동아전장':{lat:36.9712,lng:127.5934},
  '린데코리아':{lat:37.0712,lng:127.1312},'신세대여행사':{lat:37.2712,lng:126.9712},
  '삼아알미늄':{lat:36.9589,lng:126.8612},'필코코스팜':{lat:36.9956,lng:126.9023},
  '세명테크':{lat:36.8289,lng:127.0589},'효림정공':{lat:37.0056,lng:127.0934},
};
var SUPPORT_CATS = ['위생점검','운영상황체크','특식지원','배식지원','미팅','기타'];

async function init() {
  await seedIfEmpty();
  listenContracts(function(data) {
    contracts = data;
    ssOptions = data.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    if(currentPage) renderPage(currentPage);
  });
  listenHistory(function(data) { historyData = data; });
  listenSupports(function(data) {
    supports = data;
    if(currentPage==='support') renderCalendar();
  });
}
init();

window.goHome = function() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('detail-screen').style.display = 'none';
  document.getElementById('home-screen').style.display = 'flex';
  if(mapInstance){mapInstance.remove();mapInstance=null;}
  currentPage = '';
};

window.goPage = function(page) {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('detail-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  currentPage = page;
  var titles = {dashboard:'대시보드', support:'운영지원', businesses:'FS 사업장 현황', admin:'관리자 수정'};
  document.getElementById('page-title').textContent = titles[page]||'';
  var actions = document.getElementById('top-actions');
  actions.innerHTML = '';
  if(page==='admin') actions.innerHTML = '<button class="btn primary" onclick="openAddModal()"><i class="ti ti-plus"></i> 추가</button><button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button>';
  ['dashboard','support','businesses','admin'].forEach(function(p){
    var el=document.getElementById('page-'+p);
    if(el) el.style.display = p===page?'block':'none';
  });
  if(mapInstance&&page!=='businesses'){mapInstance.remove();mapInstance=null;}
  renderPage(page);
};

function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='support') { renderCalendar(); renderSupportList(); initSS(); }
  if(page==='businesses') renderBizTab();
  if(page==='admin') renderAdmin();
}

// ── 대시보드 ──────────────────────────
function renderDashboard() {
  var counts = {total:contracts.length, urgent:0, near:0, auto:0};
  contracts.forEach(function(c){
    var s=calcStatus(c);
    if(s==='urgent') counts.urgent++;
    else if(s==='near') counts.near++;
    else if(s==='auto') counts.auto++;
  });
  function makeCard(id, cls, icon, label, count) {
    document.getElementById(id).innerHTML =
      '<div class="stat-icon ' + cls + '"><i class="ti ' + icon + '"></i></div>' +
      '<div class="stat-info"><div class="stat-label">' + label + '</div><div class="stat-val ' + cls + '">' + count + '</div></div>';
  }
  makeCard('card-total','blue','ti-building','전체 사업장',counts.total);
  makeCard('card-urgent','red','ti-alert-circle','계약 긴급 (D-30)',counts.urgent);
  makeCard('card-near','amber','ti-clock','계약 임박 (D-90)',counts.near);
  makeCard('card-auto','blue2','ti-refresh','자동연장 중',counts.auto);
}

window.toggleDashCard = function(el, filter) {
  document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); });
  var wrap = document.getElementById('dash-list-wrap');
  var listEl = document.getElementById('dash-list');
  if(el.dataset.lastFilter === filter) {
    el.dataset.lastFilter = '';
    wrap.style.display = 'none';
    return;
  }
  el.classList.add('active-card');
  el.dataset.lastFilter = filter;
  wrap.style.display = 'block';
  var list = contracts.filter(function(c){
    var s = calcStatus(c);
    return filter==='all' ? true : s===filter;
  }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  listEl.innerHTML = list.length ? list.map(function(c){
    var s=calcStatus(c); var d=dDiff(c.endDate);
    return '<div class="dash-item" onclick="goDetail(\'' + c.id + '\')">' +
      '<div><div class="dash-name">' + c.name + '</div>' +
      '<div class="dash-sub">' + (c.resp||'') + ' · ' + (c.addr||'').split(' ').slice(0,2).join(' ') + '</div></div>' +
      '<div class="dash-right"><span class="badge ' + s + '">' + STATUS_META[s].label + '</span>' +
      '<div class="dash-dday" style="color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + '">' + dDayLabel(d) + '</div></div></div>';
  }).join('') : '<div class="empty-state"><i class="ti ti-check"></i>해당 없음</div>';
};

// ── 사업장 상세 ──────────────────────────
window.goDetail = function(id) {
  if(!id||id==='undefined') return;
  var c = contracts.find(function(x){ return x.id===id; });
  if(!c) return;
  window.detailId = id;
  document.getElementById('app').style.display = 'none';
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('detail-screen').style.display = 'flex';
  renderDetail(c);
};

window.goBackFromDetail = function() {
  document.getElementById('detail-screen').style.display = 'none';
  if(currentPage) document.getElementById('app').style.display = 'flex';
  else document.getElementById('home-screen').style.display = 'flex';
};

function renderDetail(c) {
  var s=calcStatus(c); var d=dDiff(c.endDate);
  document.getElementById('detail-title').textContent = c.name;
  var h = historyData.find(function(h){ return h.contractId===c.id; });
  var histHtml = h&&h.records&&h.records.length ? h.records.map(function(r,i){
    return '<div class="hist-record">' +
      '<span class="hist-round">' + (i===0?'최초':i+'차') + '</span>' +
      '<span>' + (r.startDate?fmtDate(r.startDate):'-') + ' ~ ' + (r.endDate?fmtDate(r.endDate):'-') + '</span>' +
      '<span style="font-weight:500;">' + (r.price?Number(r.price).toLocaleString()+'원/식':'관리비제') + '</span>' +
      (r.note?'<span style="color:#888;font-size:12px;">'+r.note+'</span>':'') + '</div>';
  }).join('') : '<div style="color:#aaa;font-size:13px;padding:12px 0;">히스토리 없음</div>';

  var bizSupports = supports.filter(function(sp){ return sp.bizName===c.name; })
    .sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var supHtml = bizSupports.length ? bizSupports.map(function(sp){
    return '<div class="hist-record">' +
      '<span class="badge-cat">' + (sp.category||'') + '</span>' +
      '<span style="font-size:12px;color:#888;">' + (sp.date||'') + '</span>' +
      '<span style="font-weight:500;">' + (sp.staffName||'') + '</span>' +
      '<span style="color:#666;">' + (sp.content||'') + '</span></div>';
  }).join('') : '<div style="color:#aaa;font-size:13px;padding:12px 0;">지원 이력 없음</div>';

  document.getElementById('detail-body').innerHTML =
    '<div class="detail-section">' +
    '<div class="detail-row"><span class="detail-label">계약 상태</span>' +
    '<div style="display:flex;align-items:center;gap:8px;"><span class="badge ' + s + '">' + STATUS_META[s].label + '</span>' +
    '<span style="color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + ';font-weight:500;">' + dDayLabel(d) + '</span></div></div>' +
    '<div class="detail-row"><span class="detail-label">소재지</span><span>' + (c.addr||'-') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">담당자</span><span>' + (c.contactName||'-') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">연락처</span><span>' + (c.contactPhone||'-') + (c.tel?' / '+c.tel:'') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">팀 / 책임</span><span>' + (c.team?c.team+'팀':'-') + ' / ' + (c.resp||'-') + '</span></div>' +
    '</div>' +
    '<div class="detail-section">' +
    '<div class="detail-section-title">계약 정보</div>' +
    '<div class="detail-row"><span class="detail-label">계약기간</span><span>' + fmtDate(c.startDate) + ' ~ ' + fmtDate(c.endDate) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">계약단가</span><span>' + priceLabel(c) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">월평균식수</span><span>' + (c.avgMeals?Number(c.avgMeals).toLocaleString()+'식':'-') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">운영끼니</span><span>' + (c.meals||'-') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">주말운영</span><span>' + (c.weekend||'없음') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">자동연장</span><span>' + (c.autoRenew?'있음':'없음') + '</span></div>' +
    (c.note?'<div class="detail-row"><span class="detail-label">특이사항</span><span>' + c.note + '</span></div>':'') +
    '</div>' +
    '<div class="detail-section"><div class="detail-section-title">계약 히스토리</div>' + histHtml + '</div>' +
    '<div class="detail-section"><div class="detail-section-title">운영지원 이력</div>' + supHtml + '</div>';
}

// ── 운영지원 ──────────────────────────
window.changeMonth = function(dir) {
  if(dir===0){ calYear=new Date().getFullYear(); calMonth=new Date().getMonth(); }
  else {
    calMonth += dir;
    if(calMonth>11){calMonth=0;calYear++;}
    if(calMonth<0){calMonth=11;calYear--;}
  }
  renderCalendar();
};

function renderCalendar() {
  var el = document.getElementById('cal-title');
  if(el) el.textContent = calYear + '년 ' + (calMonth+1) + '월';
  var dayMap = {};
  supports.forEach(function(s){
    if(!s.date) return;
    var key = s.date.slice(0,10);
    if(!dayMap[key]) dayMap[key]=[];
    dayMap[key].push(s);
  });
  var firstDay = new Date(calYear,calMonth,1).getDay();
  var lastDate = new Date(calYear,calMonth+1,0).getDate();
  var today = new Date().toISOString().slice(0,10);
  var html = '<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(function(d){ html+='<div class="cal-header">'+d+'</div>'; });
  for(var i=0;i<firstDay;i++) html+='<div class="cal-day empty"></div>';
  for(var d=1;d<=lastDate;d++) {
    var key = calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var items = dayMap[key]||[];
    var isToday = key===today;
    html += '<div class="cal-day'+(isToday?' today':'') + '">' +
      '<div class="cal-num">' + d + '</div>' +
      items.slice(0,3).map(function(s){
        return '<div class="cal-event cat-' + SUPPORT_CATS.indexOf(s.category) + '">' + (s.bizName||'') + '</div>';
      }).join('') +
      (items.length>3?'<div class="cal-more">+' + (items.length-3) + '건</div>':'') +
      '</div>';
  }
html += '</div>';
  var calEl = document.getElementById('calendar');
  if(calEl) calEl.innerHTML = html;
  renderSupportList();
}

function renderSupportList() {
  var listEl = document.getElementById('support-list');
  if(!listEl) return;
  var sorted = supports.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var el = document.getElementById('sup-list-count');
  if(el) el.textContent = sorted.length + '건';
  listEl.innerHTML = sorted.length ? sorted.map(function(s){
    var c = contracts.find(function(x){ return x.name===s.bizName; });
    var cid = c?c.id:'';
   return '<div class="sup-row">' +
      '<span class="badge-cat">' + (s.category||'') + '</span>' +
      '<span class="sup-date" style="font-size:12px;color:#888;">' + (s.date||'') + (s.time?' '+s.time:'') + '</span>' +
      '<span class="sup-biz"' + (cid?' onclick="goDetail(\''+cid+'\')"':'') + '>' + (s.bizName||'') + '</span>' +
      '<span style="font-size:12px;color:#666;">' + (s.staffName||'') + '</span>' +
      '<button class="btn sm danger" onclick="delSupport(\''+s.id+'\')"><i class="ti ti-trash"></i></button>' +
      '</div>';
  }).join('') : '<div class="empty-state" style="padding:20px;"><i class="ti ti-calendar"></i>지원 이력이 없어요</div>';
}

// ── 검색 가능한 업장 선택 ──────────────────────────
function initSS() {
  renderSSOptions('');
}

function renderSSOptions(q) {
  var dd = document.getElementById('ss-dropdown');
  if(!dd) return;
  var filtered = ssOptions.filter(function(c){ return !q||c.name.toLowerCase().includes(q.toLowerCase()); });
  dd.innerHTML = filtered.length ? filtered.map(function(c){
    return '<div class="ss-option" onmousedown="selectSS(\'' + c.name.replace(/'/g,"\\'") + '\')">' + c.name + '</div>';
  }).join('') : '<div class="ss-option" style="color:#aaa;">검색 결과 없음</div>';
}

window.filterSS = function() {
  var q = document.getElementById('ss-input').value;
  renderSSOptions(q);
  document.getElementById('sup-biz').value = '';
};

window.openSS = function() {
  document.getElementById('ss-dropdown').classList.add('open');
  renderSSOptions(document.getElementById('ss-input').value);
};

window.closeSS = function() {
  document.getElementById('ss-dropdown').classList.remove('open');
};

window.selectSS = function(name) {
  document.getElementById('ss-input').value = name;
  document.getElementById('sup-biz').value = name;
  document.getElementById('ss-dropdown').classList.remove('open');
};

window.submitSupport = async function() {
  var biz = document.getElementById('sup-biz').value;
  var date = document.getElementById('sup-date').value;
  var time = document.getElementById('sup-time') ? document.getElementById('sup-time').value : '';
  var staff = document.getElementById('sup-staff').value.trim();
  var cat = document.getElementById('sup-cat').value;
  var content = document.getElementById('sup-content').value.trim();
  if(!biz||!date||!cat){ showToast('업장, 일자, 카테고리는 필수예요.'); return; }
  try {
    await addSupport({bizName:biz, date:date, time:time, staffName:staff, category:cat, content:content});
    document.getElementById('ss-input').value='';
    document.getElementById('sup-biz').value='';
    document.getElementById('sup-date').value='';
    if(document.getElementById('sup-time')) document.getElementById('sup-time').value='';
    document.getElementById('sup-staff').value='';
    document.getElementById('sup-content').value='';
    document.getElementById('sup-cat').value='';
    showToast('운영지원이 등록되었습니다.');
  } catch(e){ showToast('등록 중 오류가 발생했습니다.'); }
};

window.delSupport = async function(id) {
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); } catch(e){ showToast('오류 발생'); }
};

// ── FS 사업장 현황 ──────────────────────────
window.setBizTab = function(tab) {
  currentBizTab = tab;
  document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
  var idx = {team:0,resp:1,region:2};
  var btns = document.querySelectorAll('.tab-btn');
  if(btns[idx[tab]!==undefined?idx[tab]:0]) btns[idx[tab]!==undefined?idx[tab]:0].classList.add('active');
  if(mapInstance&&tab!=='region'){mapInstance.remove();mapInstance=null;}
  renderBizTab();
};

window.renderBizTab = function() {
  var q = (document.getElementById('biz-search')?document.getElementById('biz-search').value:'').toLowerCase();
  var el = document.getElementById('biz-content');
  if(!el) return;

  function bizCard(c) {
    var s=calcStatus(c); var d=dDiff(c.endDate);
    return '<div class="biz-card" onclick="goDetail(\'' + c.id + '\')">' +
      '<div class="biz-card-top"><span class="biz-name">' + c.name + '</span><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></div>' +
      '<div class="biz-info"><span><i class="ti ti-map-pin"></i>' + (c.addr||'-') + '</span>' +
      (c.contactName?'<span><i class="ti ti-user"></i>' + c.contactName + '</span>':'') +
      (c.contactPhone?'<span><i class="ti ti-phone"></i>' + c.contactPhone + '</span>':'') + '</div>' +
      '<div class="biz-bottom"><span>' + fmtDate(c.endDate) + '</span>' +
      '<span style="font-weight:500;color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + '">' + dDayLabel(d) + '</span></div>' +
      '</div>';
  }

  var filtered = contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q)||(c.addr||'').toLowerCase().includes(q); });

  if(currentBizTab==='team') {
    var t1 = filtered.filter(function(c){ return c.team===1; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    var t2 = filtered.filter(function(c){ return c.team===2; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    el.innerHTML = '<div class="team-layout">' +
      '<div><div class="team-header blue"><i class="ti ti-users"></i> 1팀 — 박주형 본부장 <span>' + t1.length + '개소</span></div>' + t1.map(bizCard).join('') + '</div>' +
      '<div><div class="team-header green"><i class="ti ti-users"></i> 2팀 — 김재희 차장 <span>' + t2.length + '개소</span></div>' + t2.map(bizCard).join('') + '</div>' +
      '</div>';

  } else if(currentBizTab==='resp') {
    var respOrder = ['손도란 대리','이소영 주임','김상준 주임','견병록 매니저'];
    var colors = ['blue','green','amber','red'];
    var html = '<div class="resp-layout">';
    respOrder.forEach(function(r,i){
      var list = filtered.filter(function(c){ return c.resp===r; })
        .sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
      html += '<div><div class="team-header ' + colors[i] + '"><i class="ti ti-user"></i> ' + r + ' <span>' + list.length + '개소</span></div>' + list.map(bizCard).join('') + '</div>';
    });
    html += '</div>';
    el.innerHTML = html;

  } else if(currentBizTab==='region') {
    el.innerHTML = '<div class="map-legend">' +
      '<span><span class="leg-dot" style="background:#E24B4A;"></span>긴급</span>' +
      '<span><span class="leg-dot" style="background:#EF9F27;"></span>임박</span>' +
      '<span><span class="leg-dot" style="background:#4A90D9;"></span>여유/자동연장</span>' +
      '</div><div id="map"></div>';
    setTimeout(function(){
      if(mapInstance){mapInstance.remove();mapInstance=null;}
      mapInstance = L.map('map').setView([36.98,127.05],9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInstance);
      filtered.forEach(function(c){
        var coord=COORDS[c.name]; if(!coord) return;
        var s=calcStatus(c);
        var color=s==='urgent'?'#E24B4A':s==='near'?'#EF9F27':'#4A90D9';
        var marker=L.circleMarker([coord.lat,coord.lng],{radius:s==='urgent'?10:8,fillColor:color,color:'#fff',weight:2,fillOpacity:0.9}).addTo(mapInstance);
        var d=dDiff(c.endDate);
        marker.bindTooltip('<b>' + c.name + '</b><br><span style="color:' + color + ';font-weight:500;">' + STATUS_META[s].label + ' ' + dDayLabel(d) + '</span><br><span style="color:#888;font-size:12px;">' + (c.addr||'') + '</span>' + (c.contactName?'<br>' + c.contactName + ' ' + (c.contactPhone||''):''),
          {permanent:false,direction:'top',offset:[0,-8],opacity:0.97});
        marker.on('click',function(){ window.goDetail(c.id); });
      });
    },100);
  }
};

// ── 관리자 수정 ──────────────────────────
function renderAdmin() {
  var q = (document.getElementById('admin-search')?document.getElementById('admin-search').value:'').toLowerCase();
  var rows = contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q); })
    .sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  var el=document.getElementById('admin-count'); if(el) el.textContent=rows.length+'건';
  var tbody=document.getElementById('admin-tbody'); if(!tbody) return;
  tbody.innerHTML = rows.map(function(c){
    var s=calcStatus(c); var d=dDiff(c.endDate);
    return '<tr onclick="openEditModal(\'' + c.id + '\')">' +
      '<td><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></td>' +
      '<td style="font-weight:500;">' + c.name + '</td>' +
      '<td>' + fmtDate(c.endDate) + '</td>' +
      '<td style="font-size:12px;font-weight:500;color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + ';">' + dDayLabel(d) + '</td>' +
      '<td>' + priceLabel(c) + '</td>' +
      '<td onclick="event.stopPropagation()"><button class="btn sm danger" onclick="handleDelete(\'' + c.id + '\',\'' + c.name.replace(/'/g,'') + '\')"><i class="ti ti-trash"></i></button></td></tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state">없음</div></td></tr>';
}

// ── 모달 ──────────────────────────
window.openAddModal = function() {
  editingId=null;
  document.getElementById('modal-title').textContent='계약 추가';
  document.getElementById('contract-form').reset();
  document.getElementById('modal-overlay').classList.add('open');
};

window.openEditModal = function(id) {
  if(!id||id==='undefined') return;
  var c=contracts.find(function(x){ return x.id===id; }); if(!c) return;
  editingId=id;
  document.getElementById('modal-title').textContent='계약 수정 — '+c.name;
  document.getElementById('f-name').value=c.name||'';
  document.getElementById('f-addr').value=c.addr||'';
  document.getElementById('f-contactName').value=c.contactName||'';
  document.getElementById('f-contactPhone').value=c.contactPhone||'';
  document.getElementById('f-tel').value=c.tel||'';
  document.getElementById('f-team').value=c.team||1;
  document.getElementById('f-resp').value=c.resp||'';
  document.getElementById('f-startDate').value=toInputDate(c.startDate);
  document.getElementById('f-endDate').value=toInputDate(c.endDate);
  document.getElementById('f-price').value=c.price||'';
  document.getElementById('f-priceType').value=c.priceType||'per-meal';
  document.getElementById('f-meals').value=c.meals||'';
  document.getElementById('f-avgMeals').value=c.avgMeals||'';
  document.getElementById('f-weekend').value=c.weekend||'';
  document.getElementById('f-autoRenew').value=c.autoRenew?'true':'false';
  document.getElementById('f-note').value=c.note||'';
  document.getElementById('modal-overlay').classList.add('open');
};

window.closeModal = function() { document.getElementById('modal-overlay').classList.remove('open'); };

window.saveContract = async function() {
  var name=document.getElementById('f-name').value.trim();
  var endDate=document.getElementById('f-endDate').value;
  if(!name||!endDate){ showToast('사업장명과 종료일은 필수입니다.'); return; }
  var data={
    name:name, addr:document.getElementById('f-addr').value.trim(),
    contactName:document.getElementById('f-contactName').value.trim(),
    contactPhone:document.getElementById('f-contactPhone').value.trim(),
    tel:document.getElementById('f-tel').value.trim(),
    team:parseInt(document.getElementById('f-team').value)||1,
    resp:document.getElementById('f-resp').value,
    startDate:document.getElementById('f-startDate').value, endDate:endDate,
    price:parseInt(document.getElementById('f-price').value)||0,
    priceType:document.getElementById('f-priceType').value,
    meals:document.getElementById('f-meals').value.trim(),
    avgMeals:parseInt(document.getElementById('f-avgMeals').value)||0,
    weekend:document.getElementById('f-weekend').value.trim(),
    autoRenew:document.getElementById('f-autoRenew').value==='true',
    note:document.getElementById('f-note').value.trim(),
  };
  try {
    if(editingId){
      await updateContract(editingId,data);
      await addHistory(editingId,name,{startDate:data.startDate,endDate:data.endDate,price:data.price,note:data.note,updatedAt:new Date().toISOString()});
      showToast('수정되었습니다.');
    } else {
      var ref=await addContract(data);
      await addHistory(ref.id,name,{startDate:data.startDate,endDate:data.endDate,price:data.price,note:data.note,updatedAt:new Date().toISOString()});
      showToast('추가되었습니다.');
    }
    closeModal(); renderAdmin();
  } catch(e){ console.error(e); showToast('저장 중 오류가 발생했습니다.'); }
};

window.handleDelete = async function(id,name) {
  if(!confirm(name+' 계약을 삭제할까요?')) return;
  try{ await deleteContract(id); showToast(name+' 삭제되었습니다.'); renderAdmin(); }
  catch(e){ showToast('삭제 중 오류가 발생했습니다.'); }
};

window.exportExcel = function() {
  if(!window.XLSX){ showToast('잠시 후 다시 시도해 주세요.'); return; }
  var rows=[['번호','사업장','소재지','팀','책임','담당자','연락처','시작일','종료일','D-day','단가','평균식수','끼니','주말','자동연장','상태','비고']];
  contracts.slice().sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); }).forEach(function(c){
    var s=calcStatus(c);
    rows.push([c.no||'',c.name,c.addr||'',c.team||'',c.resp||'',c.contactName||'',c.contactPhone||'',fmtDate(c.startDate),fmtDate(c.endDate),dDiff(c.endDate),priceLabel(c),c.avgMeals||'',c.meals||'',c.weekend||'',c.autoRenew?'있음':'없음',STATUS_META[s].label,c.note||'']);
  });
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb,ws,'계약현황');
  XLSX.writeFile(wb,'FS사업장현황_'+new Date().toISOString().slice(0,10)+'.xlsx');
  showToast('엑셀 저장되었습니다.');
};

function showToast(msg) {
  var el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(function(){ el.remove(); },2800);
}

document.getElementById('modal-overlay').addEventListener('click',function(e){ if(e.target===e.currentTarget) closeModal(); });
