import { listenContracts, listenHistory, addContract, updateContract, deleteContract, addHistory, seedIfEmpty } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, monthKey, monthLabel, dDiff, dDayLabel } from './utils.js';

var contracts = [];
var history = [];
var editingId = null;

async function init() {
  await seedIfEmpty();
  listenContracts(function(data) {
    contracts = data;
  });
  listenHistory(function(data) {
    history = data;
  });
}

init();

window.goHome = function() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('home-screen').style.display = 'flex';
};

window.goPage = function(page) {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  document.querySelectorAll('#app .page-body, #app > div[id^="page-"]').forEach(function(el) {
    el.style.display = 'none';
  });

  var titles = {
    businesses: '거래처 정보',
    contracts: '현재 계약현황',
    history: '계약 히스토리',
    admin: '관리자 수정'
  };
  document.getElementById('page-title').textContent = titles[page] || '';

  var actions = document.getElementById('top-actions');
  actions.innerHTML = '';

  if (page === 'admin') {
    actions.innerHTML = '<button class="btn primary" onclick="openAddModal()"><i class="ti ti-plus"></i> 계약 추가</button>'
      + '<button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀 저장</button>';
  }
  if (page === 'contracts') {
    actions.innerHTML = '<button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀 저장</button>';
  }

  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.style.display = 'block';

  if (page === 'businesses') renderBusinesses();
  if (page === 'contracts') { renderContractTable(); renderTimeline(); }
  if (page === 'history') renderHistory();
  if (page === 'admin') renderAdmin();
};

// ── 거래처 정보 ──────────────────────────
function renderBusinesses() {
  var q = (document.getElementById('biz-search') ? document.getElementById('biz-search').value : '').toLowerCase();
  var list = contracts.filter(function(c) {
    return !q || c.name.toLowerCase().includes(q) || (c.location||'').toLowerCase().includes(q);
  }).sort(function(a,b) { return a.name.localeCompare(b.name); });

  var el = document.getElementById('biz-list');
  if (!el) return;
  el.innerHTML = list.map(function(c) {
    var s = calcStatus(c);
    return '<div class="biz-card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
      + '<div class="biz-name">' + c.name + '</div>'
      + '<span class="badge ' + s + '">' + STATUS_META[s].label + '</span></div>'
      + '<div class="biz-info">'
      + (c.location ? '<span><i class="ti ti-map-pin"></i> ' + c.location + '</span>' : '')
      + (c.contactName ? '<span><i class="ti ti-user"></i> ' + c.contactName + '</span>' : '')
      + (c.contactPhone ? '<span><i class="ti ti-phone"></i> ' + c.contactPhone + '</span>' : '')
      + (c.tel ? '<span><i class="ti ti-device-landline"></i> ' + c.tel + '</span>' : '')
      + '</div>'
      + (c.note ? '<div style="font-size:12px;color:#aaa;margin-top:6px;">' + c.note + '</div>' : '')
      + '</div>';
  }).join('') || '<div class="empty-state"><i class="ti ti-building"></i>데이터가 없어요</div>';
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
    return '<tr>'
      + '<td><span class="badge ' + s + '">' + STATUS_META[s].label + '</span></td>'
      + '<td style="font-weight:500;">' + c.name + '</td>'
      + '<td>' + fmtDate(c.endDate) + '</td>'
      + '<td><div class="dday-wrap"><div class="dday-bar" style="width:' + barW + 'px;background:' + barColor + ';"></div>'
      + '<span style="font-size:12px;color:' + barColor + ';font-weight:500;">' + dDayLabel(d) + '</span></div></td>'
      + '<td>' + autoBadge + '</td>'
      + '<td>' + priceStr + '</td>'
      + '<td style="font-size:12px;color:#888;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (c.note||'') + '</td>'
      + '</tr>';
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
    return '<div class="tl-month-group">'
      + '<div class="tl-month-label"><i class="ti ti-calendar-month"></i>' + monthLabel(k)
      + ' <span class="count-badge">' + items.length + '건</span></div>'
      + '<div class="tl-chips">' + chips + '</div></div>';
  }).join('') || '<div class="empty-state"><i class="ti ti-calendar"></i>데이터가 없어요</div>';
}

// ── 계약 히스토리 ──────────────────────────
function renderHistory() {
  var q = (document.getElementById('hist-search') ? document.getElementById('hist-search').value : '').toLowerCase();
  var items = history.filter(function(h) { return !q || h.name.toLowerCase().includes(q); });
  var el = document.getElementById('history-content');
  if (!el) return;
  el.innerHTML = items.map(function(h) {
    var records = (h.records||[]).map(function(r,i) {
      return '<div class="hist-record">'
        + '<div><span class="hist-round">' + (i===0?'최초':i+'차 갱신') + '</span>'
        + '<div class="text-sm text-muted mt-1">' + (r.startDate?fmtDate(r.startDate):'-') + ' ~ ' + (r.endDate?fmtDate(r.endDate):'-') + '</div>'
        + (r.note ? '<div class="text-sm text-muted">' + r.note + '</div>' : '')
        + '</div><div style="text-align:right;font-weight:500;">' + (r.price?Number(r.price).toLocaleString()+'원/식':'관리비제') + '</div></div>';
    }).join('');
    return '<div class="card">'
      + '<div class="card-header"><span class="card-title"><i class="ti ti-building"></i>' + h.name + '</span>'
      + '<span class="count-badge">총 ' + (h.records?h.records.length:0) + '회</span></div>'
      + '<div class="card-body">' + records + '</div></div>';
  }).join('') || '<div class="empty-state"><i class="ti ti-history"></i>히스토리가 없어요</div>';
}

// ── 관리자 수정 ──────────────────────────
function renderAdmin() {
  var q = (document.getElementById('admin-search') ? document.getElementById('admin-search').value : '').toLowerCase();
  var rows = contracts.filter(function(c) {
    return !q || c.name.toLowerCase().includes(q);
  }).sort(function(a,b) { return new Date(a.endDate)-new Date(b.endDate); });

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
      + '<td onclick="event.stopPropagation()">'
      + '<button class="btn sm danger" onclick="handleDelete(\'' + c.id + '\',\'' + c.name.replace(/'/g,'') + '\')"><i class="ti ti-trash"></i></button>'
      + '</td></tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div></td></tr>';
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
      showToast('수정되었습니다.');
    } else {
      var ref = await addContract(data);
      await addHistory(ref.id, name, { startDate: data.startDate, endDate: data.endDate, price: data.price, note: data.note, updatedAt: new Date().toISOString() });
      showToast('추가되었습니다.');
    }
    closeModal();
    renderAdmin();
  } catch(e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.');
  }
};

window.handleDelete = async function(id, name) {
  if (!confirm(name + ' 계약을 삭제할까요?')) return;
  try {
    await deleteContract(id);
    showToast(name + ' 삭제되었습니다.');
    renderAdmin();
  } catch(e) {
    showToast('삭제 중 오류가 발생했습니다.');
  }
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
