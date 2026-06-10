import { listenContracts, listenHistory, addContract, updateContract, deleteContract, addHistory, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, monthKey, monthLabel, dDiff, dDayLabel } from './utils.js';

let contracts = [];
let history = [];
let currentPage = 'dashboard';
let editingId = null;

async function init() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  await seedIfEmpty();
  listenContracts(data => {
    contracts = data;
    renderCurrentPage();
  });
  listenHistory(data => {
    history = data;
    if (currentPage === 'history') renderHistory();
  });
  showPage('dashboard');
}

init();

window.showPage = function(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.style.display = el.id === 'page-' + page ? 'block' : 'none';
  });
  var titles = { dashboard: '대시보드', contracts: '계약 목록', timeline: '타임라인', history: '계약 히스토리' };
  document.getElementById('page-title').textContent = titles[page] || '';
  renderCurrentPage();
};

function renderCurrentPage() {
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'contracts') renderContractTable();
  if (currentPage === 'timeline') renderTimeline();
  if (currentPage === 'history') renderHistory();
}

function renderDashboard() {
  var counts = { total: contracts.length, urgent: 0, near: 0, ok: 0, auto: 0 };
  contracts.forEach(function(c) {
    var s = calcStatus(c);
    if (s === 'auto') counts.auto++;
    else if (s === 'urgent') counts.urgent++;
    else if (s === 'near') counts.near++;
    else counts.ok++;
  });
  document.getElementById('stat-total').textContent = counts.total;
  document.getElementById('stat-auto').textContent = counts.auto;
  document.getElementById('stat-urgent').textContent = counts.urgent;
  document.getElementById('stat-near').textContent = counts.near;
  document.getElementById('stat-ok').textContent = counts.ok;

  var urgentList = contracts.filter(function(c) { return calcStatus(c) === 'urgent'; }).sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });
  var autoList = contracts.filter(function(c) { return calcStatus(c) === 'auto'; }).sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });

  document.getElementById('dash-urgent-list').innerHTML = urgentList.length
    ? urgentList.map(function(c) { return dashMiniRow(c, false); }).join('')
    : '<div class="empty-state"><i class="ti ti-circle-check"></i>긴급 사업장이 없어요</div>';

  document.getElementById('dash-auto-list').innerHTML = autoList.length
    ? autoList.map(function(c) { return dashMiniRow(c, true); }).join('')
    : '<div class="empty-state"><i class="ti ti-circle-check"></i>자동연장 중인 사업장이 없어요</div>';

  var now = new Date();
  var thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var nextMonthStart = new Date(now.getFullYear(), now.getMonth()+1, 1);
  var thisMonth = contracts.filter(function(c) {
    var e = new Date(c.endDate);
    return e >= thisMonthStart && e < nextMonthStart;
  }).sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });

  document.getElementById('dash-thismonth-list').innerHTML = thisMonth.length
    ? thisMonth.map(function(c) {
        var s = calcStatus(c);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #f0f0ec;">'
          + '<div><div style="font-weight:500;">' + c.name + '</div>'
          + '<div class="text-sm text-muted">' + (c.contactPhone||'') + '</div></div>'
          + '<div style="text-align:right;"><span class="badge ' + s + '">' + STATUS_META[s].label + '</span>'
          + '<div class="text-sm text-muted mt-1">' + fmtDate(c.endDate) + '</div></div></div>';
      }).join('')
    : '<div class="empty-state">이번 달 만료 계약이 없어요</div>';
}

function dashMiniRow(c, isAuto) {
  var d = dDiff(c.endDate);
  var dLabel = d < 0 ? ('만료 ' + Math.abs(d) + '일 경과') : ('D-' + d);
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #f0f0ec;cursor:pointer;" onclick="showPage(\'contracts\')">'
    + '<div><div style="font-weight:500;">' + c.name + '</div>'
    + '<div class="text-sm text-muted">' + (c.contactName||'') + ' ' + (c.contactPhone||'') + '</div></div>'
    + '<div style="text-align:right;"><div style="font-size:13px;font-weight:500;color:' + (isAuto ? '#185FA5' : '#A32D2D') + ';">' + dLabel + '</div>'
    + '<div class="text-sm text-muted">' + fmtDate(c.endDate) + '</div></div></div>';
}

function renderContractTable() {
  var q = (document.getElementById('search-input') ? document.getElementById('search-input').value : '').toLowerCase();
  var fs = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
  var fa = document.getElementById('filter-auto') ? document.getElementById('filter-auto').value : '';
  var rows = contracts.filter(function(c) {
    var s = calcStatus(c);
    if (q && !c.name.toLowerCase().includes(q) && !(c.location||'').toLowerCase().includes(q)) return false;
    if (fs && s !== fs) return false;
    if (fa === 'y' && !c.autoRenew) return false;
    if (fa === 'n' && c.autoRenew) return false;
    return true;
  }).sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });

  var el = document.getElementById('count-label');
  if (el) el.textContent = rows.length + '건';

  var tbody = document.getElementById('contract-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(function(c) {
    var s = calcStatus(c);
    var d = dDiff(c.endDate);
    var barW = Math.max(4, Math.round(Math.max(0, 1-Math.min(Math.max(d,0),400)/400)*72));
    var barColor = s==='urgent' ? '#E24B4A' : s==='auto' ? '#378ADD' : s==='near' ? '#EF9F27' : '#97C459';
    var priceStr = c.price ? (Number(c.price).toLocaleString() + '원') : '관리비제';
    var autoBadge = c.autoRenew ? '<span class="badge auto"><i class="ti ti-refresh"></i> 자동</span>' : '';
    return '<tr onclick="openEditModal(\'' + c.id + '\')">'
      + '<td><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></td>'
      + '<td style="font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + c.name + '</td>'
      + '<td class="text-muted text-sm">' + (c.location||'-') + '</td>'
      + '<td>' + fmtDate(c.endDate) + '</td>'
      + '<td><div class="dday-wrap"><div class="dday-bar" style="width:' + barW + 'px;background:' + barColor + ';"></div>'
      + '<span class="dday-label ' + s + '">' + dDayLabel(d) + '</span></div></td>'
      + '<td>' + autoBadge + '</td>'
      + '<td>' + priceStr + '</td>'
      + '<td class="text-sm text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (c.note||'') + '</td>'
      + '<td onclick="event.stopPropagation()"><button class="btn sm danger" onclick="handleDelete(\'' + c.id + '\',\'' + c.name.replace(/'/g,'') + '\')"><i class="ti ti-trash"></i></button></td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9"><div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div></td></tr>';
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
      return '<span class="tl-chip ' + s + '" onclick="openEditModal(\'' + c.id + '\')" title="' + fmtDate(c.endDate) + '">' + c.name + '</span>';
    }).join('');
    return '<div class="tl-month-group"><div class="tl-month-label"><i class="ti ti-calendar-month"></i>' + monthLabel(k) + '<span class="count-badge">' + items.length + '건</span></div><div class="tl-chips">' + chips + '</div></div>';
  }).join('') || '<div class="empty-state"><i class="ti ti-calendar"></i>계약 데이터가 없어요</div>';
}

function renderHistory() {
  var q = (document.getElementById('hist-search') ? document.getElementById('hist-search').value : '').toLowerCase();
  var items = history.filter(function(h) { return !q || h.name.toLowerCase().includes(q); });
  var el = document.getElementById('history-content');
  if (!el) return;
  el.innerHTML = items.map(function(h) {
    var records = (h.records||[]).map(function(r,i) {
      return '<div class="hist-record">'
        + '<div><span class="hist-round">' + (i===0 ? '최초' : i+'차 갱신') + '</span>'
        + '<div class="text-sm text-muted mt-1">' + (r.startDate ? fmtDate(r.startDate) : '-') + ' ~ ' + (r.endDate ? fmtDate(r.endDate) : '-') + '</div>'
        + (r.note ? '<div class="text-sm text-muted">' + r.note + '</div>' : '')
        + '</div><div style="text-align:right;"><div style="font-weight:500;">' + (r.price ? Number(r.price).toLocaleString()+'원/식' : '관리비제') + '</div></div></div>';
    }).join('');
    return '<div class="card" style="margin-bottom:12px;">'
      + '<div class="card-header"><span class="card-title"><i class="ti ti-building"></i>' + h.name + '</span>'
      + '<span class="count-badge">총 ' + (h.records ? h.records.length : 0) + '회</span></div>'
      + '<div class="card-body">' + records + '</div></div>';
  }).join('') || '<div class="empty-state"><i class="ti ti-history"></i>히스토리가 없어요</div>';
}

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
  document.getElementById('modal-title').textContent = '계약 수정';
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
    name: name,
    location: document.getElementById('f-location').value.trim(),
    contactName: document.getElementById('f-contactName').value.trim(),
    contactPhone: document.getElementById('f-contactPhone').value.trim(),
    tel: document.getElementById('f-tel').value.trim(),
    startDate: document.getElementById('f-startDate').value,
    endDate: endDate,
    price: parseInt(document.getElementById('f-price').value)||0,
    priceType: document.getElementById('f-priceType').value,
    autoRenew: document.getElementById('f-autoRenew').value === 'true',
    note: document.getElementById('f-note').value.trim(),
  };
  try {
    if (editingId) {
      await updateContract(editingId, data);
      await addHistory(editingId, name, { startDate: data.startDate, endDate: data.endDate, price: data.price, note: data.note, updatedAt: new Date().toISOString() });
      showToast('계약이 수정되었습니다.');
    } else {
      var ref = await addContract(data);
      await addHistory(ref.id, name, { startDate: data.startDate, endDate: data.endDate, price: data.price, note: data.note, updatedAt: new Date().toISOString() });
      showToast('계약이 추가되었습니다.');
    }
    closeModal();
  } catch(e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.');
  }
};

window.handleDelete = async function(id, name) {
  if (!confirm(name + ' 계약을 삭제할까요?')) return;
  try {
    await deleteContract(id);
    showToast(name + ' 계약이 삭제되었습니다.');
  } catch(e) {
    showToast('삭제 중 오류가 발생했습니다.');
  }
};

window.exportExcel = function() {
  if (!window.XLSX) { showToast('잠시 후 다시 시도해 주세요.'); return; }
  var rows = [['번호','사업장','소재지','담당자','연락처','시작일','종료일','D-day','단가','자동연장','상태','비고']];
  contracts.slice().sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); }).forEach(function(c) {
    var s = calcStatus(c);
    rows.push([c.no||'', c.name, c.location||'', c.contactName||'', c.contactPhone||'', fmtDate(c.startDate), fmtDate(c.endDate), dDiff(c.endDate), c.price||'관리비제', c.autoRenew ? '자동연장' : '', STATUS_META[s].label, c.note||'']);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '계약현황');
  XLSX.writeFile(wb, '재계약현황_' + new Date().toISOString().slice(0,10) + '.xlsx');
  showToast('엑셀 파일이 저장되었습니다.');
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
