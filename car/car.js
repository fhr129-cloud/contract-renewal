// car.js — 차량 예약 앱 (레이 2대 + 스타렉스 1대). FS 앱과 같은 Firebase·로그인을 쓴다.
import { db, checkAllowedUser, loginUser, registerUser, watchAuth, logoutUser } from '../src/js/db.js';
import {
  collection, doc, query, where, onSnapshot, runTransaction, serverTimestamp, getDocs, writeBatch, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── 설정: 차량번호·안내 문구는 여기만 고치면 됨 ──────────────────
export var CARS = [
  { id:'ray1',   name:'레이 5653', short:'레이5653', plate:'', fuel:'휘발유', color:'#185FA5', bg:'#E6F1FB' },
  { id:'ray2',   name:'레이(밴) 2327', short:'레이(밴)2327', plate:'', fuel:'휘발유', color:'#854F0B', bg:'#FAEEDA' },
  { id:'starex', name:'스타렉스', short:'스타렉스', plate:'', fuel:'경유', color:'#3B6D11', bg:'#EAF3DE' }   // fuel: 운행일지 '유류구분' 칸
];
// 운행일지: 이 날짜부터 끝난 운행은 운행종료 숫자가 없으면 '비어 있음'으로 알림 (그 전 운행은 적어도 되고 안 적어도 됨)
var KM_SINCE = '2026-10-23';
var NOTICE = '';                 // 예: '키: 본사 1층 경영지원팀 · 주차: 본사 주차장 B구역'
var SLOTS = { am:{label:'오전', s:'09:00', e:'13:00'}, pm:{label:'오후', s:'13:00', e:'18:00'}, day:{label:'종일', s:'09:00', e:'18:00'} };
var PURPOSES = ['특식지원','이벤트지원','물품배송','정비검사','기타'];

// ── 아이콘 (선 아이콘, 장식용) ──────────────────────────
var ICON = {
  cal:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  list:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  out:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  plus:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  phone:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'
};
// ── 상태 ──────────────────────────
var me = null;            // {phone,name,role,apps}
var list = [];            // 예약 전체 (최근 2달~)
var LIST_SINCE = '';
var monthCursor = firstOfMonth(new Date());
var form = null;          // 예약 입력 중인 값
var unsub = null, unsubSites = null;
var sites = [];           // FS 사업장 이름 목록 (meta/sites)
var staffList = [];       // 예약자 선택용 직원 [{n:이름 직급, g:소속, p:휴대폰}]
var unsubStaff = null;
var carKm = {};            // 차마다 최근 계기판 km {km, at:'날짜 시각', since:'기록 시작일'} (carKm 컬렉션)
var unsubKm = null;
var loginPhone = '', isNewUser = false;

// ── 날짜 도구 ──────────────────────────
function pad(n){ return String(n).padStart(2,'0'); }
export function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
export function parseYmd(s){ var p=String(s).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
export function addDays(d,n){ var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
export function mondayOf(d){ var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); var w=(x.getDay()+6)%7; x.setDate(x.getDate()-w); return x; }
function firstOfMonth(d){ return new Date(d.getFullYear(),d.getMonth(),1); }
export function toMin(hm){ var p=String(hm||'0:0').split(':'); return (+p[0])*60+(+p[1]); }
function nowHM(){ var d=new Date(); return pad(d.getHours())+':'+pad(d.getMinutes()); }
var DOW = ['일','월','화','수','목','금','토'];
function dayLabel(s){ var d=parseYmd(s); return (d.getMonth()+1)+'월 '+d.getDate()+'일 ('+DOW[d.getDay()]+')'; }
export function overlaps(a,b){ return a.start < b.end && a.end > b.start; }

function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function car(id){ return CARS.filter(function(c){ return c.id===id; })[0]||CARS[0]; }
function hasApp(info,a){ return !info||!info.apps||info.apps.indexOf(a)>=0; }
function isAdmin(){ return !!(me&&me.role==='admin'); }
// 수정·취소·반납: 등록한 사람, 예약자로 선택된 사람, 관리자
function canEdit(r){ return isAdmin()||(r&&r.type!=='maint'&&(r.ownerPhone===me.phone||(r.riderPhones||[]).indexOf(me.phone)>=0)); }
function telFmt(p){ p=String(p||''); return p.length===11?p.slice(0,3)+'-'+p.slice(3,7)+'-'+p.slice(7):p; }
// 그 차의 가장 최근 반납 메모 (before 시각 이전, 14일 이내)
function lastNote(carId, before, exceptId){
  var lim=ymd(addDays(new Date(),-14));
  return list.filter(function(r){ return r.carId===carId&&r.returnNote&&r.id!==exceptId&&r.date>=lim&&(r.date+r.end)<=before; })
    .sort(function(a,b){ return (b.date+b.end).localeCompare(a.date+a.end); })[0]||null;
}
// 예약자: 등록할 때 고른 사람(최대 2명). 예전 예약은 등록한 사람.
function users(r){ return r.riders&&r.riders.length?r.riders:(r.ownerName?[r.ownerName]:[]); }
function short1(n){ return String(n||'').split(' ')[0]; }
function who(r){ if(r.type==='maint') return '정비'; var u=users(r); return u.length>1?short1(u[0])+' 외'+(u.length-1):short1(u[0]); }
function whoFull(r){ return users(r).join(', '); }
function isMine(r){ var m=short1(me.name); return r.ownerPhone===me.phone||(r.riderPhones||[]).indexOf(me.phone)>=0||users(r).some(function(n){ return short1(n)===m; }); }
function phoneOf(n){ var x=staffList.filter(function(s){ return s.n===n; })[0]; return x&&x.p||''; }
function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('on'); },2600); }

// 같은 날 예약은 항상 차 순서(레이 5653 → 레이 2327 → 스타렉스), 같은 차 안에서는 시간 순
function carIdx(id){ for(var i=0;i<CARS.length;i++) if(CARS[i].id===id) return i; return 99; }
function itemsOn(date,carId){ return list.filter(function(r){ return r.date===date&&(!carId||r.carId===carId); }).sort(function(a,b){ return (carIdx(a.carId)-carIdx(b.carId))||a.start.localeCompare(b.start); }); }

// ── Firestore ──────────────────────────
function listen(){
  if(unsub) unsub();
  var since = LIST_SINCE = ymd(addDays(new Date(),-70));
  unsub = onSnapshot(query(collection(db,'reservations'), where('date','>=',since)), function(snap){
    list = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    render();
  }, function(err){ console.error(err); toast('예약을 불러오지 못했어요 ('+(err.code||'')+')'); });
  if(unsubKm) unsubKm();
  unsubKm = onSnapshot(collection(db,'carKm'), function(snap){
    carKm = {}; snap.docs.forEach(function(d){ carKm[d.id]=d.data(); }); render();
  }, function(err){ console.warn('계기판 km 오류', err.code); });
  if(unsubSites) unsubSites();
  if(unsubStaff) unsubStaff();
  if(hasApp(me,'fs')){
    // FS 권한이 있으면 운영지원 일정 등록과 똑같이 사업장·직원 목록을 직접 읽음
    unsubSites = onSnapshot(collection(db,'contracts'), function(snap){
      sites = snap.docs.map(function(d){ return d.data().name; }).filter(Boolean).sort(function(a,b){ return a.localeCompare(b,'ko'); });
      refreshLists();
    }, function(err){ console.warn('사업장 목록 오류', err.code); });
    unsubStaff = onSnapshot(collection(db,'staff'), function(snap){
      staffList = snap.docs.map(function(d){ return d.data(); })
        .filter(function(x){ return x.active!==false&&hasApp(x,'car'); })
        .sort(function(a,b){ return (a.order||99)-(b.order||99); })
        .map(function(x){ return { n:x.title?x.name+' '+x.title:x.name, g:x.group||'운영', p:String(x.phone||'').replace(/[^0-9]/g,'') }; });
      refreshLists();
    }, function(err){ console.warn('직원 목록 오류', err.code); });
  } else {
    // 차량만 쓰는 직원은 FS 데이터를 못 읽으므로, 관리자가 복사해둔 이름 목록을 읽음
    unsubSites = onSnapshot(doc(db,'meta','sites'), function(snap){
      sites = snap.exists() ? (snap.data().names||[]) : []; refreshLists();
    }, function(err){ console.warn('사업장 목록 없음', err.code); });
    unsubStaff = onSnapshot(doc(db,'meta','staff'), function(snap){
      // 형식: '이름 직급|휴대폰|소속'
      staffList = (snap.exists() ? (snap.data().names||[]) : []).map(function(v){ var a=String(v).split('|'); return { n:a[0], p:a[1]||'', g:a[2]||'' }; }); refreshLists();
    }, function(err){ console.warn('직원 목록 없음', err.code); });
  }
}
// 목록이 늦게 도착하면 열려 있는 입력 화면에 반영
function refreshLists(){
  if(!form) return;
  var sg=document.getElementById('dest-sug');
  if(sg&&sg.classList.contains('open')){ sg.innerHTML=destSug(form.destPicked?'':form.dest); return; }
  var ae=document.activeElement;
  if(!(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))) renderForm();
}
// 같은 차·같은 날짜의 시간대를 carDays/{차_날짜} 문서 하나에 모아두고, 트랜잭션으로 겹침을 막는다.
function dayKey(carId,date){ return carId+'_'+date; }
// 여러 날 예약은 날짜마다 문서 하나씩, groupId로 묶는다. 첫날은 출발~24:00, 중간날은 종일, 마지막날은 00:00~반납.
function segsOf(date,endDate,start,end){
  var ds=datesBetween(date, endDate&&endDate>date?endDate:date);
  return ds.map(function(d,i){ return { date:d, start:i?'00:00':start, end:i<ds.length-1?'24:00':end }; });
}
function group(r){
  if(!r||!r.groupId) return r?[r]:[];
  return list.filter(function(x){ return x.groupId===r.groupId; }).sort(function(a,b){ return a.date.localeCompare(b.date); });
}
function shortRange(r){
  var g=group(r), a=g[0], b=g[g.length-1];
  if(g.length<2) return r.start+' – '+r.end;
  function md(x){ var d=parseYmd(x); return (d.getMonth()+1)+'/'+d.getDate(); }
  return md(a.date)+' '+a.start+' ~ '+md(b.date)+' '+b.end;
}
function rangeText(g){
  var a=g[0], b=g[g.length-1];
  return g.length>1 ? dayLabel(a.date)+' '+a.start+' ~ '+dayLabel(b.date)+' '+b.end : dayLabel(a.date)+' '+a.start+' – '+a.end;
}
// rs: 예약 하나 또는 여러 대(차마다 하나). 여러 대는 한 번에 저장되고, 한 대라도 겹치면 전부 저장 안 됨.
async function saveReservation(rs, olds){
  rs=Array.isArray(rs)?rs:[rs]; olds=olds||[];
  var oldIds=olds.map(function(o){ return o.id; });
  return runTransaction(db, async function(tx){
    var keys=[];
    function addKey(k){ if(keys.indexOf(k)<0) keys.push(k); }
    rs.forEach(function(r){ r.segs.forEach(function(s){ addKey(dayKey(r.carId,s.date)); }); });
    olds.forEach(function(o){ addKey(dayKey(o.carId,o.date)); });
    var ranges={};
    for(var i=0;i<keys.length;i++){
      var snap=await tx.get(doc(db,'carDays',keys[i]));
      ranges[keys[i]]=(snap.exists()?(snap.data().ranges||[]):[]).filter(function(x){ return oldIds.indexOf(x.id)<0; });
    }
    rs.forEach(function(r){ r.segs.forEach(function(s){
      var hit=ranges[dayKey(r.carId,s.date)].filter(function(x){ return overlaps(x,s); })[0];
      if(hit){ var e=new Error('CONFLICT'); e.date=s.date; e.hit=hit; e.carId=r.carId; throw e; }
    }); });
    var owner=olds[0]||{ ownerPhone:me.phone, ownerName:me.name };
    var reuse=rs.length===1?olds:[];
    rs.forEach(function(r){
      var refs=r.segs.map(function(s,i){ return i<reuse.length?doc(db,'reservations',reuse[i].id):doc(collection(db,'reservations')); });
      var gid=refs.length>1?refs[0].id:'';
      r.segs.forEach(function(s,i){
        tx.set(refs[i], {
          carId:r.carId, date:s.date, start:s.start, end:s.end, type:r.type, groupId:gid,
          ownerPhone:owner.ownerPhone, ownerName:owner.ownerName,
          dest:r.dest||'', purpose:r.purpose||'', riders:r.riders||[], riderPhones:r.riderPhones||[], memo:r.memo||'', returnedAt:r.returnedAt||'', returnNote:r.returnNote||'',
          startKm:numOrNull(r.startKm), endKm:numOrNull(r.endKm), fuel:+r.fuel||0, origin:r.origin||'', route:r.route||'', toll:+r.toll||0, lateAdd:!!r.lateAdd,
          createdAt:(reuse[i]&&reuse[i].createdAt)||serverTimestamp(), updatedAt:serverTimestamp(), updatedBy:me.phone
        });
        ranges[dayKey(r.carId,s.date)].push({ id:refs[i].id, start:s.start, end:s.end, who:r.type==='maint'?'정비':(r.riders&&r.riders[0]?short1(r.riders[0]):owner.ownerName) });
      });
      reuse.slice(r.segs.length).forEach(function(o){ tx.delete(doc(db,'reservations',o.id)); });
    });
    keys.forEach(function(k){ var j=k.indexOf('_'); tx.set(doc(db,'carDays',k), { carId:k.slice(0,j), date:k.slice(j+1), ranges:ranges[k] }); });
  });
}
async function cancelReservation(g){
  var ids=g.map(function(o){ return o.id; });
  return runTransaction(db, async function(tx){
    var keys=[]; g.forEach(function(o){ var k=dayKey(o.carId,o.date); if(keys.indexOf(k)<0) keys.push(k); });
    var ranges={};
    for(var i=0;i<keys.length;i++){
      var snap=await tx.get(doc(db,'carDays',keys[i]));
      ranges[keys[i]]=(snap.exists()?(snap.data().ranges||[]):[]).filter(function(x){ return ids.indexOf(x.id)<0; });
    }
    keys.forEach(function(k){ var j=k.indexOf('_'); tx.set(doc(db,'carDays',k), { carId:k.slice(0,j), date:k.slice(j+1), ranges:ranges[k] }); });
    ids.forEach(function(id){ tx.delete(doc(db,'reservations',id)); });
  });
}

// ── 화면 (FS 운영지원 화면과 같은 모양) ──────────────────────────
// 휴대폰에서 달력이 옆으로 넓을 때: 처음 열 때·달을 옮길 때는 오늘 칸이 보이게, 그 외엔 보던 위치 유지
var scrollToToday=true;
function render(){
  var app=document.getElementById('app');
  if(!me){ app.innerHTML=''; return; }
  var sc=app.querySelector('.cal-scroll'), prevX=sc?sc.scrollLeft:0;
  ensureLogCss();
  if(view==='log'){ app.innerHTML=topBar()+viewTabs()+'<div class="page-body">'+missingBanner()+logPage()+'</div>'; renderPopup(); renderForm(); if(!logState||(!logState.pool&&!logState.loading)) loadLog();
    // 운행일지 탭을 열면 PC 표에서 오늘 줄이 보이게
    var tr=document.getElementById('lg-today-row'); if(logScrollToday&&tr&&tr.offsetParent&&logState&&logState.pool){ logScrollToday=false; tr.scrollIntoView({block:'center'}); }
    if(logFocus&&logState&&logState.pool){ var fe=[].slice.call(document.querySelectorAll('[data-rid="'+logFocus+'"]')).filter(function(x){ return x.offsetParent; })[0]; if(fe){ fe.scrollIntoView({block:'center'}); fe.classList.add('lg-flash'); } logFocus=null; }
    return; }
  app.innerHTML=topBar()+viewTabs()+'<div class="page-body">'+missingBanner()+statusRow()+monthView()+myList()+'</div>';
  var sc2=app.querySelector('.cal-scroll');
  if(sc2){
    if(scrollToToday){
      var td=sc2.querySelector('.cal-day.today');
      sc2.scrollLeft=td?Math.max(0, td.offsetLeft-(sc2.clientWidth-td.offsetWidth)/2):0;
      scrollToToday=false;
    } else sc2.scrollLeft=prevX;
  }
  renderPopup(); renderForm();
}
function topBar(){
  return '<div class="top-bar">'+
    (hasApp(me,'fs')?'<a class="back-btn" href="../"><i class="ti ti-arrow-left"></i> 홈</a>':'')+
    '<h2>차량 예약</h2>'+
    '<div class="top-actions"><button class="btn primary" data-act="new"><i class="ti ti-plus"></i> 예약 등록</button>'+
    '<button class="btn sm" data-act="logout" title="로그아웃"><i class="ti ti-logout"></i></button></div></div>';
}
function statusRow(){
  var t=ymd(new Date()), n=nowHM();
  return '<div class="car-stats">'+CARS.map(function(c){
    var cur=itemsOn(t,c.id).filter(function(r){ return r.start<=n&&n<r.end; })[0];
    var next=list.filter(function(r){ return r.carId===c.id&&(r.date>t||(r.date===t&&r.start>n)); }).sort(function(a,b){ return (a.date+a.start).localeCompare(b.date+b.start); })[0];
    var state, sub, cls;
    if(cur){
      var g=group(cur), last=g[g.length-1];
      cls='busy'; state='사용 중';
      sub=esc(who(cur))+' · ~'+(last.date!==t?(parseYmd(last.date).getMonth()+1)+'/'+parseYmd(last.date).getDate()+' ':'')+last.end;
    } else {
      cls='free'; state='사용 가능';
      sub=next?'다음 '+(next.date===t?'오늘':(parseYmd(next.date).getMonth()+1)+'/'+parseYmd(next.date).getDate())+' '+next.start:'예약 없음';
    }
    return '<div class="car-stat '+cls+'" data-act="carinfo" data-car="'+c.id+'">'+
      '<div class="cs-name"><span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+(c.plate?' <small>'+esc(c.plate)+'</small>':'')+'</div>'+
      '<div class="cs-state">'+state+'</div><div class="cs-sub">'+sub+'</div>'+
      (function(){ var pn=lastNote(c.id, t+n); return pn?'<div class="cs-sub" style="color:#854F0B;margin-top:3px"><i class="ti ti-note"></i> '+esc(pn.returnNote)+'</div>':''; })()+'</div>';
  }).join('')+'</div>'+(NOTICE?'<div class="notice">'+esc(NOTICE)+'</div>':'');
}
// 경로에서 들른 곳만 (회사·집·기타 빼고)
var ENDS=['회사','집','기타'];
function stopsOf(r){ return r.route?String(r.route).split('-').map(function(x){ return x.trim(); }).filter(function(x){ return x&&ENDS.indexOf(x)<0; }):(r.dest?[r.dest]:[]); }
function mainDest(route, fallback){ var a=stopsOf({route:route}); return a[0]||fallback||''; }
// 달력 표시: 운행일지에서 고친 경로를 그대로 따라감 (예: 홍길동 한미1공장 외1)
function placeLabel(r){ var a=stopsOf(r); return a.length?a[0]+(a.length>1?' 외'+(a.length-1):''):''; }
function evLabel(r){ if(r.type==='maint') return '정비'; var pl=placeLabel(r); return who(r)+(pl?' '+pl:''); }
function monthView(){
  var m=monthCursor, y=m.getFullYear(), mo=m.getMonth(), t=ymd(new Date());
  var first=new Date(y,mo,1).getDay(), last=new Date(y,mo+1,0).getDate();
  var h='<div class="cal-toolbar"><button class="btn sm" data-act="month" data-d="-1"><i class="ti ti-chevron-left"></i></button>'+
    '<span class="cal-toolbar-title">'+y+'년 '+(mo+1)+'월</span>'+
    '<button class="btn sm" data-act="month" data-d="1"><i class="ti ti-chevron-right"></i></button>'+
    '<button class="btn sm" data-act="month" data-d="0">오늘</button>'+
    '<span class="cal-legend">'+CARS.map(function(c){ return '<span><i style="background:'+c.bg+';border-color:'+c.color+'"></i>'+c.short+'</span>'; }).join('')+'</span></div>';
  var mob=isMobile();
  h+='<div class="cal-scroll"><div class="cal-grid'+(mob?' m':'')+'">';
  ['일','월','화','수','목','금','토'].forEach(function(d,i){ h+='<div class="cal-header" style="'+(i===0?'color:#C0392B;font-weight:700;':i===6?'color:#1A5276;font-weight:700;':'')+'">'+d+'</div>'; });
  for(var i=0;i<first;i++) h+='<div class="cal-day empty"></div>';
  for(var d=1;d<=last;d++){
    var key=y+'-'+pad(mo+1)+'-'+pad(d), dow=new Date(y,mo,d).getDay(), hol=getHoliday(key);
    var its=itemsOn(key);
    var color=dow===0?'color:#C0392B;':dow===6?'color:#1A5276;':'';
    if(mob){
      // 휴대폰: 칸마다 차 3대의 막대 (색 = 그날 예약 있음, 회색 = 하루 종일 비어 있음)
      h+='<div class="cal-day'+(key===t?' today':'')+(hol||dow===0?' holiday':'')+(dow===6?' sat':'')+(key===mobileSel?' sel':'')+(key<t?' past':'')+'" data-act="day" data-date="'+key+'">'+
         '<div class="cal-num" style="'+color+'">'+d+'</div>'+
         '<div class="mbars">'+CARS.map(function(c){ var n=its.filter(function(r){ return r.carId===c.id; }).length;
           return '<i style="background:'+(n?c.color:'#E8E8E4')+'"></i>'; }).join('')+'</div>'+
         (its.length?'<div class="mcnt">'+its.length+'건</div>':'')+'</div>';
      continue;
    }
    h+='<div class="cal-day'+(key===t?' today':'')+(hol||dow===0?' holiday':'')+(dow===6?' sat':'')+(key<t?' past':'')+'" data-act="day" data-date="'+key+'">'+
       '<div class="cal-num" style="'+color+'">'+d+'</div>'+(hol?'<div class="cal-hol">'+hol+'</div>':'')+
       its.slice(0,3).map(function(r){ var c=car(r.carId);
         return '<div class="cal-event" data-act="open" data-id="'+r.id+'" style="background:'+(r.type==='maint'?'#F0F0EC':c.bg)+';color:'+(r.type==='maint'?'#666':c.color)+';">'+
           (needsKm(r)?'<span class="ev-miss" title="계기판 숫자 비어 있음"></span>':'')+'<span class="ev-t">'+esc(evLabel(r))+'</span><span class="ev-c">'+c.short+'</span></div>'; }).join('')+
       (its.length>3?'<div class="cal-more" data-act="daylist" data-date="'+key+'">+'+(its.length-3)+'건</div>':'')+
       '</div>';
  }
  var cells=first+last; for(var k=cells;k%7;k++) h+='<div class="cal-day empty"></div>';
  h+='</div></div>';
  if(mob){
    var hol2=getHoliday(mobileSel);
    h+='<div class="mday"><div class="mday-h">'+dayLabel(mobileSel)+(hol2?' <span>'+hol2+'</span>':'')+'</div>'+dayListHtml(mobileSel)+'</div>';
  }
  return h;
}
function myList(){
  var t=ymd(new Date()), n=nowHM(), seenG={};
  var mine=list.filter(function(r){ return isMine(r)&&r.type!=='maint'&&(r.date>t||(r.date===t&&r.end>n)); })
    .sort(function(a,b){ return (a.date+a.start).localeCompare(b.date+b.start); })
    .filter(function(r){ if(!r.groupId) return true; if(seenG[r.groupId]) return false; seenG[r.groupId]=1; return true; });
  if(!mine.length) return '';
  // 차량 카드 바로 아래, 한 줄씩 짧게 (최대 3건)
  var more=mine.length-3;
  return '<div class="card-title" style="margin-top:18px;display:flex;justify-content:space-between">내 예약 <span style="font-weight:400;color:#888;font-size:12px">'+mine.length+'건</span></div>'+
    '<div style="background:#fff;border:.5px solid #e8e8e4;border-radius:12px;overflow:hidden;margin-bottom:16px">'+mine.slice(0,3).map(function(r,i){ var c=car(r.carId);
    return '<div data-act="open" data-id="'+r.id+'" style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;font-size:12px;'+(i?'border-top:.5px solid #f0f0ec;':'')+'">'+
      '<span style="color:#555;white-space:nowrap">'+esc(shortRangeFull(r))+'</span>'+
      '<b style="font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.dest||'-')+'</b>'+
      '<span class="badge-cat" style="background:'+c.bg+';color:'+c.color+';white-space:nowrap">'+c.short+'</span></div>'; }).join('')+
    (more>0?'<div style="padding:7px 12px;border-top:.5px solid #f0f0ec;font-size:11px;color:#888">그 외 '+more+'건 더 있어요</div>':'')+'</div>';
}
// 차 한 대의 하루 일정 + 빈 시간 (06:00~22:00, 오늘은 지금 이후만)
function carDayHtml(carId, date){
  var its=itemsOn(date,carId), t=ymd(new Date()), n=nowHM();
  var from=date===t?(n>'06:00'?n:'06:00'):'06:00', rows=[], cur=from;
  its.forEach(function(r){
    if(r.start>cur&&toMin(r.start)-toMin(cur)>=30) rows.push({ free:true, s:cur, e:r.start });
    rows.push({ r:r });
    if(r.end>cur) cur=r.end;
  });
  if(cur<'22:00'&&toMin('22:00')-toMin(cur)>=30) rows.push({ free:true, s:cur, e:'22:00' });
  if(!rows.length) return '<div style="font-size:12px;color:#999;padding:6px 0">예약 가능한 시간이 지났어요.</div>';
  return rows.map(function(x){
    if(x.free) return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:.5px solid #f0f0ec;font-size:12px;color:#3B6D11"><b style="min-width:92px">'+(!its.length?(from!=='06:00'?'지금 이후':'하루 종일'):x.s+'–'+x.e)+'</b>비어 있음</div>';
    var r=x.r, done=!!r.returnedAt||(date<t)||(date===t&&r.end<=n);
    return '<div data-act="open" data-id="'+r.id+'" style="display:flex;gap:10px;padding:8px 0;border-bottom:.5px solid #f0f0ec;font-size:12px;cursor:pointer"><b style="min-width:92px;font-size:13px">'+r.start+'–'+r.end+'</b>'+
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(who(r))+' · '+esc(r.dest||'-')+'</span>'+(done?'<span style="color:#999">'+(r.returnedAt?'반납됨':'끝남')+'</span>':'')+'</div>';
  }).join('');
}
function shortRangeFull(r){
  var g=group(r), a=g[0], b=g[g.length-1];
  function md(x){ var d=parseYmd(x); return (d.getMonth()+1)+'/'+d.getDate()+'('+DOW[d.getDay()]+')'; }
  return g.length>1 ? md(a.date)+' '+a.start+' ~ '+md(b.date)+' '+b.end : md(a.date)+' '+a.start+'–'+a.end;
}

// 그날 예약 목록 (PC 팝업 · 휴대폰 달력 아래 공용)
function dayListHtml(date){
  var its=itemsOn(date), past=date<ymd(new Date());
  return (its.length?its.map(function(r){ var c=car(r.carId);
      return '<div class="cal-sup-item" data-act="open" data-id="'+r.id+'"><div><div class="sup-biz">'+esc(r.dest||'-')+'</div><div class="sup-row-sub">'+r.start+'–'+r.end+' · '+esc(who(r))+(r.purpose?' · '+esc(r.purpose):'')+'</div></div>'+
        '<span class="badge-cat" style="background:'+c.bg+';color:'+c.color+'">'+c.short+'</span></div>'; }).join(''):'<div class="empty-state">예약이 없어요 · 모든 차 사용 가능</div>')+
    '<button class="btn primary full" data-act="new" data-date="'+date+'"><i class="ti ti-plus"></i> '+(past?'이 날 지난 운행 추가':'이 날 예약 등록')+'</button>';
}
// 휴대폰 화면 여부 (폭 600px 이하)
var mq=window.matchMedia('(max-width:600px)');
function isMobile(){ return false; } // 휴대폰도 운영지원 달력과 같은 모양으로
try{ mq.addEventListener('change',function(){ if(me&&!form) render(); }); }catch(e){}
var mobileSel=ymd(new Date());
// ── 팝업: 예약 상세 / 그날 목록 (운영지원 달력 팝업과 같은 모양) ──────────────
var popup=null; // {type:'detail', id} | {type:'day', date}
function renderPopup(){
  var el=document.getElementById('popup');
  if(!popup){ el.className='cal-popup'; el.innerHTML=''; return; }
  // 화면이 새로 그려져도 쓰던 반납 메모는 유지
  keepPopupVals();
  var h='';
  if(popup.type==='detail'){
    var r=list.filter(function(x){ return x.id===popup.id; })[0];
    if(!r){ popup=null; el.className='cal-popup'; el.innerHTML=''; return; }
    var g=group(r), c=car(r.carId), edit=canEdit(r), others=isAdmin()&&r.ownerPhone!==me.phone&&(r.riderPhones||[]).indexOf(me.phone)<0;
    var inUse=g.some(function(x){ var t=ymd(new Date()), n=nowHM(); return x.date===t&&x.start<=n&&n<x.end; });
    var callP=(r.riderPhones&&r.riderPhones[0])||r.ownerPhone, callN=r.riders&&r.riders[0]?short1(r.riders[0]):short1(r.ownerName);
    h='<div class="cal-popup-inner"><div class="cal-popup-header"><h4><span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+(r.purpose?' <span class="badge-cat">'+esc(r.purpose)+'</span>':'')+'</h4><button class="btn sm" data-act="pclose"><i class="ti ti-x"></i></button></div>'+
      '<div class="cal-popup-body"><div class="dl">'+
      '<div><span>업장</span><b>'+esc(r.dest||'-')+'</b></div>'+(r.route&&stopsOf(r).length>1?'<div><span>경로</span>'+esc(r.route)+'</div>':'')+
      '<div><span>일시</span><div><b>'+esc(rangeText(g))+'</b>'+(r.returnedAt?' <span class="badge-cat" style="background:#EAF3DE;color:#3B6D11">'+esc(r.returnedAt)+' 반납 완료</span>':'')+'</div></div>'+
      '<div><span>운전자</span><b>'+esc(whoFull(r))+'</b></div>'+
      (r.riders&&r.riders.length&&r.ownerName?'<div><span>등록</span>'+esc(r.ownerName)+(r.ownerPhone===me.phone?' (나)':'')+'</div>':'')+
      (r.memo?'<div><span>상세 내용</span>'+esc(r.memo)+'</div>':'')+
      kmLine(r)+
      (r.returnNote?'<div><span>반납 메모</span><b style="color:#854F0B">'+esc(r.returnNote)+'</b></div>':'')+
      (function(){ if(r.returnedAt) return ''; var pn=lastNote(r.carId, g[0].date+g[0].start, r.id); return pn?'<div><span>직전 메모</span><span style="color:#854F0B">'+esc(pn.returnNote)+' <small style="color:#999">('+esc(who(pn))+', '+(parseYmd(pn.date).getMonth()+1)+'/'+parseYmd(pn.date).getDate()+')</small></span></div>':''; })()+'</div>'+
      (edit?(others?'<div class="warn">다른 사람 예약이에요. 관리자 권한으로 수정·취소할 수 있어요.</div>':'')+
        kmBox(r, g, inUse)+
        '<div style="text-align:right;margin:-4px 0 8px"><button class="btn sm" data-act="golog" data-id="'+r.id+'"><i class="ti ti-notebook"></i> 운행일지에서 보기</button></div>'+
        '<div class="pbtns"><button class="btn" data-act="edit" data-id="'+r.id+'"><i class="ti ti-pencil"></i> 수정</button><button class="btn danger" data-act="cancel" data-id="'+r.id+'"><i class="ti ti-trash"></i> 예약 취소</button></div>'
        :(callP?'<div class="pbtns"><a class="btn" href="tel:'+esc(callP)+'"><i class="ti ti-phone"></i> '+esc(callN)+'에게 전화 ('+telFmt(callP)+')</a></div><div class="hint">다른 사람 예약은 보기만 가능해요.</div>':''))+
      '</div></div>';
  } else if(popup.type==='km'){
    var rk=list.filter(function(x){ return x.id===popup.id; })[0];
    if(!rk){ popup=null; el.className='cal-popup'; el.innerHTML=''; return; }
    h=kmSheet(rk);
  } else if(popup.type==='car'){
    var cc=car(popup.carId), t0=ymd(new Date()), t1=ymd(addDays(new Date(),1)), nn=nowHM();
    var busyNow=itemsOn(t0,cc.id).some(function(x){ return x.start<=nn&&nn<x.end&&!x.returnedAt; });
    h='<div class="cal-popup-inner"><div class="cal-popup-header"><h4><span class="cs-dot" style="background:'+cc.color+'"></span>'+cc.name+' 일정 <span style="font-size:12px;font-weight:500;color:'+(busyNow?'#A32D2D':'#3B6D11')+'">'+(busyNow?'지금 사용 중':'지금 사용 가능')+'</span></h4><button class="btn sm" data-act="pclose"><i class="ti ti-x"></i></button></div>'+
      '<div class="cal-popup-body">'+
      '<div style="font-size:12px;font-weight:600;color:#555;margin-bottom:2px">오늘 '+dayLabel(t0)+'</div>'+carDayHtml(cc.id,t0)+
      '<div style="font-size:12px;font-weight:600;color:#555;margin:12px 0 2px">내일 '+dayLabel(t1)+'</div>'+carDayHtml(cc.id,t1)+
      '<button class="btn primary full" style="margin-top:14px" data-act="new" data-car="'+cc.id+'"><i class="ti ti-plus"></i> 이 차로 예약하기</button>'+
      '</div></div>';
  } else {
    h='<div class="cal-popup-inner"><div class="cal-popup-header"><h4>'+dayLabel(popup.date)+'</h4><button class="btn sm" data-act="pclose"><i class="ti ti-x"></i></button></div><div class="cal-popup-body">'+
      dayListHtml(popup.date)+'</div></div>';
  }
  el.className='cal-popup open'; el.innerHTML=h;
}

// ── 예약 등록 (운영지원 등록과 같은 단계형 모달) ──────────────────
function openForm(opts){
  opts=opts||{};
  var g=opts.edit?group(opts.edit):null, a=g&&g[0], b=g&&g[g.length-1];
  var date=a?a.date:(opts.date||'');
  form={
    editIds:g?g.map(function(x){ return x.id; }):[], olds:g||[],
    date:date, endDate:b?b.date:date, slot:a?'custom':null,
    start:a?a.start:'', end:b?b.end:'',
    carIds:a?[a.carId]:(opts.car?[opts.car]:[]), drivers:{},
    dest:a?(a.dest||''):'', destPicked:!!(a&&a.dest), purpose:a?(a.purpose||''):'',
    memo:a?(a.memo||''):'',
    maint:a?a.type==='maint':false, busy:false, open:!!a, _n:0,
    multiDay:!!(a&&b&&b.date>a.date)
  };
  if(a&&a.riders&&a.riders[0]) form.drivers[a.carId]=a.riders[0];
  if(!a&&opts.car){ var myN=myStaffName(); if(myN) form.drivers[opts.car]=myN; }
  pushLayer(); popup=null; renderPopup(); renderForm();
}
function pushLayer(){ try{ if(history.state&&history.state.layer) history.replaceState({layer:1},''); else history.pushState({layer:1},''); }catch(e){} }
function popLayer(){ try{ if(history.state&&history.state.layer) history.back(); }catch(e){} }
function datesBetween(a,b){ var out=[], d=parseYmd(a), e=parseYmd(b<a?a:b); while(d<=e&&out.length<31){ out.push(ymd(d)); d=addDays(d,1); } return out; }
function formSegs(){ return segsOf(form.date, form.endDate, form.start, form.end); }
function formValid(){ return !!(form.date&&form.start&&form.end)&&(form.endDate>form.date||form.end>form.start); }
function conflictsFor(carId){
  var segs=formSegs();
  for(var i=0;i<segs.length;i++){
    var s=segs[i], hit=itemsOn(s.date,carId).filter(function(r){ return form.editIds.indexOf(r.id)<0&&overlaps(r,s); })[0];
    if(hit) return { r:hit, date:s.date };
  }
  return null;
}
var SEL_STYLE='padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;width:100%;background:#fff;color:#1a1a18;font-family:inherit;';
// 30분 단위 시간 선택 (06:00 ~ 22:00)
var TIME_OPTS=(function(){ var o=[]; for(var m=6*60;m<=22*60;m+=30) o.push(pad(Math.floor(m/60))+':'+pad(m%60)); return o; })();
function timeSelect(f,v){
  var opts=TIME_OPTS.slice(); if(v&&opts.indexOf(v)<0){ opts.push(v); opts.sort(); }
  return '<select data-f="'+f+'" style="'+SEL_STYLE+'">'+
    (v?'':'<option value="">선택</option>')+opts.map(function(t){ return '<option'+(t===v?' selected':'')+'>'+t+'</option>'; }).join('')+'</select>';
}
// 소속 이름 (FS 앱 직원 관리와 같은 순서)
var DEPT_ORDER=['운영','CS','지원','관리','영업'];
var DEPT_NAME={ '운영':'운영팀 (FS)', 'CS':'운영팀 (CS)', '지원':'지원팀', '관리':'관리팀', '영업':'영업팀' };
function myStaffName(){
  var x=staffList.filter(function(s){ return s.p&&s.p===me.phone; })[0]
     ||staffList.filter(function(s){ return short1(s.n)===myShort(); })[0];
  return x?x.n:'';
}
function myShort(){ return String(me.name||'').split(' ')[0]; }
function grp(label, body, opt){ return '<div class="sup-form-group"><label>'+label+(opt?' <span class="opt">'+opt+'</span>':'')+'</label>'+body+'</div>'; }
function renderForm(){
  var el=document.getElementById('form');
  if(!form){ el.className='sup-modal'; el.innerHTML=''; return; }
  var multi=!!form.date&&form.endDate>form.date, valid=formValid(), op=form.open;
  var cars=CARS.map(function(c){ return { c:c, cf:valid?conflictsFor(c.id):null }; });
  // 시간을 바꿔서 겹치게 된 차는 선택에서 뺌
  form.carIds=form.carIds.filter(function(id){ return !cars.some(function(x){ return x.c.id===id&&x.cf; }); });
  var driversOk=form.carIds.length>0&&form.carIds.every(function(id){ return !!form.drivers[id]; });

  // 단계별로 하나씩 열림 (수정할 때는 전부 보임)
  var s2=!!form.date;                                    // 시간(오전/오후/종일)
  var s3=s2&&(op||multi||!!form.slot);                   // 출발·반납 시간
  var s4=s3&&valid;                                      // 차량
  var s5=s4&&driversOk;                                  // 업장 (차·운전자 다 고른 뒤)
  var s6=s5&&!!form.dest.trim();
  var s6u=s6;                                            // 카테고리
  var s7=s6u&&!!form.purpose;                            // 상세 내용
  var canSave=s7&&!form.busy;

  var h='<div class="sup-modal-inner"><div class="sup-modal-header"><h3>'+(form.editIds.length?'차량 예약 수정':'차량 예약 등록')+'</h3><button class="btn sm" data-act="fclose"><i class="ti ti-x"></i></button></div><div class="sup-modal-body" id="form-body">';
  // 종료일은 "여러 날 사용"을 체크했을 때만
  h+='<div class="g2">'+
     grp('시작일 *','<input type="date" value="'+form.date+'" data-f="date">')+
     (form.multiDay?grp('종료일 *','<input type="date" min="'+form.date+'" value="'+(multi?form.endDate:'')+'" data-f="endDate"'+(form.date?'':' disabled')+'>'):'<div></div>')+'</div>'+
     '<label style="display:flex;align-items:center;gap:7px;font-size:13px;margin:-4px 0 10px;cursor:pointer;width:max-content"><input type="checkbox" data-f="multiDay" style="width:16px;height:16px;margin:0"'+(form.multiDay?' checked':'')+'> 여러 날 사용</label>'+
     (form.date?'<div class="dayb">'+dayLabel(form.date)+(multi?' ~ '+dayLabel(form.endDate)+' · '+datesBetween(form.date,form.endDate).length+'일':'')+'</div>':'');
  if(s2&&!multi){
    h+='<div class="step"><div class="g2">'+grp('시간대 *','<select data-f="slotSel" style="'+SEL_STYLE+'">'+(form.slot?'':'<option value="">선택...</option>')+
      Object.keys(SLOTS).map(function(k){ var t=SLOTS[k]; return '<option value="'+k+'"'+(form.slot===k?' selected':'')+'>'+t.label+' ('+t.s+'–'+t.e+')</option>'; }).join('')+
      '<option value="custom"'+(form.slot==='custom'?' selected':'')+'>직접 선택</option></select>')+'<div></div></div></div>';
  }
  if(s3){
    h+='<div class="step"><div class="g2">'+
       grp('출발 시간 *'+(multi?' (첫날)':''),timeSelect('start',form.start))+
       grp('반납 시간 *'+(multi?' (마지막 날)':''),timeSelect('end',form.end))+'</div>'+
       (form.start&&form.end&&!valid?'<div class="err">반납 시간이 출발보다 늦어야 해요.</div>':'')+'</div>';
  }
  if(s4){
    var multiOk=!form.editIds.length;
    h+='<div class="step">'+grp('차량 *','<div class="carpicks">'+cars.map(function(x){ var c=x.c, on=form.carIds.indexOf(c.id)>=0;
      return '<div class="carpick'+(x.cf?' no':on?' on':'')+'" data-act="car" data-car="'+c.id+'" style="'+(on?'border-color:'+c.color+';background:'+c.bg+';':'')+'">'+
        '<div class="cp-n"><span class="cs-dot" style="background:'+(x.cf?'#ccc':c.color)+'"></span>'+c.name+(on?' <i class="ti ti-check" style="margin-left:auto;color:'+c.color+'"></i>':'')+'</div>'+
        '<div class="cp-s'+(x.cf?' bad':'')+'" style="font-size:12px">'+(x.cf?esc(who(x.cf.r))+' '+x.cf.r.start+'–'+x.cf.r.end+(x.cf.date!==form.date?' ('+(parseYmd(x.cf.date).getMonth()+1)+'/'+parseYmd(x.cf.date).getDate()+')':''):'비어 있음')+'</div></div>'; }).join('')+'</div>'+
      (cars.every(function(x){ return x.cf; })?'<div class="err">이 시간엔 빈 차가 없어요. 시간을 바꿔보세요.</div>':''), multiOk?'(여러 대 선택 가능)':'');
    // 고른 차마다 운전자 1명
    if(form.carIds.length){
      var people=staffList.slice();
      Object.keys(form.drivers).forEach(function(k){ var n=form.drivers[k]; if(n&&!people.some(function(x){ return x.n===n; })) people.push({ n:n, g:'' }); });
      var groups=[]; people.forEach(function(x){ if(groups.indexOf(x.g)<0) groups.push(x.g); });
      groups.sort(function(a,b){ var ia=DEPT_ORDER.indexOf(a), ib=DEPT_ORDER.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
      h+=grp('운전자 *', form.carIds.map(function(id){
          var c=car(id), mine=form.drivers[id]||'';
          var taken=form.carIds.filter(function(o){ return o!==id; }).map(function(o){ return form.drivers[o]; });
          return '<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center;margin-bottom:6px;"><span style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;"><span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+'</span>'+
            '<select data-f="driver" data-car="'+id+'" style="'+SEL_STYLE+'">'+(mine?'':'<option value="">운전자 선택...</option>')+
            groups.map(function(g){ var opts=people.filter(function(x){ return x.g===g&&(x.n===mine||taken.indexOf(x.n)<0); });
              if(!opts.length) return '';
              return '<optgroup label="'+esc(DEPT_NAME[g]||g||'기타')+'">'+opts.map(function(x){ return '<option'+(x.n===mine?' selected':'')+'>'+esc(x.n)+'</option>'; }).join('')+'</optgroup>'; }).join('')+
            '</select></div>';
        }).join('')+(people.length?'':'<div class="hint l">직원 목록을 불러오는 중이에요…</div>'),'(차 1대당 1명)');
    }
    h+='</div>';
  }
  if(s5){
    h+='<div class="step">'+grp('업장 선택 *','<div class="searchable-select"><input id="f-dest" type="text" autocomplete="off" placeholder="업장명 검색..." value="'+esc(form.dest)+'" data-f="dest"><div id="dest-sug" class="ss-dropdown"></div></div>')+'</div>';
  }
  if(s6u){
    h+='<div class="step"><div class="g2">'+grp('카테고리 *','<select data-f="purpose" style="'+SEL_STYLE+'">'+(form.purpose?'':'<option value="">선택...</option>')+
      PURPOSES.map(function(p){ return '<option'+(form.purpose===p?' selected':'')+'>'+p+'</option>'; }).join('')+'</select>')+'<div></div></div></div>';
  }
  if(s7){
    h+='<div class="step">'+grp('상세 내용','<textarea placeholder="용무 간략히 (짐, 특이사항 등)" data-f="memo">'+esc(form.memo)+'</textarea>')+'</div>';
  }
  var hint=!s2?'시작일을 골라주세요.':!s3?'시간을 골라주세요.':!s4?'출발·반납 시간을 확인해주세요.':!s5?(form.carIds.length?'운전자를 골라주세요.':'차량을 골라주세요.'):!s6?'업장을 골라주세요.':!s7?'카테고리를 골라주세요.':esc(rangeText(formSegs()))+' · '+form.carIds.map(function(id){ return car(id).name; }).join(', ');
  h+='</div><div class="sup-modal-footer"><span class="foot-hint">'+hint+'</span><button class="btn" data-act="fclose">취소</button><button class="btn primary" data-act="save"'+(canSave?'':' disabled')+'>'+(form.busy?'저장 중…':form.editIds.length?'수정 저장':'등록')+'</button></div></div>';
  var prev=document.getElementById('form-body'), y=prev?prev.scrollTop:0, before=form._n||0;
  el.className='sup-modal open'; el.innerHTML=h;
  var body=document.getElementById('form-body'); body.scrollTop=y;
  var steps=body.querySelectorAll('.step'); form._n=steps.length;
  if(steps.length>before&&before>0){ var lastS=steps[steps.length-1]; lastS.classList.add('sup-step-anim'); setTimeout(function(){ lastS.scrollIntoView({behavior:'smooth',block:'nearest'}); },80); }
}
// 고른 날짜의 예약 현황
function dayBookings(){
  var its=itemsOn(form.date).filter(function(r){ return form.editIds.indexOf(r.id)<0; });
  if(!its.length) return '<div class="dayb-row free">이 날은 모든 차가 비어 있어요.</div>';
  return its.map(function(r){ var c=car(r.carId);
    return '<div class="dayb-row"><i style="background:'+c.color+'"></i>'+c.short+' · '+r.start+'–'+r.end+' · '+esc(who(r))+'</div>'; }).join('');
}
// 업장 선택: 운영지원 일정 등록과 같은 방식. 칸을 누르면 전체 목록, 글자를 치면 걸러짐.
// 목록에 없는 곳은 맨 아래 "직접 입력"으로 그대로 쓸 수 있음.
var FIXED_SITES = ['온정본사','온정CS'];
function destSug(q){
  q=String(q||'').trim();
  var ql=q.replace(/\s/g,'').toLowerCase();
  var m=function(n){ return !ql||n.replace(/\s/g,'').toLowerCase().indexOf(ql)>=0; };
  var names=[]; FIXED_SITES.concat(sites).forEach(function(n){ if(n&&names.indexOf(n)<0) names.push(n); });
  var past=[]; list.forEach(function(r){ if(r.dest&&names.indexOf(r.dest)<0&&past.indexOf(r.dest)<0) past.push(r.dest); });
  function opt(n,k,direct){ return '<div class="ss-option'+(direct?' direct':'')+'" data-act="dpick" data-v="'+esc(n)+'">'+(direct?'"'+esc(n)+'" 직접 입력':esc(n))+(k?'<small>'+k+'</small>':'')+'</div>'; }
  var html=names.filter(m).map(function(n){ return opt(n,''); }).join('')+past.filter(m).map(function(n){ return opt(n,'지난 행선지'); }).join('');
  if(q&&names.indexOf(q)<0&&past.indexOf(q)<0) html+=opt(q,'',true);
  return html||'<div class="ss-option" style="color:#aaa;">없음</div>';
}
function openSug(){
  var sg=document.getElementById('dest-sug'); if(!sg||!form) return;
  sg.innerHTML=destSug(form.destPicked?'':form.dest); sg.classList.add('open'); sg.scrollTop=0;
}
// 예약 수정에서 업장을 바꾸면 경로의 첫 업장도 같이 바꿈
function syncRoute(o, dest){
  if(!o.route) return '';
  var parts=String(o.route).split('-').map(function(x){ return x.trim(); }).filter(Boolean);
  var i=parts.indexOf(o.dest); if(i<0) i=parts.findIndex(function(x){ return ENDS.indexOf(x)<0; });
  if(i<0) parts.unshift(dest); else parts[i]=dest;
  return parts.join('-');
}
async function submitForm(){
  if(!form||!form.carIds.length||!formValid()) return;
  var segs=formSegs(), o0=form.olds[0];
  var rs=form.carIds.map(function(id){ var d=form.drivers[id]||''; return { carId:id, segs:segs, type:'use',
          dest:form.dest.trim(), purpose:form.purpose, riders:d?[d]:[], riderPhones:d&&phoneOf(d)?[phoneOf(d)]:[], memo:form.memo.trim(),
          returnedAt:(o0&&o0.returnedAt)||'', returnNote:(o0&&o0.returnNote)||'',
          startKm:o0?o0.startKm:null, endKm:o0?o0.endKm:null, fuel:o0?o0.fuel:0, origin:o0?o0.origin:'', route:o0?syncRoute(o0, form.dest.trim()):'', toll:o0?o0.toll:0, lateAdd:o0?!!o0.lateAdd:tKey(segs[0].date,segs[0].start)<tKey(ymd(new Date()),nowHM()) }; });
  var olds=form.olds; form.busy=true; renderForm();
  try{
    await saveReservation(rs, olds);
    var late=!olds.length&&rs[0].lateAdd;
    toast(late?'지난 운행을 추가했어요. 운행일지에서 줄을 눌러 숫자를 적어주세요.':olds.length?'예약을 수정했어요.':(rs.length>1?rs.length+'대 예약했어요.':'예약했어요.'));
    if(view==='log'&&logState){ logState.ym=segs[0].date.slice(0,7); if(logState.ym.slice(0,4)!==logState.loadedY){ logState.pool=null; } }
    var d0=parseYmd(segs[0].date); form=null; monthCursor=firstOfMonth(d0); render(); popLayer();
  }catch(e){
    console.error(e); form.busy=false;
    if(e.message==='CONFLICT') toast('방금 '+(e.carId?car(e.carId).name+'을(를) ':'')+(e.hit&&e.hit.who?e.hit.who+'님이 ':'다른 사람이 ')+'먼저 예약했어요. 아무것도 저장되지 않았어요. 다른 시간이나 차를 골라주세요.');
    else if(e.code==='permission-denied') toast('권한이 없어요. 관리자에게 문의해주세요.');
    else toast('저장하지 못했어요. 인터넷 연결을 확인해주세요.');
    renderForm();
  }
}

// ── 운행일지 · 계기판 km ──────────────────────────
// 운전자는 반납할 때 "도착 km"만 적는다. 출발 km = 바로 앞 운행의 도착 km (없으면 다음 사람이 자기 출발 km로 채움).
// 기록은 관리자가 그 차의 지금 계기판 km를 처음 넣은 날(since)부터 시작된다.
function numOrNull(v){ return v==null||v===''||isNaN(+v)?null:+v; }
function parseKm(v){ v=String(v==null?'':v).replace(/[^0-9]/g,''); return v?+v:null; }
function fmtKm(n){ return n==null?'—':Number(n).toLocaleString(); }
function kmOn(carId){ return true; }   // 계기판 숫자는 모든 차에서 항상 적을 수 있음
function tKey(date,hm){ return date+' '+hm; }
function poolGroup(pool,r){ if(!r.groupId) return [r]; return pool.filter(function(x){ return x.groupId===r.groupId; }).sort(function(a,b){ return a.date.localeCompare(b.date); }); }
// 차 한 대의 운행 목록 (여러 날 예약은 하나로), 시작 시각 순
function tripsOf(pool, carId){
  var seen={}, out=[];
  pool.filter(function(r){ return r.carId===carId&&r.type!=='maint'; }).sort(function(a,b){ return tKey(a.date,a.start).localeCompare(tKey(b.date,b.start)); })
    .forEach(function(r){ if(r.groupId){ if(seen[r.groupId]) return; seen[r.groupId]=1; } out.push(r); });
  return out;
}
function tripStart(pool,r){ var g=poolGroup(pool,r); return tKey(g[0].date,g[0].start); }
function tripEnd(pool,r){ var g=poolGroup(pool,r), b=g[g.length-1]; return tKey(b.date,b.end); }
function prevTrip(pool,r){
  var st=tripStart(pool,r), best=null, bk='';
  tripsOf(pool,r.carId).forEach(function(x){ if(x.id===r.id||(r.groupId&&x.groupId===r.groupId)) return; var e=tripEnd(pool,x); if(e<=st&&e>bk){ best=x; bk=e; } });
  return best;
}
function nextTrip(pool,r){
  var en=tripEnd(pool,r), best=null, bk='9';
  tripsOf(pool,r.carId).forEach(function(x){ if(x.id===r.id||(r.groupId&&x.groupId===r.groupId)) return; var s0=tripStart(pool,x); if(s0>=en&&s0<bk){ best=x; bk=s0; } });
  return best;
}
// 출발 km: 직접 적은 값 → 앞 운행 도착 km(또는 앞 운행 출발에서 더 앞 사람) → 관리자가 넣은 기준 km
function startKmOf(pool,r){
  if(r.startKm!=null) return r.startKm;
  var st=tripStart(pool,r), p=prevTrip(pool,r), ck=carKm[r.carId], pe=p?tripEnd(pool,p):'';
  // 관리자가 계기판을 맞춘 시점이 앞 운행보다 뒤면 그 숫자부터
  if(ck&&ck.baseAt&&ck.baseAt<=st&&ck.baseAt>=pe) return ck.baseKm;
  if(p) return p.endKm!=null?p.endKm:null;
  return null;
}
function endKmOf(pool,r){
  if(r.endKm!=null) return r.endKm;
  var n=nextTrip(pool,r); return n&&n.startKm!=null?n.startKm:null;
}
function isEnded(pool,r){ return !!r.returnedAt||tripEnd(pool,r)<=tKey(ymd(new Date()),nowHM()); }
// 기록 대상 운행인지 (기록 시작일 이후, 일반 예약)
// 숫자가 '꼭 있어야 하는' 운행인지 (KM_SINCE 또는 관리자가 기록 시작한 날 이후)
function inLog(pool,r){ var ck=carKm[r.carId], since=(ck&&ck.since)||KM_SINCE; return r.type!=='maint'&&poolGroup(pool,r)[0].date>=since; }
function needsKm(r){ return inLog(list,r)&&isEnded(list,r)&&endKmOf(list,r)==null; }

// 내가 숫자를 적어야 하는 운행: 지금 타고 있는 차(운행 중) + 끝났는데 비어 있는 것
function inUseNow(r){ var g=group(r), t=ymd(new Date()), n=nowHM(); return !r.returnedAt&&g.some(function(x){ return x.date===t&&x.start<=n&&n<x.end; }); }
function myMissing(){
  var out=[]; CARS.forEach(function(c){ tripsOf(list,c.id).forEach(function(r){ if(isMine(r)&&canEdit(r)&&needsKm(r)) out.push(r); }); });
  return out.sort(function(a,b){ return tripStart(list,b).localeCompare(tripStart(list,a)); });
}
function myDriving(){
  var out=null; CARS.forEach(function(c){ tripsOf(list,c.id).forEach(function(r){ if(!out&&isMine(r)&&canEdit(r)&&inLog(list,r)&&inUseNow(r)&&r.endKm==null) out=r; }); });
  return out;
}
function tripWhen(r){ var g=group(r), a=g[0], b=g[g.length-1], d=parseYmd(a.date), t=ymd(new Date());
  return (a.date===t?'오늘':(d.getMonth()+1)+'/'+d.getDate()+' ('+DOW[d.getDay()]+')')+' '+a.start+' – '+(g.length>1?(parseYmd(b.date).getMonth()+1)+'/'+parseYmd(b.date).getDate()+' ':'')+b.end; }
var CAR_IC='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14M6 17l1.5-6h9L18 17M7 17v2M17 17v2"/></svg>';
function missingBanner(){
  var drv=myDriving(), miss=myMissing();
  var h='';
  if(drv){ var c=car(drv.carId);
    h+='<div style="background:#fff;border:1.5px solid #185FA5;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 2px 10px rgba(24,95,165,.12)">'+
      '<div style="font-size:12px;color:#185FA5;font-weight:600;display:flex;align-items:center;gap:6px">'+CAR_IC+'지금 내가 타고 있는 차</div>'+
      '<div style="font-size:16px;font-weight:700;margin:4px 0 2px">'+c.name+' · '+esc(drv.dest||'-')+'</div>'+
      '<div style="font-size:12px;color:#777;margin-bottom:12px">'+esc(tripWhen(drv))+' · 내리면 운행종료 숫자만 적으면 돼요</div>'+
      '<button class="btn primary full" style="margin:0;padding:13px;font-size:16px;font-weight:700;justify-content:center" data-act="kmopen" data-id="'+drv.id+'">운행 기록 적기</button></div>';
  }
  if(miss.length){ var r=miss[0], c2=car(r.carId);
    h+='<div style="background:#fff;border:1.5px solid #E24B4A;border-radius:14px;padding:14px;margin-bottom:12px">'+
      '<div style="font-size:12px;color:#A32D2D;font-weight:600">계기판 숫자가 비어 있어요'+(miss.length>1?' · '+miss.length+'건':'')+'</div>'+
      '<div style="font-size:15px;font-weight:700;margin:4px 0 2px">'+c2.name+' · '+esc(r.dest||'-')+'</div>'+
      '<div style="font-size:12px;color:#777;margin-bottom:12px">'+esc(tripWhen(r))+' · 그때 내릴 때 본 숫자를 적어주세요</div>'+
      '<button class="btn primary full" style="margin:0;padding:13px;font-size:16px;font-weight:700;justify-content:center" data-act="kmopen" data-id="'+r.id+'">운행 기록 적기</button></div>';
  }
  return h;
}
// 상세 창: 주행 기록 한 줄
function kmLine(r){
  if(!inLog(list,r)) return '';
  var s0=startKmOf(list,r), e0=endKmOf(list,r);
  if(e0==null&&s0==null) return '';
  var byNext=r.endKm==null&&e0!=null;
  return '<div><span>주행</span><span>'+fmtKm(s0)+' → '+fmtKm(e0)+' km'+(s0!=null&&e0!=null?' <b>('+(e0-s0).toLocaleString()+' km)</b>':'')+
    (byNext?' <small style="color:#999">다음 사람이 채움</small>':'')+(r.fuel?' · 주유 '+Number(r.fuel).toLocaleString()+'원':'')+'</span></div>';
}
// 상세 창: 입력칸 값이 화면 갱신에도 남도록
function keepPopupVals(){
  if(!popup) return; popup.vals=popup.vals||{}; readStops();
  ['ret-note','km-start','km-end','km-fuel','km-origin','km-route','km-toll'].forEach(function(id){ var e=document.getElementById(id); if(e&&e.getAttribute('data-for')===popup.id) popup.vals[id]=e.value; });
  var fc=document.getElementById('km-fuelchk'); if(fc&&fc.getAttribute('data-for')===popup.id) popup.vals.fuelOn=fc.checked;
}
function pv(id,def){ return popup&&popup.vals&&popup.vals[id]!=null?popup.vals[id]:(def==null?'':def); }
var KM_IN='width:100%;padding:9px 12px;border:1px solid #185FA5;border-radius:8px;font-size:18px;font-weight:700;background:#fff;color:#1a1a18;';
var SM_IN='width:100%;padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;background:#fff;color:#1a1a18;';
// 상세 창: 운행 기록 버튼 (입력은 숫자 입력 창에서)
function kmBox(r, g, inUse){
  var on=r.type!=='maint', ended=isEnded(list,r);
  if(!on){
    if(!inUse) return '';
    return '<div style="background:#F7FAFD;border:.5px solid #DCE9F5;border-radius:10px;padding:10px;margin:0 0 10px">'+
      '<div style="font-size:12px;font-weight:600;margin:0 0 6px">반납 메모 <span style="font-weight:400;color:#888;font-size:11px">(선택 · 다음 사람이 봐요)</span></div>'+
      '<textarea id="ret-note" data-for="'+r.id+'" maxlength="200" placeholder="예: 주유 필요, 뒷범퍼 긁힘, 주차 B구역" style="'+SM_IN+'min-height:48px;resize:vertical;margin-bottom:8px">'+esc(pv('ret-note'))+'</textarea>'+
      '<button class="btn primary full" style="margin:0" data-act="return" data-id="'+r.id+'"><i class="ti ti-key"></i> 지금 반납 완료</button></div>';
  }
  if(inUse||(ended&&endKmOf(list,r)==null))
    return '<button class="btn primary full" style="margin:0 0 10px;padding:12px;font-size:15px;font-weight:700;justify-content:center" data-act="kmopen" data-id="'+r.id+'">운행 기록 적기</button>';
  if(ended) return '<div style="text-align:right;margin:-6px 0 8px"><button class="btn sm" data-act="kmopen" data-id="'+r.id+'"><i class="ti ti-pencil"></i> 운행 기록 고치기</button></div>';
  return '';
}
// 계기판 숫자 입력 창: 큰 숫자 칸 하나 + 주유 체크 + (선택) 메모
function isFutureTrip(r){ return tripStart(list,r)>tKey(ymd(new Date()),nowHM()); }
function planSheet(r){
  var c=car(r.carId);
  return '<div class="cal-popup-inner" style="width:440px"><div class="cal-popup-header"><h4><span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+' 운행 계획</h4><button class="btn sm" data-act="pclose"><i class="ti ti-x"></i></button></div><div class="cal-popup-body">'+
    '<div style="font-size:13px;margin-bottom:2px"><b>'+esc(tripWhen(r))+'</b> · '+esc(r.dest||'-')+'</div>'+
    '<div style="font-size:12px;color:#777;margin-bottom:12px">경로를 미리 적어둘 수 있어요. 계기판 숫자는 다녀와서 적어요.</div>'+routeFields(r)+
    '<button class="btn primary full" style="margin:4px 0 0;padding:13px;font-size:16px;font-weight:700;justify-content:center" data-act="kmdone" data-id="'+r.id+'">경로 저장</button>'+sheetFoot(r)+'</div></div>';
}
function autoStartKm(r){ return startKmOf(list, Object.assign({}, r, { startKm:null })); }
function sheetFoot(r){
  if(!popup.full||popup.gate||!canEdit(r)) return '';
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn" data-act="edit" data-id="'+r.id+'" style="justify-content:center"><i class="ti ti-pencil"></i> 예약 수정</button><button class="btn danger" data-act="cancel" data-id="'+r.id+'" style="justify-content:center"><i class="ti ti-trash"></i> 예약 취소</button></div>';
}
// 운행 기록 창 (어디서 열든 같은 창): 경로 · 운행시작 · 운행종료 · 주유 · 메모
function kmSheet(r){
  if(popup.full&&isFutureTrip(r)) return planSheet(r);
  var c=car(r.carId), auto=autoStartKm(r), p=prevTrip(list,r), gate=popup.gate;
  var fon=pv('fuelOn', !!r.fuel), noteOn=popup.noteOn||!!pv('ret-note'), tracked=r.type!=='maint', must=inLog(list,r);
  var startV=pv('km-start', r.startKm!=null?r.startKm:(auto!=null?auto:''));
  var ref=p&&p.endKm!=null?'앞 운행 '+esc(who(p))+' · '+(parseYmd(p.date).getMonth()+1)+'/'+parseYmd(p.date).getDate()+' 도착 '+fmtKm(p.endKm):(p?'<span style="color:#854F0B">앞 사람('+esc(who(p))+')이 숫자를 안 적었어요 — 탈 때 숫자를 알면 적어주세요</span>':(auto!=null?'관리자가 맞춘 기준 숫자':'첫 기록이에요'));
  var lab='font-size:12px;font-weight:600;margin-bottom:5px';
  var h='<div class="cal-popup-inner" style="width:460px"><div class="cal-popup-header"><h4>'+(gate?'<span style="color:#A32D2D">지난 운행 숫자가 비어 있어요</span>':'<span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+' 운행 기록')+'</h4><button class="btn sm" data-act="pclose"><i class="ti ti-x"></i></button></div><div class="cal-popup-body">'+
    '<div style="font-size:13px;margin-bottom:10px"><b>'+(gate?c.name+' · ':'')+esc(tripWhen(r))+'</b> · '+esc(users(r)[0]||'')+(r.lateAdd?' <span class="lg-late">나중에 추가</span>':'')+'</div>'+
    (popup.full?routeFields(r):'<div style="font-size:12px;color:#185FA5;margin:-4px 0 10px;cursor:pointer" data-act="kmfull">+ 경로 고치기 (지금: '+esc(defRoute(r))+')</div>')+
    (!tracked?'<div style="font-size:12px;color:#854F0B;background:#FAEEDA;border-radius:8px;padding:8px 10px">이 차는 아직 계기판 기록을 시작하지 않았어요 (관리자가 운행일지에서 시작).</div>':
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div><div style="'+lab+'">운행시작 <span style="font-weight:400;color:#999">(탈 때)</span></div><input id="km-start" data-for="'+r.id+'" inputmode="numeric" autocomplete="off" placeholder="계기판 숫자" value="'+esc(startV)+'" style="width:100%;height:50px;border:.5px solid #bbb;border-radius:10px;text-align:center;font-size:20px;font-weight:600;background:'+(r.startKm==null&&auto!=null?'#f7f7f5':'#fff')+';color:#1a1a18"></div>'+
        '<div><div style="'+lab+'">운행종료 <span style="font-weight:400;color:#999">(내릴 때)</span></div><input id="km-end" data-for="'+r.id+'" inputmode="numeric" autocomplete="off" placeholder="계기판 숫자" value="'+esc(pv('km-end', r.endKm!=null?r.endKm:''))+'" style="width:100%;height:50px;border:2px solid #185FA5;border-radius:10px;text-align:center;font-size:20px;font-weight:700;background:#fff;color:#1a1a18"></div></div>'+
      '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#777;background:#f7f7f5;border-radius:8px;padding:8px 10px;margin-top:8px"><span>'+ref+'</span><b id="km-diff" style="color:#185FA5;white-space:nowrap"></b></div>'+
      '<div style="font-size:11px;color:#999;margin-top:4px">운행시작은 앞 운행의 도착 숫자가 자동으로 들어가요. 다르면 고쳐주세요.</div>')+
    '<label style="display:flex;align-items:center;gap:8px;font-size:14px;margin:14px 0 6px;cursor:pointer;width:max-content"><input type="checkbox" id="km-fuelchk" data-for="'+r.id+'" style="width:18px;height:18px;margin:0"'+(fon?' checked':'')+'> 주유했어요</label>'+
    (fon?'<input id="km-fuel" data-for="'+r.id+'" inputmode="numeric" placeholder="주유 금액 (원)" value="'+esc(pv('km-fuel', r.fuel||''))+'" style="'+SM_IN+'margin-bottom:6px">':'')+
    (noteOn?'<div style="font-size:12px;font-weight:600;margin:8px 0 6px">다음 사람에게 메모 <span style="font-weight:400;color:#888">(선택)</span></div><textarea id="ret-note" data-for="'+r.id+'" maxlength="200" placeholder="예: 주유 필요, 뒷범퍼 긁힘, 주차 B구역" style="'+SM_IN+'min-height:48px;resize:vertical">'+esc(pv('ret-note', r.returnNote||''))+'</textarea>'
      :'<div style="font-size:12px;color:#185FA5;margin:4px 0 0;cursor:pointer" data-act="kmnote">+ 다음 사람에게 메모 남기기 (선택)</div>')+
    '<button class="btn primary full" style="margin:16px 0 0;padding:13px;font-size:16px;font-weight:700;justify-content:center" data-act="kmdone" data-id="'+r.id+'">'+(gate?'적고 예약 계속하기':(inUseNow(r)?'저장하고 반납':'저장'))+'</button>'+
    (gate?'<div style="text-align:center;font-size:12px;color:#888;margin-top:10px;text-decoration:underline;cursor:pointer" data-act="kmskip" data-id="'+r.id+'">숫자를 몰라요 (다음 사람이 채워요)</div>':'')+
    sheetFoot(r)+'</div></div>';
  setTimeout(kmDiff,0);
  return h;
}
function defRoute(r){ return r.route||((r.dest||'')+'-회사'); }
// 경유지: 네이버 지도 길찾기처럼 출발 → 경유지(추가·삭제) → 도착 한 줄씩
function routeStops(r){
  if(!popup.stops){ var parts=defRoute(r).split('-').map(function(x){ return x.trim(); }).filter(Boolean);
    popup.dest=parts.length>1?parts.pop():'회사'; popup.stops=parts.length?parts:['']; }
  return popup.stops;
}
function readStops(){
  if(!popup||!popup.stops) return;
  popup.stops=popup.stops.map(function(v,i){ var e=document.getElementById('km-stop-'+i); return e?e.value:v; });
  var de=document.getElementById('km-dest'); if(de) popup.dest=de.value;
}
function routeOf(){ readStops(); var a=popup.stops.map(function(x){ return String(x).trim(); }).filter(Boolean); var d=String(popup.dest||'').trim(); if(d) a.push(d); return a.join('-').slice(0,120); }
function stopList(){ var names=['회사','집']; FIXED_SITES.concat(sites).forEach(function(n){ if(n&&names.indexOf(n)<0) names.push(n); }); return names; }
function routeFields(r){
  var o=pv('km-origin', r.origin||'회사'), stops=routeStops(r);
  var dot=function(c){ return '<span style="width:10px;height:10px;border-radius:50%;border:2px solid '+c+';flex-shrink:0"></span>'; };
  var inp='flex:1;min-width:0;border:none;outline:none;font-size:14px;padding:10px 0;background:transparent;color:#1a1a18;font-family:inherit;';
  var row='display:flex;align-items:center;gap:10px;padding:0 10px;border-bottom:.5px solid #eee;';
  var h='<div style="font-size:12px;font-weight:600;margin-bottom:5px">경로</div>'+
    '<datalist id="stop-list">'+stopList().map(function(n){ return '<option value="'+esc(n)+'">'; }).join('')+'</datalist>'+
    '<div style="border:.5px solid #bbb;border-radius:10px;overflow:hidden;background:#fff">'+
    '<div style="'+row+'">'+dot('#1D9E75')+'<select id="km-origin" data-for="'+r.id+'" style="'+inp+'appearance:auto;">'+['회사','집','기타'].map(function(x){ return '<option'+(x===o?' selected':'')+'>'+x+'</option>'; }).join('')+'</select><span style="font-size:11px;color:#aaa">출발</span></div>'+
    stops.map(function(v,i){ return '<div style="'+row+'">'+dot('#999')+'<input id="km-stop-'+i+'" list="stop-list" placeholder="경유지 (업장 검색)" value="'+esc(v)+'" style="'+inp+'">'+
      '<button type="button" data-act="stopdel" data-i="'+i+'" aria-label="경유지 빼기" style="width:24px;height:24px;border-radius:50%;border:1px solid #ccc;background:#fff;color:#888;font-size:16px;line-height:20px;padding:0;cursor:pointer">−</button></div>'; }).join('')+
    '<div style="'+row+'border-bottom:none">'+dot('#E24B4A')+'<input id="km-dest" list="stop-list" placeholder="도착 (예: 회사, 집)" value="'+esc(popup.dest)+'" style="'+inp+'"><span style="font-size:11px;color:#aaa">도착</span></div></div>'+
    '<div style="display:flex;align-items:center;gap:8px;margin:8px 0 12px"><button type="button" class="btn sm" data-act="stopadd"><i class="ti ti-plus"></i> 경유지</button><span style="font-size:11px;color:#888">예약한 업장이 미리 들어가 있어요</span></div>'+
    '';
  return h;
}
// 숫자를 치는 동안 이번 운행 거리 표시
function kmDiff(){
  var e=document.getElementById('km-end'), d=document.getElementById('km-diff'), se=document.getElementById('km-start'); if(!e||!d) return;
  var v=parseKm(e.value), b=se?parseKm(se.value):null;
  d.style.color='#185FA5';
  if(v==null||b==null){ d.textContent=''; return; }
  if(v<b){ d.textContent='종료가 시작보다 작아요'; d.style.color='#A32D2D'; return; }
  d.textContent='운행거리 '+(v-b).toLocaleString()+' km';
  if(v-b>1000) d.style.color='#A32D2D';
}
// K4: 안 적은 운행이 있으면 새 예약 전에 먼저 묻기 ("몰라요"로 넘긴 건 그날 하루는 안 물음)
function kmSkipped(id){ try{ var m=JSON.parse(localStorage.getItem('kmSkip')||'{}'); return m[id]===ymd(new Date()); }catch(e){ return false; } }
function kmSkip(id){ try{ var m=JSON.parse(localStorage.getItem('kmSkip')||'{}'), t=ymd(new Date()); Object.keys(m).forEach(function(k){ if(m[k]!==t) delete m[k]; }); m[id]=t; localStorage.setItem('kmSkip',JSON.stringify(m)); }catch(e){} kmSkipMem[id]=1; }
var kmSkipMem={};
function startNew(opts){
  var m=myMissing().filter(function(r){ return !kmSkipMem[r.id]&&!kmSkipped(r.id); })[0];
  if(m){ pushLayer(); popup={type:'km', id:m.id, gate:opts}; renderPopup(); return; }
  openForm(opts);
}
// 입력값 읽기 + 확인 (운행일지에서 열면 출발지·경유지·통행료도)
function readKm(r, startOnly){ var kv=(popup&&popup.full&&isFutureTrip(r))?{}:readKm0(r, startOnly); if(!kv||startOnly) return kv;
  var o=document.getElementById('km-origin'), rt=document.getElementById('km-route'), tl=document.getElementById('km-toll');
  if(r.type==='maint'){ var fc=document.getElementById('km-fuelchk'), fe=document.getElementById('km-fuel'); if(fc){ kv.fuel=fc.checked?(parseKm(fe&&fe.value)||0):0; } }
  if(o) kv.origin=o.value; if(popup&&popup.stops) kv.route=routeOf(); else if(rt) kv.route=String(rt.value).trim().slice(0,120); if(tl) kv.toll=parseKm(tl.value)||0;
  return kv; }
function readKm0(r, startOnly){
  if(r.type==='maint') return { startKm:r.startKm==null?null:r.startKm, endKm:r.endKm==null?null:r.endKm, fuel:r.fuel||0 };
  var must=inLog(list,r);
  var se=document.getElementById('km-start'), ee=document.getElementById('km-end'), fc=document.getElementById('km-fuelchk'), fe=document.getElementById('km-fuel');
  var sk=se?parseKm(se.value):(r.startKm!=null?r.startKm:null), auto=autoStartKm(r);
  // 자동으로 들어간 숫자를 그대로 두면 따로 저장하지 않음 (앞 기록이 바뀌면 같이 따라감)
  var keepStart=(sk!=null&&(sk!==auto||r.startKm!=null))?sk:null;
  if(startOnly){ if(sk==null){ toast('운행시작 숫자를 적어주세요.'); return null; } return { startKm:sk }; }
  var ek=ee?parseKm(ee.value):null;
  if(ek==null&&(must||inUseNow(r))){ toast('운행종료 숫자(내릴 때 계기판)를 적어주세요.'); if(ee) ee.focus(); return null; }
  if(sk!=null&&ek!=null&&ek<sk){ toast('운행종료('+fmtKm(ek)+')가 운행시작('+fmtKm(sk)+')보다 작아요. 다시 확인해주세요.'); return null; }
  if(sk!=null&&ek!=null&&ek-sk>1000&&!confirm('이번 운행이 '+(ek-sk).toLocaleString()+' km 맞나요?')) return null;
  var fuel=fc&&fc.checked?(parseKm(fe&&fe.value)||0):0;
  if(fc&&fc.checked&&!fuel){ toast('주유 금액을 적어주세요.'); return null; }
  return { startKm:keepStart, endKm:ek, fuel:fuel };
}
// 예약 문서에 km만 저장 (시간은 그대로)
async function saveKm(r, kv){
  var g=group(r), b=writeBatch(db), upd={ updatedAt:serverTimestamp(), updatedBy:me.phone };
  if('startKm' in kv) upd.startKm=kv.startKm;
  if('endKm' in kv){ upd.endKm=kv.endKm; upd.fuel=kv.fuel||0; }
  if('returnNote' in kv) upd.returnNote=kv.returnNote;
  ['origin','route','toll'].forEach(function(k){ if(k in kv) upd[k]=kv[k]; });
  if('route' in kv) upd.dest=mainDest(kv.route, r.dest);   // 예약 달력의 업장도 같이 바뀜
  g.forEach(function(x){ b.update(doc(db,'reservations',x.id), upd); });
  await b.commit();
  if(kv.endKm!=null) await bumpCarKm(r.carId, kv.endKm, tripEnd(list,r));
}
// 그 차의 "최근 계기판 km"를 더 최근 기록일 때만 갱신
async function bumpCarKm(carId, km, at){
  if(km==null) return; var ck=carKm[carId];
  if(ck&&ck.at&&ck.at>at) return;
  try{ await setDoc(doc(db,'carKm',carId), ck?{ km:km, at:at, by:me.phone }:{ km:km, at:at, by:me.phone, since:KM_SINCE }, { merge:true }); }catch(e){ console.warn('carKm', e.code); }
}

// ── 운행일지 탭 (모든 직원이 봄 · 종이 운행일지 모양) ──────────────────────────
var view='res', logScrollToday=false, logFocus=null;          // res: 예약 · log: 운행일지
var logState=null;       // {carId, ym, pool:올해 예약, loadedY, loading}
function viewTabs(){
  return '<div class="car-tabs"><span class="'+(view==='res'?'on':'')+'" data-act="view" data-v="res">예약</span><span class="'+(view==='log'?'on':'')+'" data-act="view" data-v="log">운행일지</span></div>';
}
function ensureLog(){ if(!logState) logState={ carId:CARS[0].id, ym:ymd(new Date()).slice(0,7), pool:null, loadedY:'', loading:false }; }
async function loadLog(){
  ensureLog(); var y=logState.ym.slice(0,4);
  logState.loading=true; logState.loadedY=y;
  try{
    var snap=await getDocs(query(collection(db,'reservations'), where('date','>=',(+y-1)+'-12-01'), where('date','<=',y+'-12-31')));
    logState.pool=snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
  }catch(e){ console.error(e); toast('운행일지를 불러오지 못했어요.'); logState.pool=[]; }
  logState.loading=false; if(view==='log') render();
}
// 불러온 올해 예약 + 실시간 목록(최근 두 달)을 합침 — 방금 적은 숫자도 바로 보이게
function logPool(){
  var old=(logState&&logState.pool||[]).filter(function(r){ return !LIST_SINCE||r.date<LIST_SINCE; });
  return old.concat(list);
}
function logRowOf(pool,r){
  var g=poolGroup(pool,r), a=g[0], s0=startKmOf(pool,r), e0=endKmOf(pool,r), on=r.type!=='maint', must=inLog(pool,r);
  return { r:r, id:r.id, date:a.date, day:+a.date.slice(8,10), multi:g.length>1, dates:g.map(function(x){ return x.date; }), endDate:g[g.length-1].date, drv:users(r)[0]||r.ownerName||'', origin:r.origin||'회사', route:defRoute(r),
    s:on?s0:null, e:on?e0:null, d:(on&&s0!=null&&e0!=null?e0-s0:null), toll:+r.toll||0, fuel:+r.fuel||0,
    miss:must&&isEnded(pool,r)&&e0==null, mine:isMine(r), byNext:on&&r.endKm==null&&e0!=null, driving:!isEnded(pool,r)&&tripStart(pool,r)<=tKey(ymd(new Date()),nowHM()), future:tripStart(pool,r)>tKey(ymd(new Date()),nowHM()), on:on };
}
function logData(){
  var pool=logPool(), c=logState.carId, ym=logState.ym, y=ym.slice(0,4), now=tKey(ymd(new Date()),nowHM());
  var trips=tripsOf(pool,c).filter(function(r){ return r.type!=='maint'; });
  var rows=trips.filter(function(r){ return poolGroup(pool,r)[0].date.slice(0,7)===ym; }).map(function(r){ return logRowOf(pool,r); });
  // 여러 날 예약: 이 달에 걸친 날 (첫날 제외) — '이어서' 줄로 표시
  var spans=trips.filter(function(r){ var g=poolGroup(pool,r); return g.length>1&&g.some(function(x){ return x.date.slice(0,7)===ym; }); }).map(function(r){ return logRowOf(pool,r); });
  var months=[]; for(var i=1;i<=12;i++){ var mk=y+'-'+pad(i), sum=0, any=false;
    trips.forEach(function(r){ if(poolGroup(pool,r)[0].date.slice(0,7)!==mk) return; var x=logRowOf(pool,r); if(x.d!=null){ sum+=x.d; any=true; } });
    months.push({ m:i, km:any?sum:null }); }
  var tot=0, toll=0, fuel=0, miss=0; rows.forEach(function(x){ if(x.d!=null) tot+=x.d; toll+=x.toll; fuel+=x.fuel; if(x.miss) miss++; });
  return { rows:rows, spans:spans, months:months, tot:tot, toll:toll, fuel:fuel, miss:miss, year:months.reduce(function(s2,x){ return s2+(x.km||0); },0) };
}
function spanTxt(x){ function md(d){ return (+d.slice(5,7))+'/'+(+d.slice(8,10)); } return md(x.date)+' ~ '+md(x.endDate)+' · '+x.dates.length+'일'; }
function n0(v){ return v?Number(v).toLocaleString():''; }
function logPage(){
  ensureLog();
  var c=car(logState.carId), ym=logState.ym, y=+ym.slice(0,4), mo=+ym.slice(5,7), ck=carKm[c.id];
  var mlist=[]; for(var i=0;i<14;i++){ var d=new Date(); d=new Date(d.getFullYear(),d.getMonth()-i,1); mlist.push(ymd(d).slice(0,7)); }
  var h='<div class="lg-bar"><select data-l="carId" style="'+SEL_STYLE+'">'+CARS.map(function(x){ return '<option value="'+x.id+'"'+(x.id===c.id?' selected':'')+'>'+x.name+'</option>'; }).join('')+'</select>'+
    '<select data-l="ym" style="'+SEL_STYLE+'">'+mlist.map(function(m){ return '<option value="'+m+'"'+(m===ym?' selected':'')+'>'+m.slice(0,4)+'년 '+(+m.slice(5))+'월</option>'; }).join('')+'</select>'+
    '<button class="btn" data-act="lxlsx"><i class="ti ti-download"></i> 엑셀</button><button class="btn primary" data-act="ladd"><i class="ti ti-plus"></i> 운행 추가</button></div>';
  if(isAdmin()){
    h+=missingAdmin()+'<div class="lg-admin">'+(ck?'최근 계기판 <b>'+fmtKm(ck.km)+' km</b> <span style="color:#888">('+esc(ck.at||'')+' · 기록 시작 '+esc(ck.since||'')+')</span>':'<span style="color:#777">기준 숫자 없음 · 계기판이 앞 기록과 다를 때만 맞추면 돼요</span>')+
      '<span class="lg-admin-in"><input id="l-base" inputmode="numeric" placeholder="지금 계기판 km" style="'+SM_IN+'width:130px"><button class="btn sm" data-act="lbase">'+'맞추기'+'</button></span></div>';
  }
  if(!logState.pool){ return h+'<div class="empty-state">불러오는 중…</div>'; }
  var D=logData();
  h+='<div class="lg-sum"><div>이번 달 주행<b>'+D.tot.toLocaleString()+' km</b></div><div>올해 누적<b>'+D.year.toLocaleString()+' km</b></div><div class="'+(D.miss?'red':'')+'">비어 있음<b>'+D.miss+'칸</b></div></div>';
  // PC: 종이 양식 표
  var last=new Date(y,mo,0).getDate(), body='';
  for(var dd=1; dd<=last; dd++){
    var key=ym+'-'+pad(dd), dow=new Date(y,mo-1,dd).getDay(), hol=getHoliday(key), rs=D.rows.filter(function(x){ return x.day===dd; });
    var cs=D.spans.filter(function(x){ return x.date!==key&&x.dates.indexOf(key)>=0; });
    var dcls=(dow===0||hol)?'red':(dow===6?'blue':''), isToday=key===ymd(new Date()), tcls=isToday?' today':'', dlab=dd+(isToday?'<span class="lg-today">오늘</span>':'');
    if(!rs.length&&!cs.length){ body+='<tr class="off'+tcls+'"'+(isToday?' id="lg-today-row"':'')+' data-act="ladd" data-date="'+key+'" title="이 날 운행 추가"><td class="c '+dcls+'">'+dlab+'</td><td></td><td></td><td>'+esc(hol||'')+'</td><td class="n">–</td><td class="n">–</td><td></td><td></td></tr>'; continue; }
    rs.forEach(function(x){
      var endCell=x.future?'<span style="color:#888">예정</span>':x.miss?(x.mine||isAdmin()?'<span class="lg-in">숫자 적기</span>':'<span class="red">비어 있음</span>'):(x.driving?'<span style="color:#185FA5">운행 중</span>':fmtKm(x.e));
      body+='<tr class="row'+(x.miss?' ms':'')+(x.mine?' me':'')+(x.future?' fut':'')+tcls+'"'+(isToday&&!body.includes('id="lg-today-row"')?' id="lg-today-row"':'')+' data-act="lrow" data-id="'+x.id+'" data-rid="'+x.id+'"><td class="c '+dcls+'">'+dlab+'</td><td>'+esc(x.drv)+'</td><td class="c">'+esc(x.origin)+'</td><td>'+esc(x.route)+(x.multi?' <small style="color:#185FA5">('+spanTxt(x)+')</small>':'')+(x.r.lateAdd?' <span class="lg-late">나중에 추가</span>':'')+'</td>'+
        '<td class="n kc">'+(x.future?'':x.on?fmtKm(x.s):'–')+'</td><td class="n kc">'+(x.future?endCell:x.on?endCell:'–')+'</td><td class="n">'+(x.d!=null?x.d.toLocaleString():'')+'</td><td class="n">'+n0(x.fuel)+'</td></tr>';
    });
    cs.forEach(function(x){
      body+='<tr class="row cont'+(x.mine?' me':'')+tcls+'"'+(isToday&&!body.includes('id="lg-today-row"')?' id="lg-today-row"':'')+' data-act="lrow" data-id="'+x.id+'"><td class="c '+dcls+'">'+dlab+'</td><td>'+esc(x.drv)+'</td><td></td><td>↳ '+(+x.date.slice(5,7))+'/'+(+x.date.slice(8,10))+'부터 이어서 · '+esc(x.route)+'</td><td></td><td></td><td></td><td></td></tr>';
    });
  }
  var mt=D.months.map(function(x){ var cur=x.m===mo; return '<tr'+(cur?' class="cur"':'')+'><td class="c">'+x.m+'월</td><td class="n">'+(x.km!=null?x.km.toLocaleString():'')+'</td></tr>'; }).join('');
  h+='<div class="lg-pc"><div class="lg-sheet"><div class="lg-title">'+String(y).slice(2)+'년 '+mo+'월 차량운행일지</div>'+
    '<div class="lg-info"><div class="k">차량</div><div>'+c.name+'</div><div class="k">월 총 주행거리</div><div style="font-weight:700;color:#185FA5">'+D.tot.toLocaleString()+' km</div></div>'+
    '<div style="overflow-x:auto"><table class="lg-t"><tr><th style="width:34px">일</th><th>운행자</th><th>출발지</th><th>경유지 및 도착지</th><th>운행시작</th><th>운행종료</th><th>운행거리</th><th>주유</th></tr>'+body+
    '<tr class="tot"><th colspan="6" style="text-align:right">합계</th><th class="n">'+D.tot.toLocaleString()+'</th><th class="n">'+n0(D.fuel)+'</th></tr></table></div></div>'+
    '<div class="lg-side"><table class="lg-t"><tr><th>월</th><th>누적 km</th></tr>'+mt+'<tr class="tot"><th>년 누적</th><th class="n">'+D.year.toLocaleString()+'</th></tr></table></div></div>';
  // 휴대폰: 하루 한 줄 카드 (최신이 위)
  var todayK=ymd(new Date()), divDone=ym!==todayK.slice(0,7);
  var todayDiv=function(){ return '<div class="lg-div"><span>오늘 '+mdw(todayK)+'</span></div>'; };
  h+='<div class="lg-mo">'+(D.rows.length?D.rows.slice().reverse().map(function(x){
      var pre=''; if(!divDone&&x.date<=todayK){ divDone=true; if(x.date<todayK) pre=todayDiv(); }
      var dow=parseYmd(x.date).getDay(), col=(dow===0||getHoliday(x.date))?'#C0392B':(dow===6?'#1A5276':'#1a1a18');
      var k=x.future?'<span style="color:#888;font-size:12px">예정</span>':!x.on?'<span style="color:#aaa;font-size:12px">기록 전</span>':x.miss?(x.mine||isAdmin()?'<span class="lg-in">숫자 적기</span>':'<span style="color:#A32D2D;font-size:12px">비어 있음</span>'):x.driving?'<span style="color:#185FA5;font-size:12px">운행 중</span>':(x.d!=null?x.d.toLocaleString()+' km':'')+'<small>'+fmtKm(x.s)+' → '+fmtKm(x.e)+'</small>';
      var isT=x.date===todayK;
      return pre+'<div class="lg-card'+(x.miss?' ms':'')+(x.future?' fut':'')+(isT?' today':'')+'" data-act="lrow" data-id="'+x.id+'" data-rid="'+x.id+'"><div class="d" style="color:'+col+'">'+x.day+'<small>'+(isT?'오늘':DOW[dow])+'</small></div><div class="m"><div class="r1">'+esc(x.route)+'</div>'+(x.multi?'<div class="r2" style="color:#185FA5">'+spanTxt(x)+'</div>':'')+'<div class="r2">'+esc(x.drv)+(x.mine?' (나)':'')+(x.r.lateAdd?' · <span class="lg-late">나중에 추가</span>':'')+(x.fuel?' · 주유 '+n0(x.fuel):'')+'</div></div><div class="k">'+k+'</div></div>';
    }).join('')+(!divDone?todayDiv():''):'<div class="empty-state">이 달에는 운행이 없어요.</div>')+'</div>';
  return h;
}
var LOG_CSS='.car-tabs{display:flex;gap:4px;border-bottom:.5px solid #e8e8e4;background:#fff;padding:0 16px;}'+
  '.car-tabs span{padding:11px 14px;font-size:14px;color:#888;border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;}'+
  '.car-tabs span.on{color:#185FA5;border-color:#185FA5;font-weight:600;}'+
  '.lg-bar{display:flex;gap:8px;align-items:center;margin-bottom:12px;}.lg-bar select{max-width:170px;}.lg-bar .btn[data-act=lxlsx]{margin-left:auto;}'+
  '.lg-admin{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#F7FAFD;border:.5px solid #DCE9F5;border-radius:10px;padding:9px 12px;margin-bottom:12px;font-size:12px;}.lg-admin-in{margin-left:auto;display:flex;gap:6px;align-items:center;}'+
  '.lg-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}.lg-sum div{background:#fff;border:.5px solid #e8e8e4;border-radius:10px;padding:8px 12px;font-size:11px;color:#777;}.lg-sum b{display:block;font-size:16px;color:#1a1a18;margin-top:1px;}.lg-sum .red{border-color:#F7C1C1;}.lg-sum .red b{color:#A32D2D;}'+
  '.lg-pc{display:flex;gap:14px;align-items:flex-start;}.lg-sheet{flex:1;min-width:0;background:#fff;border:.5px solid #d8d8d2;border-radius:8px;overflow:hidden;}.lg-side{width:190px;flex-shrink:0;}'+
  '.lg-title{font-size:19px;font-weight:800;text-align:center;padding:12px 0;letter-spacing:1px;}'+
  '.lg-info{display:grid;grid-template-columns:70px 1fr 110px 1fr;border-top:.5px solid #cfcfc8;font-size:12px;}.lg-info div{padding:7px 8px;border-right:.5px solid #cfcfc8;}.lg-info div:last-child{border-right:none;}.lg-info .k{background:#EEF0F3;font-weight:600;text-align:center;}'+
  '.lg-t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;background:#fff;}.lg-t th,.lg-t td{border:.5px solid #cfcfc8;padding:5px 7px;white-space:nowrap;}.lg-t th{background:#EEF0F3;font-weight:600;color:#333;}'+
  '.lg-t .c{text-align:center;}.lg-t .n{text-align:right;}.lg-t .red{color:#C0392B;}.lg-t .blue{color:#1A5276;}.lg-t tr.off td{background:#FAFAF8;color:#bbb;}.lg-t tr.off td.red{color:#E7A9A1;}'+
  '.lg-t tr.row{cursor:pointer;}.lg-t tr.row:hover td{background:#F3F7FB;}.lg-t tr.me td{background:#F7FAFD;}.lg-t tr.ms td.kc{background:#FCEBEB;}.lg-t tr.cur td{background:#E6F1FB;font-weight:700;}.lg-t tr.tot th{background:#EEF0F3;}'+
  '.lg-t tr.today td{background:#FFF7DB !important;}.lg-t tr.today td:first-child{box-shadow:inset 3px 0 0 #E0A100;font-weight:700;color:#1a1a18;}.lg-today{display:inline-block;margin-left:4px;font-size:10px;font-weight:700;color:#fff;background:#E0A100;border-radius:4px;padding:0 4px;vertical-align:1px;}'+
  '.lg-t tr.fut td{color:#888;}.lg-t tr.cont td{color:#8aa0b5;background:#FBFCFE;}'+'.lg-card.fut{background:#FAFAF8;}.lg-card.fut .r1{color:#555;}.lg-card.today{border:1.5px solid #E0A100;background:#FFFBEA;}'+
  '.lg-div{display:flex;align-items:center;gap:8px;margin:10px 0;font-size:11px;font-weight:700;color:#B07D00;}.lg-div:before,.lg-div:after{content:"";flex:1;height:1px;background:#E8C766;}'+
  '.lg-late{display:inline-block;font-size:10px;font-weight:600;color:#854F0B;background:#FAEEDA;border-radius:4px;padding:0 5px;}.lg-t tr.off{cursor:pointer;}.lg-t tr.off:hover td{background:#F3F7FB;}.lg-flash td,.lg-card.lg-flash{animation:lgf 1.6s ease;}@keyframes lgf{0%,40%{background:#CFE3F7;}100%{}}'+
  '.ev-miss{width:6px;height:6px;border-radius:50%;background:#E24B4A;display:inline-block;margin-right:3px;flex-shrink:0;align-self:center;}'+
  '.lg-in{display:inline-block;background:#185FA5;color:#fff;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;}'+
  '.lg-mo{display:none;}.lg-card{background:#fff;border:.5px solid #e8e8e4;border-radius:10px;margin-bottom:6px;padding:9px 12px;display:flex;gap:10px;align-items:center;cursor:pointer;}'+
  '.lg-card .d{width:32px;text-align:center;font-weight:700;font-size:15px;line-height:1.1;}.lg-card .d small{display:block;font-size:10px;font-weight:500;color:#888;}'+
  '.lg-card .m{flex:1;min-width:0;}.lg-card .r1{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.lg-card .r2{font-size:11px;color:#777;margin-top:2px;}'+
  '.lg-card .k{text-align:right;font-size:13px;font-weight:700;white-space:nowrap;}.lg-card .k small{display:block;font-size:10px;color:#999;font-weight:400;}.lg-card.ms{border-color:#F7C1C1;background:#FFF8F8;}'+
  '@media(max-width:760px){.lg-pc{display:none;}.lg-mo{display:block;}.lg-bar{flex-wrap:wrap;}.lg-bar select{flex:1 1 40%;max-width:none;}.lg-bar .btn{flex:1;justify-content:center;}.lg-bar .btn[data-act=lxlsx]{margin-left:0;}}';
function ensureLogCss(){ if(document.getElementById('lg-css')) return; var st=document.createElement('style'); st.id='lg-css'; st.textContent=LOG_CSS; document.head.appendChild(st); }
// 관리자: 숫자 안 적은 운행 (최근 두 달, 차 전체) + 단톡방 안내 문구
function allMissing(){
  var out=[]; CARS.forEach(function(c){ tripsOf(list,c.id).forEach(function(r){ if(needsKm(r)) out.push(r); }); });
  return out.sort(function(a,b){ return tripStart(list,b).localeCompare(tripStart(list,a)); });
}
function mdw(x){ var d=parseYmd(x); return (d.getMonth()+1)+'/'+d.getDate()+' ('+DOW[d.getDay()]+')'; }
function missingText(ms){
  return '[차량 운행일지] 계기판 숫자가 비어 있어요.\n'+ms.map(function(r){ return '· '+(users(r)[0]||r.ownerName||'')+' — '+mdw(group(r)[0].date)+' '+car(r.carId).name; }).join('\n')+
    '\n차량 예약 앱 맨 위 [운행 기록 적기]에서 운행종료 숫자만 적어주세요!';
}
function missingAdmin(){
  var ms=allMissing(); if(!ms.length) return '';
  return '<div style="background:#fff;border:.5px solid #F7C1C1;border-radius:12px;overflow:hidden;margin-bottom:12px">'+
    '<div style="background:#FCEBEB;padding:9px 12px;font-size:13px;font-weight:700;color:#A32D2D;display:flex;align-items:center;gap:8px">숫자 안 적은 운행 '+ms.length+'건'+
    '</div>'+
    ms.map(function(r){ return '<div data-act="open" data-id="'+r.id+'" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:.5px solid #f0f0ec;font-size:12px;cursor:pointer"><b style="font-size:13px">'+esc(users(r)[0]||r.ownerName||'')+'</b><span style="color:#777">'+mdw(group(r)[0].date)+' · '+car(r.carId).name+'</span><span style="margin-left:auto;color:#999">'+esc(r.dest||'')+'</span></div>'; }).join('')+'</div>';
}
function copyText(txt){
  function fallback(){ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); var ok=false; try{ ok=document.execCommand('copy'); }catch(e){} ta.remove(); return ok; }
  if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function(){ return true; },function(){ return fallback(); });
  return Promise.resolve(fallback());
}
function loadXlsx(){
  return new Promise(function(ok,no){ if(window.XLSX) return ok();
    var sc=document.createElement('script'); sc.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; sc.onload=function(){ ok(); }; sc.onerror=no; document.head.appendChild(sc); });
}
// 엑셀: 화면의 종이 양식 그대로 (일별 줄 + 오른쪽 월별 누적)
async function exportLog(){
  if(!logState||!logState.pool){ toast('아직 불러오는 중이에요.'); return; }
  try{ await loadXlsx(); }catch(e){ toast('엑셀 도구를 불러오지 못했어요.'); return; }
  var c=car(logState.carId), ym=logState.ym, y=+ym.slice(0,4), mo=+ym.slice(5,7), D=logData(), last=new Date(y,mo,0).getDate();
  var aoa=[[String(y).slice(2)+'년 '+mo+'월 차량운행일지'],['차량',c.name,'월 총 주행거리',D.tot+' km'],[],
    ['일','운행자','출발지','경유지 및 도착지','운행시작','운행종료','운행거리','주유','','월','누적km']];
  var body=[];
  for(var dd=1; dd<=last; dd++){
    var key=ym+'-'+pad(dd), rs=D.rows.filter(function(x){ return x.day===dd; }), hol=getHoliday(key);
    var cs=D.spans.filter(function(x){ return x.date!==key&&x.dates.indexOf(key)>=0; });
    if(!rs.length&&!cs.length) body.push([dd,'','',hol||'','','','','']);
    rs.forEach(function(x){ body.push([dd,x.drv,x.origin,x.route+(x.multi?' ('+spanTxt(x)+')':''),x.s==null?'':x.s,x.miss?'비어 있음':(x.e==null?'':x.e),x.d==null?'':x.d,x.fuel||'']); });
    cs.forEach(function(x){ body.push([dd,x.drv,'','↳ '+(+x.date.slice(5,7))+'/'+(+x.date.slice(8,10))+'부터 이어서','','','','']); });
  }
  body.push(['합계','','','','','',D.tot,D.fuel||'']);
  body.forEach(function(row,i){ var r=row.slice(); while(r.length<8) r.push('');
    if(i<12){ r.push('',D.months[i].m+'월',D.months[i].km==null?'':D.months[i].km); } else if(i===12){ r.push('','년 누적',D.year); }
    aoa.push(r); });
  var ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:7}}];
  ws['!cols']=[{wch:5},{wch:13},{wch:8},{wch:44},{wch:10},{wch:10},{wch:9},{wch:9},{wch:2},{wch:8},{wch:10}];
  var wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, (c.short+' '+ym).replace(/[\\\/?*\[\]:]/g,''));
  XLSX.writeFile(wb, '차량운행일지_'+c.short+'_'+ym+'.xlsx');
}

// ── 이벤트 (화면 전체에서 data-act 하나로 처리) ──────────────────
document.addEventListener('pointerdown', function(ev){ if(ev.target.closest('.ss-option')) ev.preventDefault(); });
document.addEventListener('click', async function(ev){
  var t=ev.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act');
  ev.stopPropagation();
  if(a==='logout'){ if(confirm('로그아웃할까요?')){ await logoutUser(); location.reload(); } }
  else if(a==='month'){ var dd=+t.getAttribute('data-d'); monthCursor=dd?new Date(monthCursor.getFullYear(),monthCursor.getMonth()+dd,1):firstOfMonth(new Date());
    // 휴대폰에서 고른 날짜: 이번 달이면 오늘, 다른 달이면 1일
    mobileSel=ymd(new Date()).slice(0,7)===ymd(monthCursor).slice(0,7)?ymd(new Date()):ymd(monthCursor); scrollToToday=true; render(); }
  else if(a==='day'&&isMobile()){ mobileSel=t.getAttribute('data-date'); render(); }
  else if(a==='day'){ var dt=t.getAttribute('data-date'); if(dt>=ymd(new Date())) startNew({ date:dt }); else { pushLayer(); popup={type:'day',date:dt}; renderPopup(); } }
  else if(a==='daylist'){ pushLayer(); popup={type:'day',date:t.getAttribute('data-date')}; renderPopup(); }
  else if(a==='new'){ startNew({ date:t.getAttribute('data-date')||null, car:t.getAttribute('data-car')||null }); }
  else if(a==='open'){ var id=t.getAttribute('data-id'); if(id){ pushLayer(); popup={type:'detail',id:id}; renderPopup(); } else openForm({ car:t.getAttribute('data-car') }); }
  else if(a==='carinfo'){ pushLayer(); popup={type:'car',carId:t.getAttribute('data-car')}; renderPopup(); }
  else if(a==='pclose'){ popup=null; renderPopup(); popLayer(); }
  else if(a==='edit'){ var r=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(r) openForm({ edit:r }); }
  else if(a==='cancel'){
    var r2=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r2) return;
    var g=group(r2);
    if(!confirm(rangeText(g)+' '+car(r2.carId).name+' 예약을 취소할까요?\n운행일지에서도 같이 지워져요.')) return;
    if(g.some(function(x){ return x.endKm!=null; })&&!confirm('계기판 숫자까지 적은 운행이에요. 정말 지울까요?')) return;
    try{ await cancelReservation(g); popup=null; renderPopup(); popLayer(); toast('예약을 취소했어요.'); }
    catch(e){ console.error(e); toast(e.code==='permission-denied'?'본인 예약만 취소할 수 있어요.':'취소하지 못했어요.'); }
  }
  else if(a==='return'){
    var r3=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r3) return;
    var g3=group(r3), td=ymd(new Date()), now=nowHM();
    var ne=document.getElementById('ret-note'), note=ne?ne.value:'';
    var kv=readKm(r3); if(!kv) return;
    var segs=g3.filter(function(x){ return x.date<=td; }).map(function(x){ return { date:x.date, start:x.start, end:x.date===td?now:x.end }; })
      .filter(function(x){ return x.end>x.start; });
    if(!segs.length) return;
    try{
      await saveReservation({ carId:r3.carId, segs:segs, type:'use', dest:r3.dest, purpose:r3.purpose, riders:r3.riders||[], riderPhones:r3.riderPhones||[], memo:r3.memo, returnedAt:now, returnNote:String(note).trim().slice(0,200),
        startKm:kv.startKm, endKm:kv.endKm, fuel:kv.fuel, origin:r3.origin, route:r3.route, toll:r3.toll, lateAdd:r3.lateAdd }, g3);
      await bumpCarKm(r3.carId, kv.endKm, segs[segs.length-1].date+' '+now);
      popup=null; renderPopup(); popLayer(); toast('반납 완료! '+car(r3.carId).name+', 이제 다른 사람이 쓸 수 있어요.');
    }catch(e){ console.error(e); toast(e.code==='permission-denied'?'반납 처리 권한이 없어요.':'반납 처리하지 못했어요.'); }
  }
  else if(a==='kmsave'){
    var r4=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r4) return;
    var kv4=readKm(r4, t.getAttribute('data-mode')==='start'); if(!kv4) return;
    try{ await saveKm(r4, kv4); popup.vals={}; popup.kmEdit=false; toast(kv4.endKm!=null?'운행 기록을 저장했어요.':'출발 km를 저장했어요.'); render(); }
    catch(e){ console.error(e); toast(e.code==='permission-denied'?'저장 권한이 없어요.':'저장하지 못했어요.'); }
  }
  else if(a==='kmopen'){ var kid=t.getAttribute('data-id'); if(popup) popup={type:'km',id:kid}; else { pushLayer(); popup={type:'km',id:kid}; } renderPopup(); setTimeout(function(){ var e=document.getElementById('km-end'); if(e&&!e.value) e.focus(); },60); }
  else if(a==='stopadd'){ keepPopupVals(); popup.stops.push(''); renderPopup(); var ns=document.getElementById('km-stop-'+(popup.stops.length-1)); if(ns) ns.focus(); }
  else if(a==='stopdel'){ keepPopupVals(); popup.stops.splice(+t.getAttribute('data-i'),1); if(!popup.stops.length) popup.stops=['']; renderPopup(); }
  else if(a==='kmfull'){ keepPopupVals(); popup.full=true; renderPopup(); }
  else if(a==='kmnote'){ keepPopupVals(); popup.noteOn=true; renderPopup(); var tn=document.getElementById('ret-note'); if(tn) tn.focus(); }
  else if(a==='kmstart'){ keepPopupVals(); popup.startOn=true; renderPopup(); var ts=document.getElementById('km-start'); if(ts) ts.focus(); }
  else if(a==='kmskip'){ var sid=t.getAttribute('data-id'), gopts=popup&&popup.gate; kmSkip(sid); popup=null; renderPopup(); if(gopts) startNew(gopts); }
  else if(a==='kmdone'){
    var r5=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r5) return;
    var kv5=readKm(r5); if(!kv5) return;
    var ne5=document.getElementById('ret-note'), note5=ne5?String(ne5.value).trim().slice(0,200):null, gate5=popup&&popup.gate;
    try{
      if(inUseNow(r5)){
        // 운행 중에 적으면 = 지금 반납
        var g5=group(r5), td5=ymd(new Date()), now5=nowHM();
        var segs5=g5.filter(function(x){ return x.date<=td5; }).map(function(x){ return { date:x.date, start:x.start, end:x.date===td5?now5:x.end }; }).filter(function(x){ return x.end>x.start; });
        if(!segs5.length) return;
        await saveReservation({ carId:r5.carId, segs:segs5, type:'use', dest:'route' in kv5?mainDest(kv5.route, r5.dest):r5.dest, purpose:r5.purpose, riders:r5.riders||[], riderPhones:r5.riderPhones||[], memo:r5.memo, returnedAt:now5, returnNote:note5!=null?note5:(r5.returnNote||''),
          startKm:kv5.startKm, endKm:kv5.endKm, fuel:kv5.fuel, origin:'origin' in kv5?kv5.origin:r5.origin, route:'route' in kv5?kv5.route:r5.route, toll:'toll' in kv5?kv5.toll:r5.toll, lateAdd:r5.lateAdd }, g5);
        await bumpCarKm(r5.carId, kv5.endKm, segs5[segs5.length-1].date+' '+now5);
        toast('저장했어요. '+car(r5.carId).name+' 반납 완료!');
      } else {
        if(note5!=null) kv5.returnNote=note5;
        await saveKm(r5, kv5);
        toast(kv5.endKm===undefined?'경로를 저장했어요.':'운행 기록을 저장했어요.');
      }
      popup=null; renderPopup();
      if(gate5) startNew(gate5); else popLayer();
    }catch(e){ console.error(e); toast(e.code==='permission-denied'?'저장 권한이 없어요.':'저장하지 못했어요.'); }
  }
  else if(a==='view'){ view=t.getAttribute('data-v'); if(view==='res') scrollToToday=true; else logScrollToday=true; ensureLog(); render(); window.scrollTo(0,0); }
  else if(a==='ladd'){ ensureLog(); openForm({ date:t.getAttribute('data-date')||ymd(new Date()), car:logState.carId }); }
  else if(a==='golog'){ var gr=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!gr) return; ensureLog(); var g0=group(gr)[0];
    logState.carId=gr.carId; if(logState.ym.slice(0,4)!==g0.date.slice(0,4)) logState.pool=null; logState.ym=g0.date.slice(0,7); logFocus=gr.id; popup=null; renderPopup(); popLayer(); view='log'; render(); }
  else if(a==='lrow'){ var lr=logPool().filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!lr) return;
    if(canEdit(lr)&&list.some(function(x){ return x.id===lr.id; })){ pushLayer(); popup={type:'km',id:lr.id,full:true}; renderPopup(); }
    else if(list.some(function(x){ return x.id===lr.id; })){ pushLayer(); popup={type:'detail',id:lr.id}; renderPopup(); }
    else toast(canEdit(lr)?'두 달이 지난 운행은 관리자에게 수정을 부탁해주세요.':'다른 사람 운행은 보기만 할 수 있어요.'); }
  else if(a==='lxlsx'){ exportLog(); }
  else if(a==='lcopy'){ copyText(missingText(allMissing())).then(function(ok){ toast(ok?'복사했어요. 단톡방에 붙여넣으세요.':'복사하지 못했어요.'); }); }
  else if(a==='lbase'){
    var bi=document.getElementById('l-base'), bv=bi?parseKm(bi.value):null;
    if(bv==null){ toast('지금 계기판 km를 숫자로 적어주세요.'); return; }
    var ck=carKm[logState.carId];
    if(!confirm(car(logState.carId).name+' 지금 계기판을 '+bv.toLocaleString()+' km로 맞출까요?'+'')) return;
    try{ var at=ymd(new Date())+' '+nowHM();
      await setDoc(doc(db,'carKm',logState.carId), { km:bv, at:at, baseKm:bv, baseAt:at, since:ck&&ck.since||ymd(new Date()), by:me.phone });
      toast('계기판 km를 저장했어요.'); render(); }
    catch(e){ console.error(e); toast('저장하지 못했어요.'); }
  }
  else if(a==='fclose'){ form=null; renderForm(); popLayer(); }
  else if(a==='car'){ if(t.classList.contains('no')) return; var cid=t.getAttribute('data-car'), ix=form.carIds.indexOf(cid);
    if(form.editIds.length){ var prevD=form.drivers[form.carIds[0]]; form.carIds=[cid]; if(prevD&&!form.drivers[cid]) form.drivers[cid]=prevD; }   // 수정할 땐 한 대만
    else if(ix>=0){ form.carIds.splice(ix,1); delete form.drivers[cid]; }
    else { form.carIds.push(cid);
      // 운전자는 처음에 나로 (다른 차에 이미 내가 운전자면 비워둠)
      var myN=myStaffName(), used=form.carIds.some(function(o){ return o!==cid&&form.drivers[o]===myN; });
      if(myN&&!used&&!form.drivers[cid]) form.drivers[cid]=myN; }
    renderForm(); }
  else if(a==='rider'){ var n=t.getAttribute('data-n'), ix=form.riders.indexOf(n);
    if(ix>=0) form.riders.splice(ix,1);
    else if(form.riders.length>=2){ toast('예약자는 최대 2명까지 고를 수 있어요.'); return; }
    else form.riders.push(n);
    renderForm(); }
  else if(a==='save'){ submitForm(); }
  else if(a==='dpick'){ form.dest=t.getAttribute('data-v'); form.destPicked=true; var inp=document.getElementById('f-dest'); if(inp){ inp.value=form.dest; inp.blur(); } renderForm(); }
});
// 바깥(어두운 부분) 누르면 닫기
document.addEventListener('click', function(ev){
  if(ev.target.id==='popup'){ popup=null; renderPopup(); popLayer(); }
});
document.addEventListener('change', function(ev){
  var lf=ev.target.getAttribute&&ev.target.getAttribute('data-l');
  if(lf&&logState){ logState[lf]=ev.target.value; if(lf==='ym'&&logState.ym.slice(0,4)!==logState.loadedY){ logState.pool=null; loadLog(); } render(); return; }
  if(ev.target.id==='km-fuelchk'){ keepPopupVals(); renderPopup(); var fa=document.getElementById('km-fuel'); if(fa&&ev.target.checked) fa.focus(); return; }
  var f=ev.target.getAttribute&&ev.target.getAttribute('data-f'); if(!f||!form) return;
  if(f==='date'){ if(!ev.target.value) return; var len=form.date&&form.multiDay?datesBetween(form.date,form.endDate).length-1:0; form.date=ev.target.value; form.endDate=ymd(addDays(parseYmd(form.date),len)); }
  else if(f==='multiDay'){ form.multiDay=ev.target.checked; if(!form.multiDay) form.endDate=form.date; }
  else if(f==='endDate'){ var v=ev.target.value; form.endDate=v&&v>form.date?v:form.date; }
  else if(f==='driver'){ form.drivers[ev.target.getAttribute('data-car')]=ev.target.value; }
  else if(f==='slotSel'){ var k=ev.target.value; if(!k) return; form.slot=k; if(SLOTS[k]){ form.start=SLOTS[k].s; form.end=SLOTS[k].e; } }
  else {
    form[f]=ev.target.value;
    // 시간을 직접 바꾸면 그에 맞는 시간대로 표시 (안 맞으면 "직접 선택")
    if(f==='start'||f==='end'){ var m=Object.keys(SLOTS).filter(function(k){ return SLOTS[k].s===form.start&&SLOTS[k].e===form.end; })[0]; form.slot=m||'custom'; }
  }
  if(f==='memo') return;
  renderForm();
});
document.addEventListener('focusin', function(ev){ if(form&&ev.target.id==='f-dest') openSug(); });
document.addEventListener('focusout', function(ev){
  if(ev.target.id==='f-dest') setTimeout(function(){ var sg=document.getElementById('dest-sug'); if(sg) sg.classList.remove('open'); },150);
});
document.addEventListener('input', function(ev){
  if(ev.target.id==='km-end'||ev.target.id==='km-start'){ kmDiff(); return; }
  var f=ev.target.getAttribute&&ev.target.getAttribute('data-f'); if(!form) return;
  if(f==='dest'||f==='memo') form[f]=ev.target.value;
  if(f==='dest'){ form.destPicked=false; var sg=document.getElementById('dest-sug'); if(sg){ sg.innerHTML=destSug(form.dest); sg.classList.add('open'); } }
});
window.addEventListener('popstate', function(){ if(form){ form=null; renderForm(); } else if(popup){ popup=null; renderPopup(); } });

// ── 공휴일 (FS 앱과 같은 목록) ──────────────────────────
var HOLIDAYS = {
  '2025-01-01':'신정','2025-01-28':'설날 연휴','2025-01-29':'설날','2025-01-30':'설날 연휴',
  '2025-03-01':'삼일절','2025-03-03':'대체공휴일','2025-05-05':'어린이날','2025-05-06':'대체공휴일',
  '2025-05-15':'부처님오신날','2025-06-06':'현충일','2025-08-15':'광복절',
  '2025-10-03':'개천절','2025-10-05':'추석 연휴','2025-10-06':'추석','2025-10-07':'추석 연휴','2025-10-08':'대체공휴일',
  '2025-07-17':'제헌절','2025-10-09':'한글날','2025-12-25':'크리스마스',
  '2026-01-01':'신정','2026-02-16':'설날 연휴','2026-02-17':'설날','2026-02-18':'설날 연휴',
  '2026-03-01':'삼일절','2026-03-02':'대체공휴일','2026-05-01':'노동절',
  '2026-05-05':'어린이날','2026-05-24':'부처님오신날','2026-05-25':'대체공휴일',
  '2026-06-03':'지방선거','2026-06-06':'현충일','2026-07-17':'제헌절',
  '2026-08-15':'광복절','2026-08-17':'대체공휴일',
  '2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴',
  '2026-10-03':'개천절','2026-10-05':'대체공휴일','2026-10-09':'한글날','2026-12-25':'크리스마스',
  '2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날','2027-02-08':'설날 연휴','2027-02-09':'대체공휴일',
  '2027-03-01':'삼일절','2027-05-01':'노동절','2027-05-03':'대체공휴일',
  '2027-05-05':'어린이날','2027-05-13':'부처님오신날','2027-06-06':'현충일',
  '2027-07-17':'제헌절','2027-07-19':'대체공휴일','2027-08-15':'광복절','2027-08-16':'대체공휴일',
  '2027-09-14':'추석 연휴','2027-09-15':'추석','2027-09-16':'추석 연휴',
  '2027-10-03':'개천절','2027-10-04':'대체공휴일','2027-10-09':'한글날','2027-10-11':'대체공휴일',
  '2027-12-25':'크리스마스','2027-12-27':'대체공휴일'
};
function getHoliday(k){ return HOLIDAYS[k]||''; }

// ── 로그인 ──────────────────────────
function showLogin(step, msg){
  var el=document.getElementById('login');
  el.style.display='flex';
  document.getElementById('lg-phone-step').style.display=step==='pw'?'none':'block';
  document.getElementById('lg-pw-step').style.display=step==='pw'?'block':'none';
  var er=document.getElementById('lg-err'); er.style.display=msg?'block':'none'; er.innerHTML=msg||'';
}
window.lgPhone=async function(){
  var p=document.getElementById('lg-phone').value.replace(/[^0-9]/g,'');
  if(p.length<10){ showLogin('phone','올바른 휴대폰 번호를 입력해주세요.'); return; }
  try{
    var info=await checkAllowedUser(p);
    if(!info){ showLogin('phone','등록되지 않은 번호예요. 관리자에게 문의하세요.'); return; }
    if(!hasApp(info,'car')){ showLogin('phone','차량 예약 권한이 없어요. 관리자에게 문의하세요.'); return; }
    loginPhone=p; isNewUser=!info.registered;
    document.getElementById('lg-hello').textContent=(info.name||'')+(isNewUser?'님, 처음 오셨네요! 사용할 비밀번호를 만들어주세요.':'님, 안녕하세요!');
    document.getElementById('lg-pw2-wrap').style.display=isNewUser?'block':'none';
    document.getElementById('lg-submit').textContent=isNewUser?'비밀번호 만들고 시작하기':'로그인';
    showLogin('pw'); document.getElementById('lg-pw').focus();
  }catch(e){ console.error(e); showLogin('phone','확인 중 오류가 발생했어요.'); }
};
window.lgSubmit=async function(){
  var pw=document.getElementById('lg-pw').value;
  if(pw.length<6){ showLogin('pw','비밀번호는 6자 이상이에요.'); return; }
  try{
    if(isNewUser){
      if(pw!==document.getElementById('lg-pw2').value){ showLogin('pw','비밀번호가 일치하지 않아요.'); return; }
      try{ await registerUser(loginPhone,pw); }
      catch(e){ if(e.code==='auth/email-already-in-use') await loginUser(loginPhone,pw); else throw e; }
    } else await loginUser(loginPhone,pw);
  }catch(e){
    console.error(e);
    var m = (e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'||e.code==='auth/user-not-found') ? '비밀번호가 틀렸어요.'
          : e.code==='auth/operation-not-allowed'||e.code==='auth/admin-restricted-operation' ? '지금은 새 계정을 만들 수 없어요. 관리자에게 문의하세요.'
          : '로그인 오류 ('+(e.code||'')+')';
    showLogin('pw', m);
  }
};
window.lgBack=function(){ showLogin('phone'); };

watchAuth(async function(user){
  var splash=document.getElementById('splash');
  if(!user){ me=null; if(unsub){ unsub(); unsub=null; } if(splash) splash.remove(); showLogin('phone'); render(); return; }
  var phone=(user.email||'').split('@')[0];
  var info=null; try{ info=await checkAllowedUser(phone); }catch(e){ console.error(e); }
  if(splash) splash.remove();
  if(!info||!hasApp(info,'car')){
    document.getElementById('login').style.display='flex';
    showLogin('phone','이 계정은 차량 예약 권한이 없어요.<br><button class="lg-btn ghost" onclick="lgLogout()">다른 번호로 로그인</button>');
    return;
  }
  document.getElementById('login').style.display='none';
  me={ phone:phone, name:info.name||'', role:info.role||'staff', apps:info.apps };
  listen(); render();
});
window.lgLogout=async function(){ await logoutUser(); location.reload(); };

// 1분마다 '지금 상태'와 현재 시각 선 갱신
setInterval(function(){ if(me&&!form&&!popup) render(); }, 60000);
