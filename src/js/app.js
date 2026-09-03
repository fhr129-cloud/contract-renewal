import { listenContracts, listenHistory, listenSupports, addContract, updateContract, deleteContract, addHistory, addSupport, updateSupport, updateSupportBizName, deleteSupport,  saveHistoryRecords, updateHistoryName, checkAllowedUser, loginUser, registerUser, watchAuth, logoutUser, fetchAllForBackup } from './db.js';
import { calcStatus, STATUS_META, fmtDate, toInputDate, dDiff, dDayLabel, priceLabel } from './utils.js';
import { COORDS } from './coords.js';
import { STAFF_MAP, STAFF_ORDER, getStaffColor, getStaffBorderColor, getStaffBg } from './staff.js';
import { initAdmin } from './admin.js';
import { initDashboard } from './dashboard.js';

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
var supportBizFilter = '';

window.renderSupportSearch=function(val){
  var q=val.trim();
  var resultEl=document.getElementById('support-search-result');
  var countEl=document.getElementById('support-search-count');
  var calCard=document.getElementById('calendar') ? document.getElementById('calendar').closest('.card') : null;
  var supStatCard=document.getElementById('sup-stat-card');
  var calToolbar=document.getElementById('cal-toolbar-wrap');
  if(!q){
    if(resultEl){ resultEl.style.display='none'; resultEl.innerHTML=''; }
    if(countEl){ countEl.style.display='none'; countEl.textContent=''; }
    if(calCard) calCard.style.display='';
    if(calToolbar) calToolbar.style.display='flex';
    if(calToolbar) calToolbar.style.flexDirection='column';
    if(supStatCard) supStatCard.style.display='';
    var calBtns=document.getElementById('cal-toolbar-btns');
    var calViewBtns=document.getElementById('cal-view-btns');
    if(calBtns) calBtns.style.display='flex';
    if(calViewBtns) calViewBtns.style.display='flex';
    var regBtn=document.querySelector('#cal-toolbar-wrap .btn.primary');
    if(regBtn) regBtn.style.display='';
    supportBizFilter='';
    renderCalendar();
    return;
  }
  supportBizFilter=q;
  if(calCard) calCard.style.display='none';
  if(supStatCard) supStatCard.style.display='none';
  var calBtns=document.getElementById('cal-toolbar-btns');
  var calViewBtns=document.getElementById('cal-view-btns');
  var regBtn=document.querySelector('#cal-toolbar-wrap .btn.primary');
  if(calBtns) calBtns.style.display='none';
  if(calViewBtns) calViewBtns.style.display='none';
  if(regBtn) regBtn.style.display='none';
  var filtered=supports.filter(function(s){
    if(!s.type||s.type==='support'){
      if(s.bizName&&s.bizName.includes(q)) return true;
      if(s.content&&s.content.includes(q)) return true;
    }
    return false;
  }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  if(countEl){ countEl.textContent=filtered.length+'건'; countEl.style.display='inline'; }
  if(!resultEl) return;
  if(!filtered.length){
    resultEl.style.display='block';
    resultEl.innerHTML='<div class="card"><div class="card-body"><div class="empty-state"><i class="ti ti-search"></i>검색 결과가 없어요</div></div></div>';
    return;
  }
  resultEl.style.display='block';
  resultEl.innerHTML='<div class="card"><div style="padding:0 16px;">'+
    filtered.map(function(s){
      var c=contracts.find(function(x){ return x.name===s.bizName; });
      var cid=c?c.id:'';
      var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.map(function(n){ return n.split(' ')[0]; }).join(', '):(s.staffName?s.staffName.split(' ')[0]:'');
      var dateStr=s.date||'';
      if(s.dateEnd&&s.dateEnd!==s.date) dateStr+=(' ~ '+s.dateEnd.slice(5));
      var menuStr=s.content&&(s.category==='특식지원'||s.category==='이벤트')?s.content.split(' / ')[0]:'';
      return '<div class="dash-mini-item" style="padding:10px 0;align-items:flex-start;gap:10px;" '+(cid?'onclick="goDetail(\''+cid+'\')" ':'')+'>'+
        '<div style="min-width:0;flex:1;">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">'+
            '<span style="font-size:13px;font-weight:600;'+(cid?'color:#185FA5;':'')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(s.bizName||'')+'</span>'+
            '<span style="font-size:11px;color:#888;white-space:nowrap;flex-shrink:0;">'+dateStr+'</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">'+
            '<span class="badge-cat">'+(s.category||'')+'</span>'+
            (staffStr?'<span class="badge-cat '+(getStaffColor(s.staffNames&&s.staffNames.length?s.staffNames[0]:(s.staffName||'')))+'">'+(staffStr)+'</span>':'')+
            (menuStr?'<span style="font-size:11px;color:#854F0B;">'+menuStr+'</span>':'')+
            (s.content&&!menuStr?'<span style="font-size:11px;color:#888;">'+s.content+'</span>':
             s.content&&menuStr&&s.content.includes(' / ')?'<span style="font-size:11px;color:#888;">'+s.content.split(' / ').slice(1).join(' / ')+'</span>':'')+
          '</div>'+
        '</div>'+
        '<div style="flex-shrink:0;text-align:right;">'+
          '<div style="display:none;">'+dateStr+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:4px;flex-shrink:0;" onclick="event.stopPropagation();">'+
          '<button class="btn sm" onclick="closeCalPopup();editSupport(\''+s.id+'\')"><i class="ti ti-edit"></i></button>'+
          '<button class="btn sm danger" onclick="delSupportSearch(\''+s.id+'\')"><i class="ti ti-trash"></i></button>'+
        '</div>'+
      '</div>';
    }).join('')+
  '</div></div>';
};
window.delSupportSearch=async function(id){
  if(!window.guardSupportEdit(id)) return;
  if(!confirm('삭제할까요?')) return;
  try{
    await deleteSupport(id);
    showToast('삭제되었습니다.');
    var q=document.getElementById('support-biz-search').value;
    window.renderSupportSearch(q);
  } catch(e){ showToast('오류 발생'); }
};
var ssOptions = [];
var currentModalTab = 'basic';
var weekOffset = 0;
window.detailId = null;
window._typeSelectDate = null;
window._typeSelectStaff = null;

var HOLIDAYS_2025 = {
  '2025-01-01':'신정','2025-01-28':'설날 연휴','2025-01-29':'설날','2025-01-30':'설날 연휴',
  '2025-03-01':'삼일절','2025-03-03':'대체공휴일','2025-05-05':'어린이날','2025-05-06':'대체공휴일',
  '2025-05-15':'부처님오신날','2025-06-06':'현충일','2025-08-15':'광복절',
  '2025-10-03':'개천절','2025-10-05':'추석 연휴','2025-10-06':'추석','2025-10-07':'추석 연휴','2025-10-08':'대체공휴일',
  '2025-07-17':'제헌절','2025-10-09':'한글날','2025-12-25':'크리스마스'
};
var HOLIDAYS_2026 = {
  '2026-01-01':'신정','2026-02-17':'설날 연휴','2026-02-18':'설날','2026-02-19':'설날 연휴',
  '2026-03-01':'삼일절','2026-05-05':'어린이날','2026-05-24':'부처님오신날',
  '2026-06-06':'현충일','2026-08-15':'광복절','2026-08-17':'대체공휴일',
  '2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴',
  '2026-07-17':'제헌절','2026-10-03':'개천절','2026-10-09':'한글날','2026-12-25':'크리스마스'
};
var HOLIDAYS_2027 = {
  '2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날','2027-02-08':'설날 연휴',
  '2027-03-01':'삼일절','2027-05-05':'어린이날','2027-05-13':'부처님오신날',
  '2027-06-06':'현충일','2027-07-17':'제헌절','2027-08-15':'광복절','2027-08-16':'대체공휴일',
  '2027-09-14':'추석 연휴','2027-09-15':'추석','2027-09-16':'추석 연휴',
  '2027-10-03':'개천절','2027-10-04':'대체공휴일','2027-10-09':'한글날',
  '2027-12-25':'크리스마스'
};
function getHoliday(dateStr) {
  return HOLIDAYS_2025[dateStr]||HOLIDAYS_2026[dateStr]||HOLIDAYS_2027[dateStr]||'';
}

function localDateStr(d) {
  var dt=d||new Date();
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}



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
  if(typeof meals==='string'){ meals.split('/').forEach(function(v){ var cb=document.querySelector('.meal-cb[data-day="weekday"][value="'+v.trim()+'"]'); if(cb){cb.checked=true;cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.add('checked');var tr=document.querySelector('.meal-time-row[data-meal="'+v.trim()+'"]');if(tr)tr.style.display='flex';} }); return; }
  ['weekday','sat','sun'].forEach(function(day){
    if(!meals[day]||!meals[day].length) return;
    if(day!=='weekday'){ var cb=document.getElementById('meal-'+day),sub=document.getElementById('meal-'+day+'-sub'); if(cb)cb.checked=true; if(sub)sub.style.display='flex'; }
    meals[day].forEach(function(v){ var cb=document.querySelector('.meal-cb[data-day="'+day+'"][value="'+v+'"]'); if(cb){cb.checked=true;cb.closest('.meal-chip')&&cb.closest('.meal-chip').classList.add('checked');if(day==='weekday'){var tr=document.querySelector('.meal-time-row[data-meal="'+v+'"]');if(tr)tr.style.display='flex';}} });
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
  if(meals.sat&&meals.sat.length) p.push('토: '+meals.sat.map(function(v){ return mealNames[v]||v; }).join('/'));
  if(meals.sun&&meals.sun.length) p.push('일: '+meals.sun.map(function(v){ return mealNames[v]||v; }).join('/'));
  return p.join('\n')||'-';
}

function isTerminatedNow(c){
  if(!c.terminated) return false;
  if(!c.endDate) return true;
  return dDiff(c.endDate)<0;
}
function isTerminatePending(c){
  return c.terminated&&!!c.endDate&&dDiff(c.endDate)>=0;
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
  revealSupStep('sup-step-content');
  el.classList.toggle('selected');
  var cls=getStaffColor(name);
  if(el.classList.contains('selected')){ if(cls){ el.className='staff-chip '+cls; el.classList.add('selected'); } }
  else el.className='staff-chip';
};
window.toggleMealChip = function(el) { el.classList.toggle('selected'); revealSupStep('sup-step-staff'); };
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
    var restoreStart=prevRecord&&prevRecord.startDate?prevRecord.startDate:(c&&c.startDate?c.startDate:'');
    var restoreEnd=prevRecord&&prevRecord.endDate?prevRecord.endDate:(c&&c.endDate?c.endDate:'');
    var restorePrice=prevRecord&&prevRecord.price!=null?prevRecord.price:(c&&c.price!=null?c.price:0);
    var restoreType=prevRecord&&prevRecord.priceType?prevRecord.priceType:(c&&c.priceType?c.priceType:'per-meal');
    await updateContract(editingId,{
      terminated:false,
      startDate:restoreStart||'',
      endDate:restoreEnd||'',
      price:restorePrice||0,
      priceType:restoreType||'per-meal'
    });
  }
  showToast('삭제되었습니다.');
  if(isTerminate){
    // contracts 배열 즉시 업데이트 (리스너 대기 없이)
    var c2=contracts.find(function(x){ return x.id===editingId; });
    if(c2){
      c2.terminated=false;
      if(prevRecord){
        c2.startDate=prevRecord.startDate||c2.startDate;
        c2.endDate=prevRecord.endDate||c2.endDate;
        c2.price=prevRecord.price||0;
        c2.priceType=prevRecord.priceType||'per-meal';
      }
      if(document.getElementById('detail-screen').style.display==='flex'){
        renderDetail(c2);
      }
      renderAdmin();
      renderBizTab();
    }
  }
};
window.addHfNoteRow=function(val){
  var wrap=document.getElementById('hf-note-wrap'); if(!wrap) return;
  var row=document.createElement('div');
  row.style.cssText='display:flex;gap:6px;align-items:center;';
  row.innerHTML='<input type="text" class="hf-note-item" value="'+(typeof val==='string'?val.replace(/"/g,'&quot;'):'')+'" placeholder="특이사항" style="flex:1;">'+
    '<button class="btn sm" onclick="this.parentElement.remove()" style="flex-shrink:0;"><i class="ti ti-x"></i></button>';
  wrap.appendChild(row);
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
      '<div class="form-group"><label>비고 <span onclick="addHfNoteRow()" style="font-size:11px;color:#185FA5;cursor:pointer;font-weight:500;margin-left:4px;"><i class="ti ti-plus"></i> 추가</span></label><div id="hf-note-wrap" style="display:flex;flex-direction:column;gap:6px;"></div></div>'
    )+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">'+
        '<button class="btn" onclick="closeHistForm()">취소</button>'+
        '<button class="btn primary" onclick="saveHistForm('+idx+')"><i class="ti ti-check"></i> 저장</button>'+
      '</div></div></div>';
  popup.setAttribute('data-addtype', addType);
  var _mouseDownTarget=null;
  popup.addEventListener('mousedown',function(e){ _mouseDownTarget=e.target; });
  popup.addEventListener('click',function(e){ if(e.target===popup&&_mouseDownTarget===popup) closeHistForm(); });
  document.body.appendChild(popup);
  if(addType!=='terminate'){
    var noteParts=(r.note||'').split(/[①②③④⑤⑥⑦⑧⑨⑩]/).map(function(t){ return t.trim(); }).filter(Boolean);
    if(!noteParts.length) noteParts=[''];
    noteParts.forEach(function(t){ addHfNoteRow(t); });
  }
  pushModalState();
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
    note:(function(){
      var el=document.getElementById('hf-note');
      if(el) return el.value.trim();
      var items=Array.prototype.slice.call(document.querySelectorAll('.hf-note-item')).map(function(x){ return x.value.trim(); }).filter(Boolean);
      if(!items.length) return '';
      if(items.length===1) return items[0];
      var nums=['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
      return items.map(function(t,i){ return (nums[i]||(i+1)+'.')+' '+t; }).join('\n');
    })(),
    updatedAt:new Date().toISOString(),
    addType:idx===-1?(detectedType==='terminate'?'terminate':h&&h.records&&h.records.length>0?'renewal':'new'):(records[idx]&&records[idx].addType?records[idx].addType:'edit'),
    createdAt:idx===-1?new Date().toISOString():(records[idx]&&records[idx].createdAt?records[idx].createdAt:records[idx]&&records[idx].updatedAt?records[idx].updatedAt:new Date().toISOString())
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
  await saveHistoryRecords(editingId,name,records);
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
  var modal=document.getElementById('type-select-modal');
  modal.classList.add('open');
};
window.openYearMonthPicker=function(){
  var existing=document.getElementById('ym-picker'); if(existing) existing.remove();
  var popup=document.createElement('div');
  popup.id='ym-picker';
  popup.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:400;display:flex;align-items:center;justify-content:center;';
  var years=[];
  for(var y=2023;y<=2028;y++) years.push(y);
  var months=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  popup.innerHTML='<div style="background:#fff;border-radius:14px;padding:20px;width:320px;max-width:90vw;">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'+
      '<span style="font-size:14px;font-weight:600;">연도/월 선택</span>'+
      '<button class="btn sm" onclick="document.getElementById(\'ym-picker\').remove()"><i class="ti ti-x"></i></button>'+
    '</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">'+
      years.map(function(y){
        return '<div onclick="ymPickYear('+y+',this)" style="padding:6px 14px;border-radius:8px;border:.5px solid #ccc;cursor:pointer;font-size:13px;'+(y===calYear?'background:#185FA5;color:#fff;border-color:#185FA5;':'')+'" data-year="'+y+'">'+y+'년</div>';
      }).join('')+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">'+
      months.map(function(m,i){
        return '<div onclick="ymPickMonth('+(i)+',this)" style="padding:8px 4px;border-radius:8px;border:.5px solid #ccc;cursor:pointer;font-size:13px;text-align:center;'+(i===calMonth?'background:#185FA5;color:#fff;border-color:#185FA5;':'')+'" data-month="'+i+'">'+m+'</div>';
      }).join('')+
    '</div>'+
    '<div style="margin-top:16px;display:flex;justify-content:flex-end;">'+
      '<button class="btn primary" onclick="ymConfirm()"><i class="ti ti-check"></i> 이동</button>'+
    '</div>'+
  '</div>';
  popup.addEventListener('click',function(e){ if(e.target===popup) popup.remove(); });
  document.body.appendChild(popup);
  // 기존 비고 파싱해서 행 생성 (①② 구분)
  if(addType!=='terminate'){
    var noteParts=(r.note||'').split(/[①②③④⑤⑥⑦⑧⑨⑩]/).map(function(t){ return t.trim(); }).filter(Boolean);
    if(!noteParts.length) noteParts=[''];
    noteParts.forEach(function(t){ addHfNoteRow(t); });
  }
  pushModalState();
};
window.ymPickYear=function(y,el){
  document.querySelectorAll('#ym-picker [data-year]').forEach(function(e){ e.style.background=''; e.style.color=''; e.style.borderColor='#ccc'; });
  el.style.background='#185FA5'; el.style.color='#fff'; el.style.borderColor='#185FA5';
  window._ymYear=y;
};
window.ymPickMonth=function(m,el){
  document.querySelectorAll('#ym-picker [data-month]').forEach(function(e){ e.style.background=''; e.style.color=''; e.style.borderColor='#ccc'; });
  el.style.background='#185FA5'; el.style.color='#fff'; el.style.borderColor='#185FA5';
  window._ymMonth=m;
};
window.ymConfirm=function(){
  var y=window._ymYear||calYear, m=window._ymMonth!=null?window._ymMonth:calMonth;
  calYear=y; calMonth=m; calView='month';
  document.getElementById('view-month-btn').classList.add('active-filter');
  document.getElementById('view-week-btn').classList.remove('active-filter');
  document.getElementById('ym-picker').remove();
  renderCalendar();
};
window.closeTypeSelect=function(){
  var modal=document.getElementById('type-select-modal');
  modal.classList.remove('open');
  modal.removeAttribute('data-pushed');
};
window._closeTypeSelectSilent=function(){
  var modal=document.getElementById('type-select-modal');
  modal.classList.remove('open');
  modal.removeAttribute('data-pushed');
};
window.selectScheduleType=function(type){
  window._closeTypeSelectSilent();
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
  pushModalState();
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
  pushModalState();
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

  listenContracts(function(data){
    contracts=data;
    if(window.syncDashData) window.syncDashData(contracts,historyData,supports);
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
    var prevData=historyData;
    historyData=data;
    if(window.syncDashData) window.syncDashData(contracts,historyData,supports);
    if(currentModalTab==='hist'&&editingId){
      var prev=prevData.find(function(x){ return x.contractId===editingId; });
      var curr=data.find(function(x){ return x.contractId===editingId; });
      var prevLen=prev&&prev.records?prev.records.length:0;
      var currLen=curr&&curr.records?curr.records.length:0;
      if(prevLen!==currLen) renderHistTab();
    }
  });
  
  listenSupports(function(data){
    supports=data;
    if(window.syncDashData) window.syncDashData(contracts,historyData,supports);
    if(currentPage==='support'){ renderCalendar(); renderSupStat(window.supStatTab||'month'); }
    if(currentPage==='dashboard') renderDashboard();
  });
}
// ── 로그인 ──────────────────────────
var _loginPhone='',_isNewUser=false,_appStarted=false;
window.checkPhone=async function(){
  var phone=document.getElementById('login-phone').value.replace(/[^0-9]/g,'');
  if(phone.length<10){ showLoginError('올바른 전화번호를 입력해주세요.'); return; }
  try{
    var allowed=await checkAllowedUser(phone);
    if(!allowed){ showLoginError('등록되지 않은 번호예요. 관리자에게 문의하세요.'); return; }
    _loginPhone=phone;
    hideLoginError();
    document.getElementById('login-step-phone').style.display='none';
    document.getElementById('login-step-pw').style.display='block';
    // 가입 여부는 로그인 시도로 판별하므로 일단 로그인 모드로 표시
    _isNewUser=!allowed.registered;
    if(_isNewUser){
      document.getElementById('login-hello').textContent=(allowed.name||'')+'님, 처음 오셨네요! 사용하실 비밀번호를 만들어주세요.';
      document.getElementById('login-pw-label').textContent='새 비밀번호 (6자 이상)';
      document.getElementById('login-pw2-wrap').style.display='block';
      document.getElementById('login-submit-btn').textContent='비밀번호 만들고 시작하기';
    } else {
      document.getElementById('login-hello').textContent=(allowed.name||'')+'님, 안녕하세요!';
      document.getElementById('login-pw-label').textContent='비밀번호';
      document.getElementById('login-pw2-wrap').style.display='none';
      document.getElementById('login-submit-btn').textContent='로그인';
    }
    document.getElementById('login-pw').focus();
  } catch(e){ showLoginError('확인 중 오류가 발생했어요.'); }
};
window.doLogin=async function(){
  var pw=document.getElementById('login-pw').value;
  if(pw.length<6){ showLoginError('비밀번호는 6자 이상이에요.'); return; }
  hideLoginError();
  if(_isNewUser){
    var pw2=document.getElementById('login-pw2').value;
    if(pw!==pw2){ showLoginError('비밀번호가 일치하지 않아요.'); return; }
    try{ await registerUser(_loginPhone,pw); }
    catch(e){
      if(e.code==='auth/email-already-in-use'){
        try{ await loginUser(_loginPhone,pw); }
        catch(e2){ showLoginError('이미 가입된 번호예요. 기존 비밀번호로 로그인해주세요.'); }
      } else showLoginError('가입 중 오류: '+(e.code||''));
    }
    return;
  }
  try{ await loginUser(_loginPhone,pw); }
  catch(e){
    if(e.code==='auth/user-not-found'||e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'){
      showLoginError('비밀번호가 틀렸어요.');
    } else {
      showLoginError('로그인 오류: '+(e.code||''));
    }
  }
};
window.backToPhone=function(){
  document.getElementById('login-step-pw').style.display='none';
  document.getElementById('login-step-phone').style.display='block';
  document.getElementById('login-pw').value='';
  document.getElementById('login-pw2').value='';
  hideLoginError();
};
function showLoginError(msg){ var el=document.getElementById('login-error'); el.textContent=msg; el.style.display='block'; }
function hideLoginError(){ document.getElementById('login-error').style.display='none'; }
window.currentUserRole='staff';
function isAdmin(){ return window.currentUserRole==='admin'; }
window.guardSupportEdit=function(id){
  var s=supports.find(function(x){ return x.id===id; });
  if(!canEditSupport(s)){ showToast('본인 일정만 수정/삭제할 수 있어요.'); return false; }
  return true;
};
function canEditSupport(s){
  if(isAdmin()) return true;
  if(!s) return false;
  if(s.type==='team') return true;
  var myName=window.currentUserName||'';
  if(!myName) return false;
  var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
  return names.some(function(n){ return n===myName||n.split(' ')[0]===myName.split(' ')[0]; });
}
window.applyRoleUI=function(){};
window.doLogout=async function(){
  if(!confirm('로그아웃할까요?')) return;
  await logoutUser();
  location.reload();
};
initAdmin({
  getContracts:function(){ return contracts; },
  getHistory:function(){ return historyData; },
  showToast:showToast,
  mealsDisplay:mealsDisplay,
  deleteContract:deleteContract
});
initDashboard({
  priceHistLabel:priceHistLabel,
  localDateStr:localDateStr,
  pushModalState:pushModalState
});
watchAuth(function(user){
  var loginEl=document.getElementById('login-screen');
  if(user){
    loginEl.style.display='none';
    if(!_appStarted){ _appStarted=true; init(); }
    var phone=(user.email||'').split('@')[0];
    if(phone){
      checkAllowedUser(phone).then(function(info){
        window.currentUserRole=(info&&info.role)||'staff';
        window.currentUserName=(info&&info.name)||'';
        var el=document.getElementById('home-welcome');
        if(el&&info&&info.name) el.innerHTML='<span style="font-weight:600;color:#185FA5;">'+info.name+'</span>님, 반갑습니다 👋';
        applyRoleUI();
      }).catch(function(){ window.currentUserRole='staff'; applyRoleUI(); });
    }
  } else {
    var splash=document.getElementById('splash-screen');
    if(splash) splash.remove();
    loginEl.style.display='flex';
  }
});

function updateHomeBadge() {
  var urgent=contracts.filter(function(c){ return !c.terminated&&calcStatus(c)==='urgent'; }).length;
  var badge=document.getElementById('home-urgent-badge');
  if(badge){ badge.style.display=urgent>0?'block':'none'; badge.textContent=urgent; }
}

// ── 네비게이션 ──────────────────────────
function pushModalState(){ history.pushState({modal:true},'',''); }
window.addEventListener('popstate',function(e){
  var state=e.state||{screen:'home'};
  
  // state.modal이거나, 모달이 열려있으면 모달 닫기 우선
  var dashModal=document.getElementById('dash-modal');
  if(dashModal){ dashModal.remove(); document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); }); return; }
  if(document.getElementById('hist-form-popup')){ closeHistForm(); return; }
  if(document.getElementById('ym-picker')){ document.getElementById('ym-picker').remove(); return; }
  var tsModal=document.getElementById('type-select-modal');
  if(tsModal&&tsModal.classList.contains('open')){ closeTypeSelect(); return; }
  var calPopup=document.getElementById('cal-popup');
  if(calPopup&&calPopup.classList.contains('open')){ calPopup.classList.remove('open'); return; }
  if(document.getElementById('modal-overlay').classList.contains('open')){ closeModal(); return; }
  if(document.getElementById('sup-modal').classList.contains('open')){ closeSupportModal(); return; }
  
  if(document.getElementById('personal-modal').classList.contains('open')){ closePersonalModal(); return; }
  if(document.getElementById('team-modal').classList.contains('open')){ closeTeamModal(); return; }
  if(state.modal){ history.back(); return; }
  applyState(state);
});
function applyState(state) {
  document.getElementById('home-screen').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('detail-screen').style.display='none';
  if(mapInstance&&state.screen!=='page'){ mapInstance.remove(); mapInstance=null; }
  var tabBar=document.getElementById('bottom-tab-bar');
  if(state.screen==='home'){
    document.getElementById('home-screen').style.display='flex'; currentPage='';
    if(tabBar) tabBar.style.display='none';
  } else if(state.screen==='page'){
    document.getElementById('app').style.display='flex'; currentPage=state.page;
    var titles={dashboard:'대시보드',support:'운영지원',businesses:'FS 사업장 현황',admin:'관리자 수정'};
    document.getElementById('page-title').textContent=titles[state.page]||'';
    var actions=document.getElementById('top-actions'); actions.innerHTML='';
    if(state.page==='admin') actions.innerHTML='<button class="btn primary" onclick="openAddModal()"><i class="ti ti-plus"></i> 추가</button><button class="btn" onclick="syncContractsFromHistory()"><i class="ti ti-refresh"></i> 동기화</button><button class="btn" onclick="exportExcel()"><i class="ti ti-download"></i> 엑셀</button><button class="btn" onclick="downloadBackup()"><i class="ti ti-database-export"></i> 백업</button>';
    ['dashboard','support','businesses','admin'].forEach(function(p){
      var el=document.getElementById('page-'+p); if(el) el.style.display=p===state.page?'block':'none';
    });
    if(state.page==='admin'&&!isAdmin()){ showToast('관리자만 접근할 수 있어요.'); history.replaceState({screen:'home'},'',''); applyState({screen:'home'}); return; }
    var pageEl=document.getElementById('page-'+state.page);
    if(pageEl){ pageEl.classList.remove('page-anim'); void pageEl.offsetWidth; pageEl.classList.add('page-anim'); }
    renderPage(state.page);
    if(tabBar){ tabBar.style.display='flex'; }
    ['dashboard','support','businesses','admin'].forEach(function(p){
      var tab=document.getElementById('tab-'+p);
      if(!tab) return;
      var icon=tab.querySelector('i');
      var label=tab.querySelector('span');
      var active=p===state.page;
      if(icon) icon.style.color=active?'#185FA5':'#aaa';
      if(label) label.style.color=active?'#185FA5':'#aaa';
      tab.style.background=active?'#E6F1FB':'';
    });
  } else if(state.screen==='detail'){
    if(tabBar) tabBar.style.display='none';
    var detailEl=document.getElementById('detail-screen');
    detailEl.style.display='flex';
    detailEl.classList.remove('detail-anim'); void detailEl.offsetWidth; detailEl.classList.add('detail-anim');
    window.detailId=state.id;
    var c=contracts.find(function(x){ return x.id===state.id; });
    if(c) renderDetail(c);
  }
}https://github.com/fhr129-cloud/contract-renewal/blob/main/src/js/app.js
window.goHome=function(){ var s={screen:'home'}; history.pushState(s,'',''); applyState(s); };
window._goHome=window.goHome;
window.goPage=function(page){ var s={screen:'page',page:page}; history.pushState(s,'',''); applyState(s); };
window._goPage=window.goPage;
window.goDetail=function(id){ if(!id||id==='undefined') return; var s={screen:'detail',id:id}; history.pushState(s,'',''); applyState(s); };
window.goDetailByName=function(name){ var c=contracts.find(function(x){ return x.name===name; }); if(c) goDetail(c.id); };
window.goBackFromDetail=function(){ history.back(); };
function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='support'){ renderCalendar(); initSS(); }
  if(page==='businesses') renderBizTab();
  if(page==='admin') renderAdmin();
}




// ── 대시보드 ──────────────────────────


// ── 사업장 상세 ──────────────────────────
function renderDetail(c) {
  var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
  document.getElementById('detail-title').textContent=c.name;
  var contactHtml='';
  function fmtPhone(p){ return p?'<a href="tel:'+p.replace(/[^0-9]/g,'')+'" style="color:inherit;text-decoration:none;">'+p+'</a>':''; }
  if(c.contacts&&c.contacts.length) contactHtml=c.contacts.map(function(ct){ return '<div>'+(ct.name||'')+(ct.phone?' · '+fmtPhone(ct.phone):'')+(ct.tel?' · '+fmtPhone(ct.tel):'')+'</div>'; }).join('');
  else contactHtml=(c.contactName||'-')+(c.contactPhone?' · '+fmtPhone(c.contactPhone):'')+(c.tel?' · '+fmtPhone(c.tel):'');
  var h=historyData.find(function(x){ return x.contractId===c.id; });
  var histHtml=h&&h.records&&h.records.length?h.records.map(function(r,i){
    var isCurrent=i===h.records.length-1,label=i===0?'최초':i+'차';
    if(isCurrent) label=r.addType==='terminate'?'해지':'현재';
    return '<div class="hist-record"><span class="hist-round">'+label+'</span>'+
      '<span class="hist-dates">'+(r.addType==='terminate'?'해지일: '+(r.endDate?fmtDate(r.endDate):'-'):(r.startDate?fmtDate(r.startDate):'-')+' ~ '+(r.endDate?fmtDate(r.endDate):'-'))+'</span>'+
      '<span class="hist-price">'+(r.addType==='terminate'?'':priceHistLabel(r))+'</span></div>'+
      (r.note?'<div style="font-size:11px;color:#888;padding:2px 0 6px 8px;white-space:pre-line;">'+r.note+'</div>':'');
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
    '<div class="detail-row"><span class="detail-label">계약 상태</span><div class="detail-val" style="display:flex;align-items:center;gap:8px;">'+(isTerminatePending(c)?'<span class="badge urgent">해지 예정</span><span style="color:#A32D2D;font-weight:500;">'+fmtDate(c.endDate)+' 해지</span>':c.terminated?'<span class="badge urgent">해지</span>':'<span class="badge '+s+'">'+STATUS_META[s].label+'</span><span style="color:'+col+';font-weight:500;">'+dDayLabel(d)+'</span>')+'</div></div>'+
    '<div class="detail-row"><span class="detail-label">소재지</span><span class="detail-val">'+(c.addr||'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">담당자</span><span class="detail-val">'+contactHtml+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">담당영양사</span><span class="detail-val">'+(c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return (nt.name||'')+(nt.phone?' · '+fmtPhone(nt.phone):''); }).join('<br>'):'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">팀/책임</span><span class="detail-val">'+(c.team?c.team+'팀':'-')+' / '+(c.resp||'-')+'</span></div>'+
    '</div>'+
    '<div class="detail-section"><div class="detail-section-title">계약 정보</div>'+
    '<div class="detail-row"><span class="detail-label">계약기간</span><span class="detail-val">'+fmtDate(c.startDate)+' ~ '+fmtDate(c.endDate)+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">계약단가</span><span class="detail-val">'+priceLabel(c)+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">월평균식수</span><span class="detail-val">'+(c.avgMeals?Number(c.avgMeals).toLocaleString()+'식':'-')+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">운영끼니</span><span class="detail-val" style="white-space:pre-line;">'+mealsDisplay(c.meals)+'</span></div>'+
    '<div class="detail-row"><span class="detail-label">특이사항</span><span class="detail-val">'+(c.note||'-')+'</span></div>'+
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
    if(s.type==='team') return true;
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
    if(el) el.textContent=String(baseM).padStart(2,'0')+'월 '+String(base.getDate()).padStart(2,'0')+'일 ~ '+String(endM).padStart(2,'0')+'월 '+String(end.getDate()).padStart(2,'0')+'일';
    renderWeekView();
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
  var html='<div class="cal-grid" style="min-width:900px;width:100%;">';
  ['일','월','화','수','목','금','토'].forEach(function(d,i){ html+='<div class="cal-header" style="'+(i===0?'color:#C0392B;font-weight:700;':i===6?'color:#1A5276;font-weight:700;':'')+'">'+d+'</div>'; });
  for(var i=0;i<firstDay;i++) html+='<div class="cal-day empty"></div>';
  for(var d=1;d<=lastDate;d++){
    var key=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var items=dayMap[key]||[],isToday=key===today;
    var seen={},uniqueItems=[];
    items.forEach(function(s){ if(!seen[s.id]){seen[s.id]=true;uniqueItems.push(s);} });
    var mealOrder=['조식','오전','중식','오후','석식','야식'];
    uniqueItems.sort(function(a,b){
      var am=a.meals&&a.meals.length?mealOrder.indexOf(a.meals[0]):-1;
      var bm=b.meals&&b.meals.length?mealOrder.indexOf(b.meals[0]):-1;
      if(am===-1) am=99; if(bm===-1) bm=99;
      return am-bm;
    });
    var holiday=getHoliday(key);
    var dayOfWeek=new Date(key).getDay();
    var dayColor=dayOfWeek===0?'color:#C0392B;':dayOfWeek===6?'color:#1A5276;':'';
   html+='<div class="cal-day'+(isToday?' today':'')+(holiday?' holiday':'')+'" onclick="openCalPopup(\''+key+'\')">'+
      '<div class="cal-num" style="'+dayColor+'">'+d+'</div>'+(holiday?'<div style="font-size:8px;color:#E24B4A;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px;margin-top:-2px;">'+holiday+'</div>':'')+
      uniqueItems.slice(0,3).map(function(s){
        var isPersonal=s.type==='personal',isTeam=s.type==='team';
        var staffStr=s.staffNames&&s.staffNames.length?s.staffNames[0]:(s.staffName||'');
        var allStaff=s.staffNames&&s.staffNames.length?s.staffNames.map(function(n){ return n.split(' ')[0]; }).join('·'):(s.staffName?s.staffName.split(' ')[0]:'');
        var cls=isTeam?'':isPersonal?'':getStaffColor(staffStr);
        var ptColors={'연차':'#A32D2D','반차(오전)':'#A32D2D','반차(오후)':'#A32D2D','외근':'#185FA5','교육':'#6B2FA0','기타':'#666'};
        var evStyle=isTeam?'background:#FFECEC;color:#A32D2D;font-weight:700;':isPersonal?'background:transparent;color:'+(ptColors[s.personalType]||'#666')+';font-weight:600;':'';
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
  // 자동 스크롤 제거
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
  var staffOrder=STAFF_ORDER;
  var dayLabels=['월','화','수','목','금','토','일'];

  // 팀 공지 행
  var html='<div class="week-grid" style="min-width:900px;width:100%;">';
  // 헤더 행
  html+='<div class="week-header"></div>';
  days.forEach(function(d,i){
    var dStr=localDateStr(d),isToday=dStr===todayStr;
    var hday=getHoliday(dStr);
    var wdColor=i===5?'color:#1A5276;':i===6?'color:#C0392B;':'';
    html+='<div class="week-header'+(isToday?' today-col':'')+(hday?' holiday':'')+'" style="'+(hday?'color:#E24B4A;':wdColor)+'">' +dayLabels[i]+'<br><div style="display:flex;align-items:center;justify-content:center;gap:3px;"><span style="font-weight:600;">'+d.getDate()+'</span>'+(hday?'<span style="font-size:8px;font-weight:400;color:#E24B4A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:36px;">'+hday+'</span>':'')+' </div></div>';
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
    var staffBg=getStaffBg(staff);
    
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
      var mealOrder=['조식','오전','중식','오후','석식','야식'];
      items.sort(function(a,b){
        var am=a.meals&&a.meals.length?mealOrder.indexOf(a.meals[0]):-1;
        var bm=b.meals&&b.meals.length?mealOrder.indexOf(b.meals[0]):-1;
        if(am===-1) am=99; if(bm===-1) bm=99;
        return am-bm;
      });
      // 연차/반차면 셀 배경색 변경
      var cellBg='';
      var dow=new Date(dStr).getDay();
      if(isToday){
        cellBg='background:#fafff8;';
      } else if(dow===6){
        cellBg='background:#F2F7FD;';
      } else if(getHoliday(dStr)||dow===0){
        cellBg='background:#FDF2F2;';
      }
      html+='<div class="week-cell'+(isToday?' today-col':'')+'" style="'+cellBg+'" onclick="openTypeSelectWithStaff(\''+dStr+'\',\''+staff+'\')" >'+
        items.map(function(s){
          var isPersonal=s.type==='personal';
          var borderColor=getStaffBorderColor(staff);
          
          var evStyle='',label='';
          if(isPersonal){
            var ptColors={'연차':'#A32D2D','반차(오전)':'#A32D2D','반차(오후)':'#A32D2D','외근':'#185FA5','교육':'#6B2FA0','기타':'#666'};
            var ptCol=ptColors[s.personalType]||'#666';
            evStyle='background:transparent;color:'+ptCol+';font-weight:600;';
            var isLeaveType=s.personalType==='연차'||s.personalType==='반차(오전)'||s.personalType==='반차(오후)';
            label=isLeaveType?s.bizName:'개인일정: '+(s.personalType||'기타');
          } else {
            evStyle='background:'+getStaffBg(staff)+';color:#1a1a18;border-left:3px solid '+borderColor+';font-weight:600;';
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
  // 모바일: 오늘 열로 자동 스크롤
  if(weekOffset===0&&calEl){
    setTimeout(function(){
      var scroller=calEl.parentElement;
      if(!scroller||scroller.scrollWidth<=scroller.clientWidth) return;
     var todayHeader=calEl.querySelector('.week-header.today-col');
      if(todayHeader){
        var colW=todayHeader.offsetWidth;
        var left=todayHeader.offsetLeft-92-Math.round(colW/2);
        scroller.scrollTo({left:Math.max(0,left),behavior:'smooth'});
      }
    },100);
  }
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
    pushModalState();
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
  pushModalState();
};

window.openCalPopupSingle=function(supportId){
  var s=supports.find(function(x){ return x.id===supportId; });
  if(!s) return;
  var popup=getOrCreatePopup();
  document.getElementById('cal-popup-title').textContent=s.bizName+' 일정';
  document.getElementById('cal-popup-body').innerHTML=supItemHtml(s,s.date);
  popup.classList.add('open');
  pushModalState();
};

window.closeCalPopup=function(){ var p=document.getElementById('cal-popup'); if(p) p.classList.remove('open'); };
window.editPersonal=function(id){
  var s=supports.find(function(x){ return x.id===id; }); if(!s) return;
  if(!canEditSupport(s)){ showToast('본인 일정만 수정할 수 있어요.'); return; }
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
  pushModalState();
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
  pushModalState();
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
  if(!window.guardSupportEdit(id)) return;
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); closeCalPopup(); } catch(e){ showToast('오류 발생'); }
};

window.openTypeSelectWithStaff=function(date,staffName){
  window._typeSelectDate=date||null;
  window._typeSelectStaff=staffName||null;
  document.getElementById('type-select-modal').classList.add('open');
  pushModalState();
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
window.openSS=function(){
  document.getElementById('ss-dropdown').classList.add('open');
  var alreadySelected=document.getElementById('sup-biz').value;
  renderSSOptions(alreadySelected?'':document.getElementById('ss-input').value);
};
window.closeSS=function(){ document.getElementById('ss-dropdown').classList.remove('open'); };
window.revealSupStep=function(id){ var el=document.getElementById(id); if(el&&el.style.display==='none'){ el.style.display=''; el.classList.remove('sup-step-anim'); void el.offsetWidth; el.classList.add('sup-step-anim'); setTimeout(function(){ el.scrollIntoView({behavior:'smooth',block:'nearest'}); },100); } };
window.setSupToday=function(){
  var d=new Date();
  var v=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  document.getElementById('sup-date').value=v;
  revealSupStep('sup-step-cat');
};
window.supStepsReset=function(showAll){
  ['sup-step-date','sup-step-cat','sup-step-meal','sup-step-staff','sup-step-content'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display=showAll?'':'none';
  });
};
window.selectSS=function(name){
  document.getElementById('ss-input').value=name;
  document.getElementById('sup-biz').value=name;
  if(name){
    revealSupStep('sup-step-date');
    // 날짜가 이미 채워져 있으면(달력에서 진입) 다음 단계도 자동 공개
    if(document.getElementById('sup-date').value) revealSupStep('sup-step-cat');
  }
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
  supStepsReset(false);
  document.getElementById('sup-submit-btn').innerHTML='<i class="ti ti-check"></i> 등록';
  document.getElementById('sup-modal').classList.add('open');
  pushModalState();
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
  if(!meals.length){ showToast('끼니를 선택해주세요.'); return; }
  if(!staffNames.length){ showToast('지원자를 선택해주세요.'); return; }
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
  if(!canEditSupport(s)){ showToast('본인 일정만 수정할 수 있어요.'); return; }
  editingSupportId=id;
  supStepsReset(true);
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
  pushModalState();
  showToast('내용 수정 후 저장하세요.');
};
window.delSupport=async function(id){
  if(!window.guardSupportEdit(id)) return;
  if(!confirm('삭제할까요?')) return;
  try{ await deleteSupport(id); showToast('삭제되었습니다.'); } catch(e){ showToast('오류 발생'); }
};
window.delSupportFromDetail=async function(id,contractId){
  if(!window.guardSupportEdit(id)) return;
  if(!confirm('삭제할까요?')) return;
  try{
    await deleteSupport(id);
    showToast('삭제되었습니다.');
    var c=contracts.find(function(x){ return x.id===contractId; });
    if(c) renderDetail(c);
  } catch(e){ showToast('오류 발생'); }
};

// ── FS 사업장 현황 ──────────────────────────
function bizCard(c){
  var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
  var nutriStr=c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return nt.name; }).join(' / '):'';
  var isUrgent=s==='urgent';
  return '<div class="biz-card'+(isUrgent?' urgent-card':'')+'" onclick="goDetail(\''+c.id+'\')">' +
    '<div class="biz-card-top"><span class="biz-name">'+c.name+'</span>'+(isTerminatePending(c)?'<span class="badge urgent">해지 예정</span>':'<span class="badge '+s+'">'+STATUS_META[s].label+'</span>')+'</div>'+
    '<div class="biz-info">'+
      '<div class="biz-info-row"><i class="ti ti-map-pin"></i><span>'+(c.addr||'-')+'</span></div>'+
      (currentBizTab==='team'?(nutriStr?'<div class="biz-info-row"><i class="ti ti-user"></i><span>'+nutriStr+'</span></div>':'')+(c.resp?'<div class="biz-info-row"><i class="ti ti-user-check"></i><span>'+c.resp+'</span></div>':''):'')+
      (currentBizTab==='resp'?(nutriStr?'<div class="biz-info-row"><i class="ti ti-user"></i><span>'+nutriStr+'</span></div>':''):'')+
    '</div>'+
    '<div class="biz-bottom"><span>'+fmtDate(c.endDate)+'</span><span style="font-weight:500;color:'+col+'">'+dDayLabel(d)+'</span></div>'+
    '</div>';
}
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
  var filtered=contracts.filter(function(c){
    if(currentBizTab!=='newterm'&&currentBizTab!=='region'&&isTerminatedNow(c)) return false;
    if(!q) return true;
    if(c.name.toLowerCase().includes(q)) return true;
    if(c.nutritionists&&c.nutritionists.some(function(nt){ return (nt.name||'').toLowerCase().includes(q); })) return true;
    return false;
  });
  if(currentBizTab==='team'){
    var t1=filtered.filter(function(c){ return c.team===1; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    var t2=filtered.filter(function(c){ return c.team===2; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    var t3=filtered.filter(function(c){ return c.team===3; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
    el.innerHTML='<div class="team-layout team-layout-3">'+
      '<div><div class="team-header blue" onclick="toggleTeam(\'t1\')"><i class="ti ti-users"></i> 1팀 — 박주형 본부장 <span>'+t1.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body'+(q&&t1.length?' open':'')+'" id="t1">'+t1.map(bizCard).join('')+'</div></div>'+
     '<div><div class="team-header green" onclick="toggleTeam(\'t2\')"><i class="ti ti-users"></i> 2팀 — 김재희 차장 <span>'+t2.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body'+(q&&t2.length?' open':'')+'" id="t2">'+t2.map(bizCard).join('')+'</div></div>'+
      '<div><div class="team-header amber" onclick="toggleTeam(\'t3\')"><i class="ti ti-users"></i> 3팀 — 권은진 과장 <span>'+t3.length+'개소</span><i class="ti ti-chevron-down toggle-icon"></i></div><div class="team-body'+(q&&t3.length?' open':'')+'" id="t3">'+t3.map(bizCard).join('')+'</div></div>'+
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
    var ro=['이소영 주임','김상준 주임','견병록 매니저'],rc=['blue','green','amber'];
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
      if(isTerminatedNow(c)) return false;
      var h=historyData.find(function(x){ return x.contractId===c.id; });
      if(!h||!h.records||!h.records.length) return false;
      var first=h.records[0];
      if(!first.startDate) return false;
      return new Date(first.startDate).getFullYear()>=thisYear;
    });
    var termBiz=contracts.filter(function(c){ return isTerminatedNow(c); });
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
            '<span class="badge ok">신규</span></div>'+
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
            '<span class="badge urgent">해지</span></div>'+
           '<div class="biz-info">'+
              '<div class="biz-info-row"><i class="ti ti-map-pin"></i><span>'+(c.addr||'-')+'</span></div>'+
              (c.nutritionists&&c.nutritionists.length?'<div class="biz-info-row"><i class="ti ti-user"></i><span>'+c.nutritionists.map(function(nt){ return nt.name; }).join(' / ')+'</span></div>':'')+
            '</div>'+
           '<div class="biz-bottom"><span></span><span style="color:#A32D2D;font-weight:500;">'+termDate+'</span></div>'+
          '</div>';
        }).join(''):'<div style="color:#aaa;font-size:13px;padding:12px 0;">해지 사업장이 없어요</div>')+
      '</div>'+
    '</div>';
    html+='</div>';
   el.innerHTML=html;
    
  } else {
    el.innerHTML='<div class="map-legend"><span><span class="leg-dot" style="background:#E24B4A;"></span>긴급</span><span><span class="leg-dot" style="background:#EF9F27;"></span>임박</span><span><span class="leg-dot" style="background:#4A90D9;"></span>여유/자동연장</span><span><span class="leg-dot" style="background:#aaa;"></span>해지</span></div><div id="map"></div>';
    setTimeout(function(){
      if(mapInstance){mapInstance.remove();mapInstance=null;}
      mapInstance=L.map('map').setView([36.98,127.05],9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInstance);
     filtered.forEach(function(c){
        var coord=(c.lat&&c.lng)?{lat:c.lat,lng:c.lng}:COORDS[c.name]; if(!coord) return;
        var s=calcStatus(c);
        var color=c.terminated?'#aaa':s==='urgent'?'#E24B4A':s==='near'?'#EF9F27':'#4A90D9';
        var radius=c.terminated?6:s==='urgent'?10:8;
        var opacity=c.terminated?0.4:0.9;
        var marker=L.circleMarker([coord.lat,coord.lng],{radius:radius,fillColor:color,color:'#fff',weight:2,fillOpacity:opacity}).addTo(mapInstance);
        marker.bindTooltip(c.name,{permanent:true,direction:'top',offset:[0,-8],opacity:c.terminated?0.5:0.97,className:'map-label'});
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
      '<td>'+(isTerminatePending(c)?'<span class="badge urgent">해지 예정</span>':c.terminated?'<span class="badge urgent">해지</span>':'<span class="badge '+s+'">'+STATUS_META[s].label+'</span>')+'</td>'+
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
  pushModalState();
};
window.openEditModal=function(id){
  if(!id||id==='undefined') return;
  if(!isAdmin()){ showToast('계약 정보는 관리자만 수정할 수 있어요.'); return; }
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
  // 히스토리 있으면 계약기간/단가 readonly
  var hasHist=historyData.find(function(x){ return x.contractId===id&&x.records&&x.records.length; });
  var roFields=['f-startDate','f-endDate','f-price','f-priceType'];
  roFields.forEach(function(fid){
    var el=document.getElementById(fid);
    if(el){ el.readOnly=!!hasHist; el.disabled=!!hasHist; el.style.background=hasHist?'#f5f5f3':''; el.style.color=hasHist?'#aaa':''; }
  });
  var hint=document.getElementById('hist-readonly-hint');
  if(hasHist){
    if(!hint){
      var h=document.createElement('div');
      h.id='hist-readonly-hint';
      h.style.cssText='font-size:11px;color:#854F0B;background:#FAEEDA;padding:6px 10px;border-radius:6px;margin-bottom:8px;grid-column:1/-1;';
      h.textContent='⚠️ 계약기간·단가는 계약 히스토리 탭에서 수정해주세요.';
      document.querySelector('.form-grid').prepend(h);
    }
  } else {
    if(hint) hint.remove();
  }
  document.getElementById('modal-overlay').classList.add('open');
  pushModalState();
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
        await updateHistoryName(editingId,name);
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

function addRipple(e){
  var el=e.currentTarget;
  var r=document.createElement('span');
  r.className='ripple-el';
  var rect=el.getBoundingClientRect();
  var size=Math.max(rect.width,rect.height);
  r.style.cssText='width:'+size+'px;height:'+size+'px;left:'+(e.clientX-rect.left-size/2)+'px;top:'+(e.clientY-rect.top-size/2)+'px;';
  el.appendChild(r);
  setTimeout(function(){ r.remove(); },500);
}
document.addEventListener('click',function(e){
  var btn=e.target.closest('.btn,.stat-card,.biz-card,.dash-mini-item,.home-btn,.tab-btn');
  if(btn){ btn.classList.add('ripple-wrap'); addRipple({currentTarget:btn,clientX:e.clientX,clientY:e.clientY}); }
});
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
// 당겨서 새로고침 후 페이지 복원
var ptrPage=sessionStorage.getItem('ptr-page');
if(ptrPage){
  sessionStorage.removeItem('ptr-page');
  var s={screen:'page',page:ptrPage};
  history.replaceState(s,'','');
  applyState(s);
}
// 당겨서 새로고침 (모바일)
(function(){
  var startY=0,pulling=false,threshold=70;
  var indicator=document.createElement('div');
  indicator.id='ptr-indicator';
  indicator.style.cssText='position:fixed;top:-50px;left:50%;transform:translateX(-50%);width:36px;height:36px;background:#fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;z-index:9998;transition:top .2s;';
  indicator.innerHTML='<i class="ti ti-refresh" style="font-size:18px;color:#185FA5;"></i>';
  document.body.appendChild(indicator);
  document.addEventListener('touchstart',function(e){
    if(window.scrollY===0&&!document.querySelector('#modal-overlay.open,#sup-modal.open,#personal-modal.open,#team-modal.open,#cal-popup.open,#dash-modal,#hist-form-popup')){
      startY=e.touches[0].clientY; pulling=true;
    }
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!pulling) return;
    var diff=e.touches[0].clientY-startY;
    if(diff>0&&window.scrollY===0){
      indicator.style.top=Math.min(diff*0.4-50,30)+'px';
      indicator.querySelector('i').style.transform='rotate('+diff*2+'deg)';
    }
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(!pulling) return;
    pulling=false;
    var diff=e.changedTouches[0].clientY-startY;
    if(diff>threshold*2.5&&window.scrollY===0){
      indicator.style.top='20px';
      indicator.querySelector('i').style.animation='spin .6s linear infinite';
      setTimeout(function(){
        if(currentPage) renderPage(currentPage);
        indicator.style.top='-50px';
        indicator.querySelector('i').style.animation='';
      },600);
    } else {
      indicator.style.top='-50px';
    }
  },{passive:true});
})();
// 스플래시 화면
var splash=document.getElementById('splash-screen');
if(splash){
  setTimeout(function(){
    splash.style.opacity='0';
    setTimeout(function(){ splash.remove(); },400);
  },1000);
}
