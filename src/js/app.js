import { listenContracts, listenHistory, addContract, updateContract, deleteContract, addHistory, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, monthKey, monthLabel, dDiff, dDayLabel } from './utils.js';

var contracts = [];
var history = [];
var editingId = null;
var currentBizTab = 'team';
var mapInstance = null;

// ── 팀/책임 데이터 ──────────────────────────
var TEAM1 = ['그린씨알피','덕일산업','동인물산','롯데웰푸드','발렉스','보성정보통신','삼양화학공업','삼일엘리베이터','성문전자','세종알로이','솔레오','승우플라텍','신덕산업','신양물류','엠아이텍','연암','유니젠','윤지양행','지에스아이','청우코아','티엔씨','퓨어앤텍','한보일렉트','SK가스','퍼슨','다원체어스','우진티엠씨','나래산업','한미에프쓰리 1공장','한미에프쓰리 2공장','한국바이린','수퍼빈(아이엠팩토리)','비씨젠','디오토모티브','주강로보테크','피엘에스','머크','동아전기부품','에스앤지(바스노바)','미소찬','무봉산수련원','대코','동아전장','삼아알미늄','우보테크','EPS코리아'];
var TEAM2 = ['대덕농협','동천','드림메카텍','메카로','삼전순약','삼정펄프','신한전기(엠투엔)','에스아이','오뚜기 평택','오뚜기 포승','오뚜기 논산','일렉콤','코오롱 인더스트리','한양로보틱스','KC글라스','동인산업','한석시스템','쏘나브이피씨','파트라','한온시스템 아산','한온시스템 둔포','에치와이','카길 애그리 퓨리나','디이엔티 오산','한국가스공사','삼영잉크','이구산업','진보','지푸드','대한송유관공사','비와이티','대성아이앤지','진성티이씨 1, 2공장','린데코리아','신세대여행사','두손'];

var RESP_MAP = {
  '손도란 대리': ['그린씨알피','SK가스','연암','유니젠','윤지양행','동아전기부품','롯데웰푸드','한국바이린','동천','메카로','삼전순약','삼정펄프','신한전기(엠투엔)','코오롱 인더스트리','KC글라스','파트라','한온시스템 아산','한온시스템 둔포','한국가스공사','대덕농협','두손'],
  '이소영 주임': ['삼아알미늄','청우코아','퓨어앤텍','한보일렉트','디오토모티브','피엘에스','머크','EPS코리아','에스아이','오뚜기 평택','오뚜기 포승','오뚜기 논산','쏘나브이피씨','비와이티','드림메카텍','대성아이앤지','지푸드','디이엔티 오산'],
  '김상준 주임': ['동인물산','보성정보통신','삼양화학공업','세종알로이','나래산업','우진티엠씨','수퍼빈(아이엠팩토리)','비씨젠','주강로보테크','동아전장','에스앤지(바스노바)','대코','승우플라텍','솔레오','한석시스템','에치와이','카길 애그리 퓨리나','삼영잉크','대한송유관공사','신세대여행사'],
  '견병록 매니저': ['미소찬','발렉스','성문전자','신덕산업','지에스아이','티엔씨','퍼슨','다원체어스','무봉산수련원','덕일산업','삼일엘리베이터','엠아이텍','우보테크','일렉콤','동인산업','이구산업','진보','린데코리아','한양로보틱스','진성티이씨 1, 2공장'],
};

// ── 사업장 좌표 + 주소 데이터 ──────────────────────────
var BIZ_DATA = {
  '그린씨알피':       { lat:37.0234, lng:127.2156, addr:'안성시 고삼면 군내길 22-65', team:1 },
  '덕일산업':         { lat:36.9987, lng:127.1123, addr:'평택시 세교산단로 21-20', team:1 },
  '동인물산':         { lat:36.9876, lng:126.9234, addr:'평택시 청북읍 청북로 222', team:1 },
  '롯데웰푸드':       { lat:37.1456, lng:126.9876, addr:'화성시 정남면 괘랑1길 42-27', team:1 },
  '발렉스':           { lat:36.9912, lng:126.9145, addr:'평택시 청북읍 한산길 32', team:1 },
  '보성정보통신':     { lat:36.9634, lng:127.0234, addr:'평택시 팽성읍 추팔산단로 63', team:1 },
  '삼양화학공업':     { lat:36.1234, lng:127.7845, addr:'충북 영동군 매곡면 수원동길 32-40', team:1 },
  '삼일엘리베이터':   { lat:36.6012, lng:126.6634, addr:'충남 홍성 내포첨단산단3길 32', team:1 },
  '성문전자':         { lat:37.0056, lng:127.1067, addr:'평택시 세교동 세교산단로 61', team:1 },
  '세종알로이':       { lat:37.0912, lng:126.9234, addr:'화성시 양감면 사격장길 95', team:1 },
  '솔레오':           { lat:37.0123, lng:127.0912, addr:'평택시 산단로 24', team:1 },
  '승우플라텍':       { lat:37.1789, lng:127.2234, addr:'용인시 처인구 남사읍 당하로 47', team:1 },
  '신덕산업':         { lat:36.8234, lng:127.0567, addr:'아산시 둔포면 윤보선로336번길 55-22', team:1 },
  '신양물류':         { lat:36.9745, lng:126.8912, addr:'평택시 포승읍 평택항만길 255', team:1 },
  '엠아이텍':         { lat:37.0234, lng:127.0456, addr:'평택시 진위면 하북2길 174', team:1 },
  '연암':             { lat:36.7834, lng:127.1234, addr:'천안시 서북구 성거읍 모전1길 172', team:1 },
  '유니젠':           { lat:37.0567, lng:127.0234, addr:'평택시 서탄면 수월암리 126', team:1 },
  '윤지양행':         { lat:37.1523, lng:127.0712, addr:'오산시 가장산업서북로 23', team:1 },
  '지에스아이':       { lat:36.8156, lng:127.0634, addr:'아산시 둔포면 아산밸리동로 194', team:1 },
  '청우코아':         { lat:36.9834, lng:126.9312, addr:'평택시 청북읍 토진3길 80-8', team:1 },
  '티엔씨':           { lat:36.8312, lng:127.0512, addr:'아산시 둔포면 아산밸리로 304-29', team:1 },
  '퓨어앤텍':         { lat:37.1345, lng:126.9567, addr:'화성시 정남면 정남산단로 11', team:1 },
  '한보일렉트':       { lat:37.0912, lng:126.9123, addr:'화성시 양감면 초록로 706', team:1 },
  'SK가스':           { lat:36.9623, lng:126.8834, addr:'평택시 포승읍 원정리 1009-1', team:1 },
  '퍼슨':             { lat:36.8012, lng:127.1345, addr:'천안시 서북구 백석공단1로 47', team:1 },
  '다원체어스':       { lat:37.6234, lng:127.3456, addr:'남양주시 수동면 소래비로 474-16', team:1 },
  '우진티엠씨':       { lat:37.5234, lng:126.6789, addr:'인천광역시 서구 원전로 16', team:1 },
  '나래산업':         { lat:36.9923, lng:126.9234, addr:'평택시 청북읍 광승길 159-47', team:1 },
  '한미에프쓰리 1공장':{ lat:36.8234, lng:127.0423, addr:'아산시 둔포면 충무로 1342', team:1 },
  '한미에프쓰리 2공장':{ lat:36.8123, lng:127.0156, addr:'아산시 음봉면 원남리 9-1', team:1 },
  '한국바이린':       { lat:36.9312, lng:127.0056, addr:'평택시 오성면 청오로 367-61', team:1 },
  '수퍼빈(아이엠팩토리)':{ lat:37.1712, lng:126.8234, addr:'화성시 우정읍 화산리 364-24', team:1 },
  '비씨젠':           { lat:37.3234, lng:126.8234, addr:'안산시 단원구 별망로128번길 41', team:1 },
  '디오토모티브':     { lat:36.8256, lng:127.0312, addr:'아산시 둔포면 신항리 215-1', team:1 },
  '주강로보테크':     { lat:36.9934, lng:126.9178, addr:'평택시 청북읍 광승길 72-3', team:1 },
  '피엘에스':         { lat:36.9678, lng:126.8923, addr:'평택시 포승읍 서동대로 437-158', team:1 },
  '머크':             { lat:36.9612, lng:126.8856, addr:'평택시 포승읍 원정리 1173-2', team:1 },
  '동아전기부품':     { lat:37.2123, lng:127.0812, addr:'화성시 동탄천로 31', team:1 },
  '에스앤지(바스노바)':{ lat:37.2034, lng:127.2234, addr:'용인시 처인구 포곡읍 부곡로 82', team:1 },
  '미소찬':           { lat:36.7923, lng:127.1523, addr:'천안시 서북구 입장면 성진로 643', team:1 },
  '무봉산수련원':     { lat:37.0156, lng:127.0634, addr:'평택시 진위면 진위로 181-94', team:1 },
  '대코':             { lat:37.3745, lng:126.7834, addr:'시흥시 공단1대로196번길 37', team:1 },
  '동아전장':         { lat:36.9234, lng:127.6234, addr:'음성군 감곡면 대학길 247-20', team:1 },
  '삼아알미늄':       { lat:36.9534, lng:126.8767, addr:'평택시 포승읍 평택항로 92', team:1 },
  '우보테크':         { lat:36.9845, lng:126.9056, addr:'평택시 청북읍 양교1길 134', team:1 },
  'EPS코리아':        { lat:36.9567, lng:126.8912, addr:'평택시 포승읍 평택항로 294', team:1 },
  '대덕농협':         { lat:37.0456, lng:127.2345, addr:'안성시 대덕면 서동대로 4670', team:2 },
  '동천':             { lat:36.9456, lng:127.0123, addr:'평택시 오성면 오성북로 145', team:2 },
  '드림메카텍':       { lat:37.1234, lng:126.9634, addr:'화성시 정남면 정남산단로 41', team:2 },
  '메카로':           { lat:37.0067, lng:127.0834, addr:'평택시 산단로 103-14', team:2 },
  '삼전순약':         { lat:37.0089, lng:127.0956, addr:'평택시 산단로16번길 117', team:2 },
  '삼정펄프':         { lat:36.7534, lng:127.2234, addr:'천안시 동남구 풍세면 잔다리길 48', team:2 },
  '신한전기(엠투엔)': { lat:37.2234, lng:127.0634, addr:'화성시 동탄산단2길 7-21', team:2 },
  '에스아이':         { lat:37.1156, lng:126.9712, addr:'화성시 정남면 정남산단1길 13', team:2 },
  '오뚜기 평택':      { lat:37.0345, lng:127.0523, addr:'평택시 진위면 가곡4길 60', team:2 },
  '오뚜기 포승':      { lat:36.9689, lng:126.8834, addr:'평택시 포승읍 포승공단로 2', team:2 },
  '오뚜기 논산':      { lat:36.1956, lng:127.0834, addr:'논산시 은진면 관촉로 58번길 138', team:2 },
  '일렉콤':           { lat:37.2834, lng:127.4523, addr:'이천시 마장면 덕이로 202번길 99', team:2 },
  '코오롱 인더스트리':{ lat:37.2045, lng:127.0923, addr:'화성시 동탄산단10길 74', team:2 },
  '한양로보틱스':     { lat:36.5934, lng:126.6623, addr:'홍성군 홍북읍 첨단산단5길 175', team:2 },
  'KC글라스':         { lat:36.8434, lng:127.2123, addr:'천안시 서북구 입장면 도림리 330', team:2 },
  '동인산업':         { lat:36.6834, lng:127.4923, addr:'청주시 청원구 오창읍 두릉1길 16', team:2 },
  '한석시스템':       { lat:37.1923, lng:127.3034, addr:'용인시 처인구 백암면 고안로 51번길 34', team:2 },
  '쏘나브이피씨':     { lat:37.1612, lng:126.8156, addr:'화성시 우정읍 배미능골길 112-37', team:2 },
  '파트라':           { lat:37.1745, lng:127.2123, addr:'용인시 처인구 남사읍 완장천로 118-22', team:2 },
  '한온시스템 아산':  { lat:36.8312, lng:127.0423, addr:'아산시 둔포면 아산밸리서로 20', team:2 },
  '한온시스템 둔포':  { lat:36.8234, lng:127.0345, addr:'아산시 둔포면 관대길 90-14', team:2 },
  '에치와이':         { lat:37.0256, lng:127.0512, addr:'평택시 진위면 동부대로 2', team:2 },
  '카길 애그리 퓨리나':{ lat:36.9734, lng:126.8856, addr:'평택시 포승읍 평택항안로 45', team:2 },
  '디이엔티 오산':    { lat:37.1434, lng:127.0623, addr:'오산시 가장산업서북로 40-56', team:2 },
  '한국가스공사':     { lat:36.9656, lng:126.8778, addr:'평택시 포승읍 남양만로 175-88', team:2 },
  '삼영잉크':         { lat:36.9578, lng:126.8834, addr:'평택시 포승읍 내기리 679-13', team:2 },
  '이구산업':         { lat:36.9612, lng:126.8901, addr:'평택시 포승읍 포승공단로 42', team:2 },
  '진보':             { lat:37.0123, lng:127.0678, addr:'평택시 모곡동 438-3', team:2 },
  '지푸드':           { lat:36.9956, lng:126.9234, addr:'평택시 청북읍 토진리 349-22', team:2 },
  '대한송유관공사':   { lat:37.3834, lng:127.1134, addr:'성남시 분당구 안양판교로828번길 201', team:2 },
  '비와이티':         { lat:36.9545, lng:126.8823, addr:'평택시 포승읍 석정리 895-1', team:2 },
  '대성아이앤지':     { lat:36.9923, lng:126.9156, addr:'평택시 청북읍 한산리 879-3', team:2 },
  '진성티이씨 1, 2공장':{ lat:37.0023, lng:127.1034, addr:'평택시 세교산단로 3', team:2 },
  '린데코리아':       { lat:37.0634, lng:127.1423, addr:'평택시 고덕면 여염리 1673', team:2 },
  '신세대여행사':     { lat:37.2634, lng:126.9834, addr:'수원시 권선구 서수원로 19', team:2 },
  '두손':             { lat:37.0156, lng:127.2534, addr:'안성시 미양면 개정산업단지1로 69', team:2 },
};

async function init() {
  await seedIfEmpty();
  listenContracts(function(data) { contracts = data; });
  listenHistory(function(data) { history = data; });
}
init();

window.goHome = function() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('home-screen').style.display = 'flex';
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
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
  if (page === 'businesses') { currentBizTab = 'team'; setTabActive(0); renderBizTab(); }
  if (page === 'contracts') { renderContractTable(); renderTimeline(); }
  if (page === 'history') renderHistory();
  if (page === 'admin') renderAdmin();
};

// ── 거래처 탭 ──────────────────────────
window.setBizTab = function(tab) {
  currentBizTab = tab;
  var idx = { team:0, region:1, resp:2 };
  setTabActive(idx[tab] || 0);
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  renderBizTab();
};

function setTabActive(idx) {
  document.querySelectorAll('.tab-btn').forEach(function(btn, i) {
    btn.classList.toggle('active', i === idx);
  });
}

window.renderBizTab = function() {
  var q = (document.getElementById('biz-search') ? document.getElementById('biz-search').value : '').toLowerCase();
  var el = document.getElementById('biz-content');
  if (!el) return;

  function getBizCard(name) {
    var c = contracts.find(function(x) {
      return x.name === name || x.name.replace(/\s/g,'').includes(name.replace(/\s/g,'')) || name.replace(/\s/g,'').includes(x.name.replace(/\s/g,''));
    });
    var info = BIZ_DATA[name] || {};
    var s = c ? calcStatus(c) : 'ok';
    return '<div class="biz-card">'
      + '<div class="biz-name"><span>' + name + '</span>'
      + (c ? '<span class="badge ' + s + '">' + STATUS_META[s].label + '</span>' : '') + '</div>'
      + '<div class="biz-info">'
      + (info.addr ? '<span><i class="ti ti-map-pin"></i>' + info.addr + '</span>' : '')
      + (c && c.contactName ? '<span><i class="ti ti-user"></i>' + c.contactName + '</span>' : '')
      + (c && c.contactPhone ? '<span><i class="ti ti-phone"></i>' + c.contactPhone + '</span>' : '')
      + (c && c.tel ? '<span><i class="ti ti-device-landline"></i>' + c.tel + '</span>' : '')
      + '</div></div>';
  }

  if (currentBizTab === 'team') {
    var t1 = TEAM1.filter(function(n) { return !q || n.toLowerCase().includes(q); });
    var t2 = TEAM2.filter(function(n) { return !q || n.toLowerCase().includes(q); });
    el.innerHTML = '<div class="team-layout">'
      + '<div><div class="team-col-header"><i class="ti ti-users"></i> 1팀 — 박주형 본부장 <span style="font-size:12px;font-weight:400;margin-left:auto;">' + t1.length + '개소</span></div>'
      + t1.map(getBizCard).join('') + '</div>'
      + '<div><div class="team-col-header team2"><i class="ti ti-users"></i> 2팀 — 김재희 차장 <span style="font-size:12px;font-weight:400;margin-left:auto;">' + t2.length + '개소</span></div>'
      + t2.map(getBizCard).join('') + '</div>'
      + '</div>';

  } else if (currentBizTab === 'region') {
    el.innerHTML = '<div class="map-legend">'
      + '<span class="legend-item"><span class="legend-dot" style="background:#185FA5;"></span> 1팀</span>'
      + '<span class="legend-item"><span class="legend-dot" style="background:#3B6D11;"></span> 2팀</span>'
      + '<span class="legend-item"><span class="legend-dot" style="background:#E24B4A;"></span> 긴급</span>'
      + '<span class="legend-item"><span class="legend-dot" style="background:#EF9F27;"></span> 임박</span>'
      + '</div>'
      + '<div id="map"></div>';

    setTimeout(function() {
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
      mapInstance = L.map('map').setView([36.98, 127.05], 9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance);

      Object.keys(BIZ_DATA).forEach(function(name) {
        if (q && !name.toLowerCase().includes(q)) return;
        var info = BIZ_DATA[name];
        var c = contracts.find(function(x) {
          return x.name === name || x.name.replace(/\s/g,'').includes(name.replace(/\s/g,''));
        });
        var s = c ? calcStatus(c) : 'ok';
        var color = s === 'urgent' ? '#E24B4A' : s === 'auto' ? '#185FA5' : info.team === 1 ? '#185FA5' : '#3B6D11';
        if (s === 'near') color = '#EF9F27';

        var marker = L.circleMarker([info.lat, info.lng], {
          radius: 8,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(mapInstance);

        var dLabel = c ? dDayLabel(dDiff(c.endDate)) : '';
        var statusStr = c ? ('<br><b>' + STATUS_META[s].label + '</b> ' + dLabel) : '';
        marker.bindPopup('<b>' + name + '</b><br>' + (info.addr||'') + statusStr
          + (c && c.contactName ? '<br>' + c.contactName : '')
          + (c && c.contactPhone ? ' ' + c.contactPhone : ''));
      });
    }, 100);

  } else if (currentBizTab === 'resp') {
    var html = '';
    Object.keys(RESP_MAP).forEach(function(resp) {
      var names = RESP_MAP[resp].filter(function(n) { return !q || n.toLowerCase().includes(q); });
      if (!names.length) return;
      html += '<div class="resp-section">'
        + '<div class="resp-header"><i class="ti ti-user"></i>' + resp
        + ' <span style="font-size:12px;font-weight:400;margin-left:6px;">' + names.length + '개소</span></div>'
        + '<div class="biz-grid">' + names.map(getBizCard).join('') + '</div></div>';
    });
    el.innerHTML = html || '<div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div>';
  }
};

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
  el.innerHTML = items.length ? items.map(function(h) {
    var records = (h.records||[]).map(function(r,i) {
      return '<div class="hist-record"><div><span class="hist-round">' + (i===0?'최초':i+'차 갱신') + '</span>'
        + '<div class="text-sm text-muted mt-1">' + (r.startDate?fmtDate(r.startDate):'-') + ' ~ ' + (r.endDate?fmtDate(r.endDate):'-') + '</div>'
        + (r.note?'<div class="text-sm text-muted">'+r.note+'</div>':'')
        + '</div><div style="text-align:right;font-weight:500;">' + (r.price?Number(r.price).toLocaleString()+'원/식':'관리비제') + '</div></div>';
    }).join('');
    return '<div class="card"><div class="card-header"><span class="card-title"><i class="ti ti-building"></i>' + h.name + '</span>'
      + '<span class="count-badge">총 ' + (h.records?h.records.length:0) + '회</span></div>'
      + '<div class="card-body">' + records + '</div></div>';
  }).join('') : '<div class="empty-state"><i class="ti ti-history"></i>히스토리 데이터를 준비 중이에요<br><span style="font-size:12px;">파일을 받으면 바로 업데이트할게요</span></div>';
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
