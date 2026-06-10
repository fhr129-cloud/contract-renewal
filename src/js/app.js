var currentUser = null;
import {
  listenContracts,
  listenHistory,
  addContract,
  updateContract,
  deleteContract,
  addHistory,
  seedIfEmpty,
  loginWithGoogle,
  logout,
  onAuthChange
} from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, monthKey, monthLabel, dDiff, dDayLabel } from './utils.js';

var contracts = [];
var history = [];
var editingId = null;
var currentBizTab = 'all';

// ── 팀/지역/책임 데이터 ──────────────────────────
var TEAM1 = ['그린씨알피','덕일산업','동인물산','롯데웰푸드','발렉스','보성정보통신','삼양화학공업','삼일엘리베이터','성문전자','세종알로이','솔레오','승우플라텍','신덕산업','신양물류','엠아이텍','연암','유니젠','윤지양행','지에스아이','청우코아','티엔씨','퓨어앤텍','한보일렉트','SK가스','퍼슨','다원체어스','우진티엠씨','나래산업','한미에프쓰리 1공장','한미에프쓰리 2공장','한국바이린','수퍼빈(아이엠팩토리)','비씨젠','디오토모티브','주강로보테크','피엘에스','머크','동아전기부품','에스앤지(바스노바)','미소찬','무봉산수련원','대코','동아전장','삼아알미늄','우보테크','EPS코리아'];
var TEAM2 = ['대덕농협','동천','드림메카텍','메카로','삼전순약','삼정펄프','신한전기(엠투엔)','에스아이','오뚜기 평택','오뚜기 포승','오뚜기 논산','일렉콤','코오롱 인더스트리','한양로보틱스','KC글라스','동인산업','한석시스템','쏘나브이피씨','파트라','한온시스템 아산','한온시스템 둔포','에치와이','카길 애그리 퓨리나','디이엔티 오산','한국가스공사','삼영잉크','이구산업','진보','지푸드','대한송유관공사','비와이티','대성아이앤지','진성티이씨 1, 2공장','린데코리아','신세대여행사','두손'];

var REGION_MAP = {
  '평택': ['그린씨알피','덕일산업','신덕산업','신양물류','발렉스','보성정보통신','성문전자','솔레오','엠아이텍','유니젠','청우코아','나래산업','주강로보테크','피엘에스','머크','삼아알미늄','우보테크','EPS코리아','SK가스','오뚜기 평택','오뚜기 포승','에치와이','카길 애그리 퓨리나','한국가스공사','삼영잉크','이구산업','진보','지푸드','비와이티','대성아이앤지','린데코리아','무봉산수련원','대코','동인물산'],
  '화성': ['롯데웰푸드','세종알로이','퓨어앤텍','한보일렉트','드림메카텍','에스아이','코오롱 인더스트리','쏘나브이피씨','수퍼빈(아이엠팩토리)','동아전기부품','신한전기(엠투엔)'],
  '아산': ['한미에프쓰리 1공장','한미에프쓰리 2공장','신덕산업','지에스아이','디오토모티브','한온시스템 아산','한온시스템 둔포','티엔씨'],
  '천안': ['퍼슨','삼정펄프','KC글라스','미소찬','연암'],
  '안성': ['그린씨알피','대덕농협','두손'],
  '용인': ['승우플라텍','한석시스템','에스앤지(바스노바)','파트라'],
  '홍성': ['삼일엘리베이터','한양로보틱스'],
  '오산': ['윤지양행','디이엔티 오산'],
  '충북/충남 기타': ['삼양화학공업','동인산업','동아전장'],
  '인천/수원/기타': ['우진티엠씨','신세대여행사','대한송유관공사','비씨젠'],
  '남양주': ['다원체어스'],
  '이천': ['일렉콤'],
};

var RESP_MAP = {
  '손도란 대리': ['그린씨알피','SK가스','연암','유니젠','윤지양행','동아전기부품','롯데웰푸드','한국바이린','동천','메카로','삼전순약공업','삼정펄프','신한전기(엠투엔)','코오롱 인더스트리','KC글라스','파트라','한온시스템 아산','한온시스템 둔포','한국가스공사','대덕농협','두손'],
  '이소영 주임': ['삼아알미늄','청우코아','퓨어앤텍','한보일렉트','디오토모티브','피엘에스','머크','EPS코리아','에스아이','오뚜기 평택','오뚜기 포승','오뚜기 논산','쏘나브이피씨','비와이티','드림메카텍','대성아이앤지','지푸드','디이엔티 오산','필코코스팜'],
  '김상준 주임': ['동인물산','보성정보통신','삼양화학공업','세종알로이','나래산업','우진티엠씨','수퍼빈(아이엠팩토리)','비씨젠','주강로보테크','동아전장','바스노바','대코','승우플라텍','솔레오','한석시스템','에치와이','퓨리나','삼영잉크','대한송유관공사','신세대여행사'],
  '견병록 매니저': ['미소찬','발렉스','성문전자','신덕산업','지에스아이','티엔씨','퍼슨','다원체어스','무봉산수련원','덕일산업','삼일엘리베이터','엠아이텍','우보테크','일렉콤','동인산업','이구산업','진보','린데코리아','한양로보틱스','진성1공장','진성2공장','효림정공'],
};

async function init() {
  await seedIfEmpty();
  listenContracts(function(data) { contracts = data; });
  listenHistory(function(data) { history = data; });
}
init();
onAuthChange(function(user) {

  currentUser = user;

  if (user) {

    document.getElementById('home-screen').style.display = 'flex';

    const authArea = document.getElementById('auth-area');

    if (authArea) {
      authArea.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:13px;">
            ${user.displayName}
          </span>

          <button class="btn sm" onclick="logoutUser()">
            로그아웃
          </button>
        </div>
      `;
    }

  } else {

    document.getElementById('app').style.display = 'none';

    const authArea = document.getElementById('auth-area');

    if (authArea) {
      authArea.innerHTML = `
        <button class="btn primary" onclick="login()">
          Google 로그인
        </button>
      `;
    }

  }

});
window.goHome = function() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('home-screen').style.display = 'flex';
};

window.goPage = function(page) {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  ['businesses','contracts','history','admin'].forEach(function(p) {
    var el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });
  var titles = { businesses:'거래처 정보', contracts:'현재 계약현황', history:'계약 히스토리', admin:'관리자 수정' };
  document.getElementById('page-title').textContent = titles[page] || '';
  var actions = document.getElementById('top-actions');
  actions.innerHTML = '';
  if (page === 'admin') {
    actions.innerHTML = '<button class="btn primary" onclick="openAddModal()"><i class="ti ti-plus"></i> 계약 추가</button>'
      + '<button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button>';
  }
  if (page === 'contracts') {
    actions.innerHTML = '<button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button>';
  }
  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.style.display = 'block';
  if (page === 'businesses') { currentBizTab = 'all'; setTabActive('all'); renderBizTab(); }
  if (page === 'contracts') { renderContractTable(); renderTimeline(); }
  if (page === 'history') renderHistory();
  if (page === 'admin') renderAdmin();
};

// ── 거래처 탭 ──────────────────────────
window.setBizTab = function(tab) {
  currentBizTab = tab;
  setTabActive(tab);
  renderBizTab();
};

function setTabActive(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var map = { all:0, team1:1, team2:2, region:3, resp:4 };
  var btns = document.querySelectorAll('.tab-btn');
  if (btns[map[tab]]) btns[map[tab]].classList.add('active');
}

window.renderBizTab = function() {
  var q = (document.getElementById('biz-search') ? document.getElementById('biz-search').value : '').toLowerCase();
  var el = document.getElementById('biz-content');
  if (!el) return;

  function getBizCard(name) {
    var c = contracts.find(function(x) { return x.name === name || x.name.includes(name) || name.includes(x.name); });
    var address = getAddress(name);
    var s = c ? calcStatus(c) : 'ok';
    var phone = c ? (c.contactPhone || '') : '';
    var contactName = c ? (c.contactName || '') : '';
    return '<div class="biz-card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
      + '<div class="biz-name">' + name + '</div>'
      + (c ? '<span class="badge ' + s + '">' + STATUS_META[s].label + '</span>' : '')
      + '</div>'
      + '<div class="biz-info">'
      + (address ? '<span><i class="ti ti-map-pin"></i>' + address + '</span>' : '')
      + (contactName ? '<span><i class="ti ti-user"></i>' + contactName + '</span>' : '')
      + (phone ? '<span><i class="ti ti-phone"></i>' + phone + '</span>' : '')
      + '</div></div>';
  }

  if (currentBizTab === 'all') {
    var all = contracts.filter(function(c) {
      return !q || c.name.toLowerCase().includes(q);
    }).sort(function(a,b) { return a.name.localeCompare(b.name); });
    el.innerHTML = '<div class="biz-grid">' + all.map(function(c) {
      var s = calcStatus(c);
      return '<div class="biz-card">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
        + '<div class="biz-name">' + c.name + '</div>'
        + '<span class="badge ' + s + '">' + STATUS_META[s].label + '</span></div>'
        + '<div class="biz-info">'
        + (c.location ? '<span><i class="ti ti-map-pin"></i>' + c.location + '</span>' : '')
        + (c.contactName ? '<span><i class="ti ti-user"></i>' + c.contactName + '</span>' : '')
        + (c.contactPhone ? '<span><i class="ti ti-phone"></i>' + c.contactPhone + '</span>' : '')
        + (c.tel ? '<span><i class="ti ti-device-landline"></i>' + c.tel + '</span>' : '')
        + '</div></div>';
    }).join('') + '</div>';

  } else if (currentBizTab === 'team1') {
    var t1 = TEAM1.filter(function(n) { return !q || n.toLowerCase().includes(q); });
    el.innerHTML = '<div style="font-size:13px;color:#888;margin-bottom:12px;">1팀 담당 사업장 — 박주형 본부장 · 총 ' + t1.length + '개소</div>'
      + '<div class="biz-grid">' + t1.map(getBizCard).join('') + '</div>';

  } else if (currentBizTab === 'team2') {
    var t2 = TEAM2.filter(function(n) { return !q || n.toLowerCase().includes(q); });
    el.innerHTML = '<div style="font-size:13px;color:#888;margin-bottom:12px;">2팀 담당 사업장 — 김재희 차장 · 총 ' + t2.length + '개소</div>'
      + '<div class="biz-grid">' + t2.map(getBizCard).join('') + '</div>';

  } else if (currentBizTab === 'region') {
    var html = '';
    Object.keys(REGION_MAP).forEach(function(region) {
      var names = REGION_MAP[region].filter(function(n) { return !q || n.toLowerCase().includes(q); });
      if (!names.length) return;
      html += '<div class="region-section">'
        + '<div class="region-header"><i class="ti ti-map-pin"></i> ' + region + ' <span class="count-badge">' + names.length + '개소</span></div>'
        + '<div class="biz-grid">' + names.map(getBizCard).join('') + '</div></div>';
    });
    el.innerHTML = html || '<div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div>';

  } else if (currentBizTab === 'resp') {
    var html2 = '';
    Object.keys(RESP_MAP).forEach(function(resp) {
      var names = RESP_MAP[resp].filter(function(n) { return !q || n.toLowerCase().includes(q); });
      if (!names.length) return;
      html2 += '<div class="resp-section">'
        + '<div class="resp-header"><i class="ti ti-user"></i> ' + resp + ' <span style="font-size:12px;font-weight:400;margin-left:6px;">' + names.length + '개소 담당</span></div>'
        + '<div class="biz-grid">' + names.map(getBizCard).join('') + '</div></div>';
    });
    el.innerHTML = html2 || '<div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div>';
  }
};

function getAddress(name) {
  var ADDRESS = {
    '그린씨알피':'안성시 고삼면 군내길 22-65','덕일산업':'평택시 세교산단로 21-20','동인물산':'평택시 청북읍 청북로 222','롯데웰푸드':'화성시 정남면 괘랑1길 42-27','발렉스':'평택시 청북읍 한산길 32','보성정보통신':'평택시 팽성읍 추팔산단로 63','삼양화학공업':'충북 영동군 매곡면 수원동길 32-40','삼일엘리베이터':'충남 홍성 내포첨단산단3길 32','성문전자':'평택시 세교동 세교산단로 61','세종알로이':'화성시 양감면 사격장길 95','솔레오':'평택시 산단로 24','승우플라텍':'용인시 처인구 남사읍 당하로 47','신덕산업':'아산시 둔포면 윤보선로336번길 55-22','신양물류':'평택시 포승읍 평택항만길 255','엠아이텍':'평택시 진위면 하북2길 174','연암':'천안시 서북구 성거읍 모전1길 172','유니젠':'평택시 서탄면 수월암리 126','윤지양행':'오산시 가장산업서북로 23','지에스아이':'아산시 둔포면 아산밸리동로 194','청우코아':'평택시 청북읍 토진3길 80-8','티엔씨':'아산시 둔포면 아산밸리로 304-29','퓨어앤텍':'화성시 정남면 정남산단로 11','한보일렉트':'화성시 양감면 초록로 706','SK가스':'평택시 포승읍 원정리 1009-1','퍼슨':'천안시 서북구 백석공단1로 47','다원체어스':'남양주시 수동면 소래비로 474-16','우진티엠씨':'인천광역시 서구 원전로 16','나래산업':'평택시 청북읍 광승길 159-47','한미에프쓰리 1공장':'아산시 둔포면 충무로 1342','한미에프쓰리 2공장':'아산시 음봉면 원남리 9-1','한국바이린':'평택시 오성면 청오로 367-61','수퍼빈(아이엠팩토리)':'화성시 우정읍 화산리 364-24','비씨젠':'안산시 단원구 별망로128번길 41','디오토모티브':'아산시 둔포면 신항리 215-1','주강로보테크':'평택시 청북읍 광승길 72-3','피엘에스':'평택시 포승읍 서동대로 437-158','머크':'평택시 포승읍 원정리 1173-2','동아전기부품':'화성시 동탄천로 31','에스앤지(바스노바)':'용인시 처인구 포곡읍 부곡로 82','미소찬':'천안시 서북구 입장면 성진로 643','무봉산수련원':'평택시 진위면 진위로 181-94','대코':'시흥시 공단1대로196번길 37','동아전장':'음성군 감곡면 대학길 247-20','삼아알미늄':'평택시 포승읍 평택항로 92','우보테크':'평택시 청북읍 양교1길 134','EPS코리아':'평택시 포승읍 평택항로 294','대덕농협':'안성시 대덕면 서동대로 4670','동천':'평택시 오성면 오성북로 145','드림메카텍':'화성시 정남면 정남산단로 41','메카로':'평택시 산단로 103-14','삼전순약':'평택시 산단로16번길 117','삼정펄프':'천안시 동남구 풍세면 잔다리길 48','신한전기(엠투엔)':'화성시 동탄산단2길 7-21','에스아이':'화성시 정남면 정남산단1길 13','오뚜기 평택':'평택시 진위면 가곡4길 60','오뚜기 포승':'평택시 포승읍 포승공단로 2','오뚜기 논산':'논산시 은진면 관촉로 58번길 138','일렉콤':'이천시 마장면 덕이로 202번길 99','코오롱 인더스트리':'화성시 동탄산단10길 74','한양로보틱스':'홍성군 홍북읍 첨단산단5길 175','KC글라스':'천안시 서북구 입장면 도림리 330','동인산업':'청주시 청원구 오창읍 두릉1길 16','한석시스템':'용인시 처인구 백암면 고안로 51번길 34','쏘나브이피씨':'화성시 우정읍 배미능골길 112-37','파트라':'용인시 처인구 남사읍 완장천로 118-22','한온시스템 아산':'아산시 둔포면 아산밸리서로 20','한온시스템 둔포':'아산시 둔포면 관대길 90-14','에치와이':'평택시 진위면 동부대로 2','카길 애그리 퓨리나':'평택시 포승읍 평택항안로 45','디이엔티 오산':'오산시 가장산업서북로 40-56','한국가스공사':'평택시 포승읍 남양만로 175-88','삼영잉크':'평택시 포승읍 내기리 679-13','이구산업':'평택시 포승읍 포승공단로 42','진보':'평택시 모곡동 438-3','지푸드':'평택시 청북읍 토진리 349-22','대한송유관공사':'성남시 분당구 안양판교로828번길 201','비와이티':'평택시 포승읍 석정리 895-1','대성아이앤지':'평택시 청북읍 한산리 879-3','진성티이씨 1, 2공장':'평택시 세교산단로 3','린데코리아':'평택시 고덕면 여염리 1673','신세대여행사':'수원시 권선구 서수원로 19','두손':'안성시 미양면 개정산업단지1로 69'
  };
  return ADDRESS[name] || '';
}

// ── 현재 계약현황 ──────────────────────────
function renderContractTable() {
  var q = (document.getElementById('search-input') ? document.getElementById('search-input').value : '').toLowerCase();
  var fs = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
  var rows = contracts.filter(function(c) {
    var s = calcStatus(c);
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (fs && s !== fs) return false;
    return true;
  }).sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });
  var el = document.getElementById('count-label');
  if (el) el.textContent = rows.length + '건';
  var tbody = document.getElementById('contract-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(function(c) {
    var s = calcStatus(c);
    var d = dDiff(c.endDate);
    var barW = Math.max(4, Math.round(Math.max(0, 1-Math.min(Math.max(d,0),400)/400)*60));
    var barColor = s==='urgent'?'#E24B4A':s==='auto'?'#378ADD':s==='near'?'#EF9F27':'#97C459';
    var priceStr = c.price ? (Number(c.price).toLocaleString()+'원') : '관리비제';
    var autoBadge = c.autoRenew ? '<span class="badge auto"><i class="ti ti-refresh"></i> 자동</span>' : '';
    return '<tr><td><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></td>'
      + '<td style="font-weight:500;">' + c.name + '</td>'
      + '<td>' + fmtDate(c.endDate) + '</td>'
      + '<td><div class="dday-wrap"><div class="dday-bar" style="width:' + barW + 'px;background:' + barColor + ';"></div>'
      + '<span style="font-size:12px;color:' + barColor + ';font-weight:500;">' + dDayLabel(d) + '</span></div></td>'
      + '<td>' + autoBadge + '</td>'
      + '<td>' + priceStr + '</td>'
      + '<td style="font-size:12px;color:#888;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (c.note||'') + '</td></tr>';
  }).join('') || '<tr><td colspan="7"><div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div></td></tr>';
}

function renderTimeline() {
  var groups = {};
  contracts.forEach(function(c) {
    var k = monthKey(c.endDate);
    if (!groups[k]) groups[k] = [];
    groups[k].push(c);
  });
  var el = document.getElementById('timeline-content');
  if (!el) return;
  el.innerHTML = Object.keys(groups).sort().map(function(k) {
    var items = groups[k].sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });
    var chips = items.map(function(c) {
      var s = calcStatus(c);
      return '<span class="tl-chip ' + s + '" title="' + fmtDate(c.endDate) + '">' + c.name + '</span>';
    }).join('');
    return '<div class="tl-month-group"><div class="tl-month-label"><i class="ti ti-calendar-month"></i>' + monthLabel(k) + ' <span class="count-badge">' + items.length + '건</span></div><div class="tl-chips">' + chips + '</div></div>';
  }).join('') || '<div class="empty-state">데이터가 없어요</div>';
}

// ── 계약 히스토리 ──────────────────────────
function renderHistory() {
  var q = (document.getElementById('hist-search') ? document.getElementById('hist-search').value : '').toLowerCase();
  var items = history.filter(function(h) { return !q || h.name.toLowerCase().includes(q); });
  var el = document.getElementById('history-content');
  if (!el) return;
  el.innerHTML = items.map(function(h) {
    var records = (h.records||[]).map(function(r,i) {
      return '<div class="hist-record"><div><span class="hist-round">' + (i===0?'최초':i+'차 갱신') + '</span>'
        + '<div class="text-sm text-muted mt-1">' + (r.startDate?fmtDate(r.startDate):'-') + ' ~ ' + (r.endDate?fmtDate(r.endDate):'-') + '</div>'
        + (r.note?'<div class="text-sm text-muted">'+r.note+'</div>':'')
        + '</div><div style="text-align:right;font-weight:500;">' + (r.price?Number(r.price).toLocaleString()+'원/식':'관리비제') + '</div></div>';
    }).join('');
    return '<div class="card"><div class="card-header"><span class="card-title"><i class="ti ti-building"></i>' + h.name + '</span>'
      + '<span class="count-badge">총 ' + (h.records?h.records.length:0) + '회</span></div>'
      + '<div class="card-body">' + records + '</div></div>';
  }).join('') || '<div class="empty-state"><i class="ti ti-history"></i>히스토리가 없어요</div>';
}

// ── 관리자 수정 ──────────────────────────
function renderAdmin() {
  var q = (document.getElementById('admin-search') ? document.getElementById('admin-search').value : '').toLowerCase();
  var rows = contracts.filter(function(c) { return !q || c.name.toLowerCase().includes(q); })
    .sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });
  var el = document.getElementById('admin-count');
  if (el) el.textContent = rows.length + '건';
  var tbody = document.getElementById('admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(function(c) {
    var s = calcStatus(c);
    var d = dDiff(c.endDate);
    var priceStr = c.price ? (Number(c.price).toLocaleString()+'원') : '관리비제';
    return '<tr onclick="openEditModal(\'' + c.id + '\')">'
      + '<td><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></td>'
      + '<td style="font-weight:500;">' + c.name + '</td>'
      + '<td>' + fmtDate(c.endDate) + '</td>'
      + '<td style="font-size:12px;font-weight:500;color:' + (s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':'#888') + ';">' + dDayLabel(d) + '</td>'
      + '<td>' + priceStr + '</td>'
      + '<td onclick="event.stopPropagation()"><button class="btn sm danger" onclick="handleDelete(\'' + c.id + '\',\'' + c.name.replace(/'/g,'') + '\')"><i class="ti ti-trash"></i></button></td></tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state">검색 결과가 없어요</div></td></tr>';
}

// ── 모달 ──────────────────────────
window.openAddModal = function() {
  editingId = null;
  document.getElementById('modal-title').textContent = '계약 추가';
  document.getElementById('contract-form').reset();
  document.getElementById('modal-overlay').classList.add('open');
};

window.openEditModal = function(id) {
  var c = contracts.find(function(x) { return x.id === id; });
  if (!c) return;
  editingId = id;
  document.getElementById('modal-title').textContent = '계약 수정 — ' + c.name;
  document.getElementById('f-name').value = c.name||'';
  document.getElementById('f-location').value = c.location||'';
  document.getElementById('f-contactName').value = c.contactName||'';
  document.getElementById('f-contactPhone').value = c.contactPhone||'';
  document.getElementById('f-tel').value = c.tel||'';
  document.getElementById('f-startDate').value = toInputDate(c.startDate);
  document.getElementById('f-endDate').value = toInputDate(c.endDate);
  document.getElementById('f-price').value = c.price||'';
  document.getElementById('f-priceType').value = c.priceType||'per-meal';
  document.getElementById('f-autoRenew').value = c.autoRenew ? 'true' : 'false';
  document.getElementById('f-note').value = c.note||'';
  document.getElementById('modal-overlay').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
};

window.saveContract = async function() {
  var name = document.getElementById('f-name').value.trim();
  var endDate = document.getElementById('f-endDate').value;
  if (!name || !endDate) { showToast('사업장명과 종료일은 필수입니다.'); return; }
  var data = {
    name: name, location: document.getElementById('f-location').value.trim(),
    contactName: document.getElementById('f-contactName').value.trim(),
    contactPhone: document.getElementById('f-contactPhone').value.trim(),
    tel: document.getElementById('f-tel').value.trim(),
    startDate: document.getElementById('f-startDate').value, endDate: endDate,
    price: parseInt(document.getElementById('f-price').value)||0,
    priceType: document.getElementById('f-priceType').value,
    autoRenew: document.getElementById('f-autoRenew').value === 'true',
    note: document.getElementById('f-note').value.trim(),
  };
  try {
    if (editingId) {
      await updateContract(editingId, data);
      await addHistory(editingId, name, { startDate: data.startDate, endDate: data.endDate, price: data.price, note: data.note, updatedAt: new Date().toISOString() });
      showToast('수정되었습니다.');
    } else {
      var ref = await addContract(data);
      await addHistory(ref.id, name, { startDate: data.startDate, endDate: data.endDate, price: data.price, note: data.note, updatedAt: new Date().toISOString() });
      showToast('추가되었습니다.');
    }
    closeModal();
    renderAdmin();
  } catch(e) { console.error(e); showToast('저장 중 오류가 발생했습니다.'); }
};

window.handleDelete = async function(id, name) {
  if (!confirm(name + ' 계약을 삭제할까요?')) return;
  try {
    await deleteContract(id);
    showToast(name + ' 삭제되었습니다.');
    renderAdmin();
  } catch(e) { showToast('삭제 중 오류가 발생했습니다.'); }
};

window.exportExcel = function() {
  if (!window.XLSX) { showToast('잠시 후 다시 시도해 주세요.'); return; }
  var rows = [['번호','사업장','소재지','담당자','연락처','시작일','종료일','D-day','단가','자동연장','상태','비고']];
  contracts.slice().sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); }).forEach(function(c) {
    var s = calcStatus(c);
    rows.push([c.no||'', c.name, c.location||'', c.contactName||'', c.contactPhone||'', fmtDate(c.startDate), fmtDate(c.endDate), dDiff(c.endDate), c.price||'관리비제', c.autoRenew?'자동연장':'', STATUS_META[s].label, c.note||'']);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '계약현황');
  XLSX.writeFile(wb, '재계약현황_' + new Date().toISOString().slice(0,10) + '.xlsx');
  showToast('엑셀 저장되었습니다.');
};

function showToast(msg) {
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 2800);
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeModal();
});
window.login = async function() {
  try {
    await loginWithGoogle();
  } catch (e) {
    console.error(e);
    alert('로그인 실패');
  }
};

window.logoutUser = async function() {
  await logout();
};
