// app.js
import { listenContracts, listenHistory, listenSupports, addContract, updateContract, deleteContract, addHistory, addSupport, deleteSupport, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, monthKey, monthLabel, dDiff, dDayLabel, priceLabel } from './utils.js';

var contracts = [];
var historyData = [];
var supports = [];
var editingId = null;
var currentPage = '';
var currentBizTab = 'team';
var mapInstance = null;
var detailId = null;

// ── 좌표 데이터 ──────────────────────────
var COORDS = {
  'SK가스':{lat:36.9623,lng:126.8834},'그린씨알피':{lat:37.0234,lng:127.2156},
  '다원체어스':{lat:37.6234,lng:127.3456},'대덕농협':{lat:37.0456,lng:127.2345},
  '덕일산업':{lat:36.9987,lng:127.1123},'동인물산':{lat:36.9876,lng:126.9234},
  '동인산업':{lat:36.6834,lng:127.4923},'드림메카텍':{lat:37.1234,lng:126.9634},
  '롯데웰푸드':{lat:37.1456,lng:126.9876},'메카로':{lat:37.0067,lng:127.0834},
  '발렉스':{lat:36.9912,lng:126.9145},'보성정보통신':{lat:36.9634,lng:127.0234},
  '삼양화학공업':{lat:36.1234,lng:127.7845},'삼일엘리베이터':{lat:36.6012,lng:126.6634},
  '삼전순약':{lat:37.0089,lng:127.0956},'삼정펄프':{lat:36.7534,lng:127.2234},
  '성문전자':{lat:37.0056,lng:127.1067},'세종알로이':{lat:37.0912,lng:126.9123},
  '솔레오':{lat:37.0123,lng:127.0912},'승우플라텍':{lat:37.1789,lng:127.2234},
  '신덕산업':{lat:36.8234,lng:127.0567},'신양물류':{lat:36.9745,lng:126.8912},
  '신한전기(엠투엔)':{lat:37.2234,lng:127.0634},'에스아이':{lat:37.1156,lng:126.9712},
  '엠아이텍':{lat:37.0234,lng:127.0456},'연암':{lat:36.7834,lng:127.1234},
  '오뚜기 논산':{lat:36.1956,lng:127.0834},'오뚜기 평택':{lat:37.0345,lng:127.0523},
  '오뚜기 포승':{lat:36.9689,lng:126.8834},'우보테크':{lat:36.9845,lng:126.9056},
  '우진티엠씨':{lat:37.5234,lng:126.6789},'유니젠':{lat:37.0567,lng:127.0234},
  '윤지양행':{lat:37.1523,lng:127.0712},'일렉콤':{lat:37.2834,lng:127.4523},
  '지에스아이':{lat:36.8156,lng:127.0634},'청우코아':{lat:36.9834,lng:126.9312},
  'KC글라스':{lat:36.8434,lng:127.2123},'코오롱 인더스트리':{lat:37.2045,lng:127.0923},
  '티엔씨':{lat:36.8312,lng:127.0512},'파트라':{lat:37.1745,lng:127.2123},
  '퍼슨':{lat:36.8012,lng:127.1345},'퓨어앤텍':{lat:37.1345,lng:126.9567},
  '한보일렉트':{lat:37.0912,lng:126.9123},'한석시스템':{lat:37.1923,lng:127.3034},
  '한양로보틱스':{lat:36.5934,lng:126.6623},'한온시스템 아산':{lat:36.8312,lng:127.0423},
  '한온시스템 둔포':{lat:36.8234,lng:127.0345},'에치와이':{lat:37.0256,lng:127.0512},
  '쏘나브이피씨':{lat:37.1612,lng:126.8156},'나래산업':{lat:36.9923,lng:126.9234},
  '한미에프쓰리 1공장':{lat:36.8234,lng:127.0423},'한미에프쓰리 2공장':{lat:36.8123,lng:127.0156},
  '카길 애그리 퓨리나':{lat:36.9734,lng:126.8856},'한국바이린':{lat:36.9312,lng:127.0056},
  '디이엔티 오산':{lat:37.1434,lng:127.0623},'수퍼빈(아이엠팩토리)':{lat:37.1712,lng:126.8234},
  '한국가스공사':{lat:36.9656,lng:126.8778},'동천':{lat:36.9456,lng:127.0123},
  '비씨젠':{lat:37.3234,lng:126.8234},'삼영잉크':{lat:36.9578,lng:126.8834},
  '디오토모티브':{lat:36.8256,lng:127.0312},'주강로보테크':{lat:36.9934,lng:126.9178},
  '피엘에스':{lat:36.9678,lng:126.8923},'이구산업':{lat:36.9612,lng:126.8901},
  '진보':{lat:37.0123,lng:127.0678},'EPS코리아':{lat:36.9567,lng:126.8912},
  '두손':{lat:37.0156,lng:127.2534},'지푸드':{lat:36.9956,lng:126.9234},
  '머크':{lat:36.9612,lng:126.8856},'동아전기부품':{lat:37.2123,lng:127.0812},
  '에스앤지(바스노바)':{lat:37.2034,lng:127.2234},'대한송유관공사':{lat:37.3834,lng:127.1134},
  '미소찬':{lat:36.7923,lng:127.1523},'비와이티':{lat:36.9545,lng:126.8823},
  '대성아이앤지':{lat:36.9923,lng:126.9156},'무봉산수련원':{lat:37.0156,lng:127.0634},
  '진성티이씨 1공장':{lat:37.0023,lng:127.1034},'진성티이씨 2공장':{lat:37.0033,lng:127.1044},
  '대코':{lat:37.3745,lng:126.7834},'동아전장':{lat:36.9234,lng:127.6234},
  '린데코리아':{lat:37.0634,lng:127.1423},'신세대여행사':{lat:37.2634,lng:126.9834},
  '삼아알미늄':{lat:36.9534,lng:126.8767},'필코코스팜':{lat:36.9901,lng:126.9178},
  '세명테크':{lat:36.8167,lng:127.0712},'효림정공':{lat:37.0034,lng:127.1089},
};

var SUPPORT_CATS = ['위생점검','운영상황체크','특식지원','배식지원','미팅','기타'];

// ── 초기화 ──────────────────────────
async function init() {
  await seedIfEmpty();
  listenContracts(function(data) { contracts = data; if(currentPage) renderPage(currentPage); });
  listenHistory(function(data) { historyData = data; });
  listenSupports(function(data) { supports = data; if(currentPage==='support') renderSupport(); });
}
init();

// ── 페이지 전환 ──────────────────────────
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
  if(page==='contracts') actions.innerHTML = '<button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button>';
  ['dashboard','support','businesses','admin'].forEach(function(p){
    var el=document.getElementById('page-'+p);
    if(el) el.style.display = p===page?'block':'none';
  });
  if(mapInstance&&page!=='businesses'){mapInstance.remove();mapInstance=null;}
  renderPage(page);
};

function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='support') renderSupport();
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

  // 카드 클릭 리스트
  function renderList(el, filter) {
    var list = contracts.filter(function(c){ return filter(calcStatus(c)); })
      .sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    el.innerHTML = list.length ? list.map(function(c){
      var s=calcStatus(c); var d=dDiff(c.endDate);
      return '<div class="dash-item" onclick="goDetail(\'' + c.id + '\')">' +
        '<div><div class="dash-name">' + c.name + '</div>' +
        '<div class="dash-sub">' + c.resp + ' · ' + c.addr.split(' ').slice(0,2).join(' ') + '</div></div>' +
        '<div class="dash-right"><span class="badge ' + s + '">' + STATUS_META[s].label + '</span>' +
        '<div class="dash-dday" style="color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + '">' + dDayLabel(d) + '</div></div></div>';
    }).join('') : '<div class="empty-state"><i class="ti ti-check"></i>해당 없음</div>';
  }

  var activeCard = document.querySelector('.stat-card.active-card');
  var activeFilter = activeCard ? activeCard.dataset.filter : null;
  var listEl = document.getElementById('dash-list');
  var listWrap = document.getElementById('dash-list-wrap');

  if(activeFilter) {
    listWrap.style.display = 'block';
    var filterFn = {
      'all': function(s){ return true; },
      'urgent': function(s){ return s==='urgent'; },
      'near': function(s){ return s==='near'; },
      'auto': function(s){ return s==='auto'; },
    }[activeFilter] || function(){ return true; };
    renderList(listEl, filterFn);
  }
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
    if(filter==='all') return true;
    return s === filter;
  }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  listEl.innerHTML = list.length ? list.map(function(c){
    var s=calcStatus(c); var d=dDiff(c.endDate);
    return '<div class="dash-item" onclick="goDetail(\'' + c.id + '\')">' +
      '<div><div class="dash-name">' + c.name + '</div>' +
      '<div class="dash-sub">' + c.resp + ' · ' + c.addr.split(' ').slice(0,2).join(' ') + '</div></div>' +
      '<div class="dash-right"><span class="badge ' + s + '">' + STATUS_META[s].label + '</span>' +
      '<div class="dash-dday" style="color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + '">' + dDayLabel(d) + '</div></div></div>';
  }).join('') : '<div class="empty-state"><i class="ti ti-check"></i>해당 없음</div>';
};

// ── 사업장 상세 ──────────────────────────
window.goDetail = function(id) {
  var c = contracts.find(function(x){ return x.id===id; });
  if(!c) return;
  detailId = id;
  document.getElementById('app').style.display = 'none';
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('detail-screen').style.display = 'flex';
  renderDetail(c);
};

window.goBackFromDetail = function() {
  document.getElementById('detail-screen').style.display = 'none';
  if(currentPage) {
    document.getElementById('app').style.display = 'flex';
  } else {
    document.getElementById('home-screen').style.display = 'flex';
  }
};

function renderDetail(c) {
  var s = calcStatus(c);
  var d = dDiff(c.endDate);
  document.getElementById('detail-title').textContent = c.name;
  var h = historyData.find(function(h){ return h.contractId===c.id; });
  var histHtml = h && h.records && h.records.length ? h.records.map(function(r,i){
    return '<div class="hist-record">' +
      '<span class="hist-round">' + (i===0?'최초':i+'차') + '</span>' +
      '<span>' + (r.startDate?fmtDate(r.startDate):'-') + ' ~ ' + (r.endDate?fmtDate(r.endDate):'-') + '</span>' +
      '<span style="font-weight:500;">' + (r.price?Number(r.price).toLocaleString()+'원':'관리비제') + '</span>' +
      (r.note?'<span style="color:#888;font-size:12px;">'+r.note+'</span>':'') +
      '</div>';
  }).join('') : '<div style="color:#aaa;font-size:13px;padding:12px 0;">히스토리 없음</div>';

  // 지원 이력
  var bizSupports = supports.filter(function(s){ return s.bizName===c.name; })
    .sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var supHtml = bizSupports.length ? bizSupports.map(function(s){
    return '<div class="hist-record">' +
      '<span class="badge-cat">' + s.category + '</span>' +
      '<span>' + (s.date||'') + '</span>' +
      '<span style="font-weight:500;">' + (s.staffName||'') + '</span>' +
      '<span style="color:#666;">' + (s.content||'') + '</span>' +
      '</div>';
  }).join('') : '<div style="color:#aaa;font-size:13px;padding:12px 0;">지원 이력 없음</div>';

  document.getElementById('detail-body').innerHTML =
    '<div class="detail-section">' +
    '<div class="detail-row"><span class="detail-label">계약 상태</span><span class="badge ' + s + '">' + STATUS_META[s].label + '</span> <span style="color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + ';font-weight:500;">' + dDayLabel(d) + '</span></div>' +
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
    '<div class="detail-section">' +
    '<div class="detail-section-title">계약 히스토리</div>' +
    histHtml +
    '</div>' +
    '<div class="detail-section">' +
    '<div class="detail-section-title">운영지원 이력</div>' +
    supHtml +
    '</div>';
}

// ── 운영지원 ──────────────────────────
function renderSupport() {
  renderCalendar();
  renderSupportForm();
}

function renderCalendar() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  var el = document.getElementById('cal-title');
  if(el) el.textContent = year + '년 ' + (month+1) + '월';

  // 날짜별 지원 건수 맵
  var dayMap = {};
  supports.forEach(function(s){
    if(!s.date) return;
    var key = s.date.slice(0,10);
    if(!dayMap[key]) dayMap[key] = [];
    dayMap[key].push(s);
  });

  var firstDay = new Date(year, month, 1).getDay();
  var lastDate = new Date(year, month+1, 0).getDate();
  var today = new Date().toISOString().slice(0,10);
  var calHtml = '<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(function(d){ calHtml += '<div class="cal-header">' + d + '</div>'; });
  for(var i=0;i<firstDay;i++) calHtml += '<div class="cal-day empty"></div>';
  for(var d=1;d<=lastDate;d++) {
    var key = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var items = dayMap[key] || [];
    var isToday = key === today;
    calHtml += '<div class="cal-day' + (isToday?' today':'') + '">' +
      '<div class="cal-num">' + d + '</div>' +
      items.slice(0,2).map(function(s){
        return '<div class="cal-event cat-' + SUPPORT_CATS.indexOf(s.category) + '">' + (s.staffName||'') + ' ' + (s.category||'') + '</div>';
      }).join('') +
      (items.length>2?'<div class="cal-more">+' + (items.length-2) + '건</div>':'') +
      '</div>';
  }
  calHtml += '</div>';
  var calEl = document.getElementById('calendar');
  if(calEl) calEl.innerHTML = calHtml;

  // 지원 목록 (최근 20건)
  var listEl = document.getElementById('support-list');
  if(!listEl) return;
  var sorted = supports.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).slice(0,20);
  listEl.innerHTML = sorted.length ? sorted.map(function(s){
    return '<div class="sup-row">' +
      '<span class="badge-cat">' + (s.category||'') + '</span>' +
      '<span class="sup-date">' + (s.date||'') + '</span>' +
      '<span class="sup-biz" onclick="goDetail(\'' + (contracts.find(function(c){return c.name===s.bizName;})||{}).id + '\')">' + (s.bizName||'') + '</span>' +
      '<span class="sup-staff">' + (s.staffName||'') + '</span>' +
      '<span class="sup-content">' + (s.content||'') + '</span>' +
      '<button class="btn sm danger" onclick="delSupport(\'' + s.id + '\')"><i class="ti ti-trash"></i></button>' +
      '</div>';
  }).join('') : '<div class="empty-state"><i class="ti ti-calendar"></i>지원 이력이 없어요</div>';
}

function renderSupportForm() {
  var sel = document.getElementById('sup-biz');
  if(!sel) return;
  var sorted = contracts.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
  sel.innerHTML = '<option value="">업장 선택...</option>' + sorted.map(function(c){
    return '<option value="' + c.name + '">' + c.name + '</option>';
  }).join('');
}

window.submitSupport = async function() {
  var biz = document.getElementById('sup-biz').value;
  var date = document.getElementById('sup-date').value;
  var staff = document.getElementById('sup-staff').value.trim();
  var cat = document.getElementById('sup-cat').value;
  var content = document.getElementById('sup-content').value.trim();
  if(!biz||!date||!cat) { showToast('업장, 일자, 카테고리는 필수예요.'); return; }
  try {
    await addSupport({ bizName:biz, date:date, staffName:staff, category:cat, content:content });
    document.getElementById('sup-date').value='';
    document.getElementById('sup-staff').value='';
    document.getElementById('sup-content').value='';
    document.getElementById('sup-cat').value='';
    document.getElementById('sup-biz').value='';
    showToast('운영지원이 등록되었습니다.');
  } catch(e) { showToast('등록 중 오류가 발생했습니다.'); }
};

window.delSupport = async function(id) {
  if(!confirm('삭제할까요?')) return;
  try { await deleteSupport(id); showToast('삭제되었습니다.'); } catch(e) { showToast('오류 발생'); }
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
    var s = calcStatus(c);
    var d = dDiff(c.endDate);
    return '<div class="biz-card" onclick="goDetail(\'' + c.id + '\')">' +
      '<div class="biz-card-top"><span class="biz-name">' + c.name + '</span><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></div>' +
      '<div class="biz-info"><span><i class="ti ti-map-pin"></i>' + (c.addr||'-') + '</span>' +
      (c.contactName?'<span><i class="ti ti-user"></i>' + c.contactName + '</span>':'') +
      (c.contactPhone?'<span><i class="ti ti-phone"></i>' + c.contactPhone + '</span>':'') + '</div>' +
      '<div class="biz-bottom"><span>' + fmtDate(c.endDate) + '</span><span style="font-size:12px;font-weight:500;color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#854F0B') + '">' + dDayLabel(d) + '</span></div>' +
      '</div>';
  }

  var filtered = contracts.filter(function(c){ return !q||c.name.toLowerCase().includes(q)||(c.addr||'').toLowerCase().includes(q); });

  if(currentBizTab==='team') {
    var t1 = filtered.filter(function(c){ return c.team===1; }).sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    var t2 = filtered.filter(function(c){ return c.team===2; }).sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    el.innerHTML = '<div class="team-layout">' +
      '<div><div class="team-header blue"><i class="ti ti-users"></i> 1팀 — 박주형 본부장 <span>' + t1.length + '개소</span></div>' + t1.map(bizCard).join('') + '</div>' +
      '<div><div class="team-header green"><i class="ti ti-users"></i> 2팀 — 김재희 차장 <span>' + t2.length + '개소</span></div>' + t2.map(bizCard).join('') + '</div>' +
      '</div>';

  } else if(currentBizTab==='resp') {
    var respGroups = {};
    filtered.forEach(function(c){
      var r = c.resp||'미지정';
      if(!respGroups[r]) respGroups[r]=[];
      respGroups[r].push(c);
    });
    var respOrder = ['손도란 대리','이소영 주임','김상준 주임','견병록 매니저'];
    var html = '';
    respOrder.forEach(function(r){
      var list = (respGroups[r]||[]).sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
      if(!list.length) return;
      html += '<div class="resp-section"><div class="resp-header"><i class="ti ti-user"></i>' + r + ' <span>' + list.length + '개소</span></div><div class="biz-grid">' + list.map(bizCard).join('') + '</div></div>';
    });
    el.innerHTML = html || '<div class="empty-state">검색 결과 없음</div>';

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
        var coord = COORDS[c.name];
        if(!coord) return;
        var s=calcStatus(c);
        var color = s==='urgent'?'#E24B4A':s==='near'?'#EF9F27':'#4A90D9';
        var marker = L.circleMarker([coord.lat,coord.lng],{radius:s==='urgent'?10:8,fillColor:color,color:'#fff',weight:2,fillOpacity:0.9}).addTo(mapInstance);
        var d = dDiff(c.endDate);
        marker.bindTooltip(
          '<b>' + c.name + '</b>' +
          '<br><span style="color:' + color + ';font-weight:500;">' + STATUS_META[s].label + ' ' + dDayLabel(d) + '</span>' +
          '<br><span style="color:#888;font-size:12px;">' + (c.addr||'') + '</span>' +
          (c.contactName?'<br>' + c.contactName + ' ' + (c.contactPhone||''):''),
          {permanent:false,direction:'top',offset:[0,-8],opacity:0.97}
        );
        marker.on('click',function(){ goDetail(c.id); });
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
      '<td onclick="event.stopPropagation()"><button class="btn sm danger" onclick="handleDelete(\'' + c.id + '\',\'' + c.name.replace(/'/g,'') + '\')"><i class="ti ti-trash"></i></button></td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state">없음</div></td></tr>';
}

// ── 모달 ──────────────────────────
window.openAddModal = function() {
  editingId = null;
  document.getElementById('modal-title').textContent = '계약 추가';
  document.getElementById('contract-form').reset();
  document.getElementById('modal-overlay').classList.add('open');
};

window.openEditModal = function(id) {
  var c=contracts.find(function(x){ return x.id===id; }); if(!c) return;
  editingId=id;
  document.getElementById('modal-title').textContent = '계약 수정 — '+c.name;
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
  var data = {
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

// ── 엑셀 ──────────────────────────
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

// ── 유틸 ──────────────────────────
function showToast(msg) {
  var el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el); setTimeout(function(){ el.remove(); },2800);
}

document.getElementById('modal-overlay').addEventListener('click',function(e){ if(e.target===e.currentTarget) closeModal(); });
