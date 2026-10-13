// car.js — 차량 예약 앱 (레이 2대 + 스타렉스 1대). FS 앱과 같은 Firebase·로그인을 쓴다.
import { db, checkAllowedUser, loginUser, registerUser, watchAuth, logoutUser } from '../src/js/db.js';
import {
  collection, doc, query, where, onSnapshot, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── 설정: 차량번호·안내 문구는 여기만 고치면 됨 ──────────────────
export var CARS = [
  { id:'ray1',   name:'레이 1호', short:'레이1',   plate:'', color:'#185FA5', bg:'#E6F1FB' },
  { id:'ray2',   name:'레이 2호', short:'레이2',   plate:'', color:'#854F0B', bg:'#FAEEDA' },
  { id:'starex', name:'스타렉스', short:'스타렉스', plate:'', color:'#3B6D11', bg:'#EAF3DE' }
];
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
var monthCursor = firstOfMonth(new Date());
var form = null;          // 예약 입력 중인 값
var unsub = null, unsubSites = null;
var sites = [];           // FS 사업장 이름 목록 (meta/sites)
var staffList = [];       // 예약자 선택용 직원 [{n:이름 직급, g:소속, p:휴대폰}]
var unsubStaff = null;
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
// 예약자: 등록할 때 고른 사람(최대 2명). 예전 예약은 등록한 사람.
function users(r){ return r.riders&&r.riders.length?r.riders:(r.ownerName?[r.ownerName]:[]); }
function short1(n){ return String(n||'').split(' ')[0]; }
function who(r){ if(r.type==='maint') return '정비'; var u=users(r); return u.length>1?short1(u[0])+' 외'+(u.length-1):short1(u[0]); }
function whoFull(r){ return users(r).join(', '); }
function isMine(r){ var m=short1(me.name); return r.ownerPhone===me.phone||(r.riderPhones||[]).indexOf(me.phone)>=0||users(r).some(function(n){ return short1(n)===m; }); }
function phoneOf(n){ var x=staffList.filter(function(s){ return s.n===n; })[0]; return x&&x.p||''; }
function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('on'); },2600); }

function itemsOn(date,carId){ return list.filter(function(r){ return r.date===date&&(!carId||r.carId===carId); }).sort(function(a,b){ return a.start.localeCompare(b.start); }); }

// ── Firestore ──────────────────────────
function listen(){
  if(unsub) unsub();
  var since = ymd(addDays(new Date(),-70));
  unsub = onSnapshot(query(collection(db,'reservations'), where('date','>=',since)), function(snap){
    list = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    render();
  }, function(err){ console.error(err); toast('예약을 불러오지 못했어요 ('+(err.code||'')+')'); });
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
async function saveReservation(r, olds){
  olds=olds||[];
  var oldIds=olds.map(function(o){ return o.id; });
  return runTransaction(db, async function(tx){
    var keys=[];
    function addKey(k){ if(keys.indexOf(k)<0) keys.push(k); }
    r.segs.forEach(function(s){ addKey(dayKey(r.carId,s.date)); });
    olds.forEach(function(o){ addKey(dayKey(o.carId,o.date)); });
    var ranges={};
    for(var i=0;i<keys.length;i++){
      var snap=await tx.get(doc(db,'carDays',keys[i]));
      ranges[keys[i]]=(snap.exists()?(snap.data().ranges||[]):[]).filter(function(x){ return oldIds.indexOf(x.id)<0; });
    }
    r.segs.forEach(function(s){
      var hit=ranges[dayKey(r.carId,s.date)].filter(function(x){ return overlaps(x,s); })[0];
      if(hit){ var e=new Error('CONFLICT'); e.date=s.date; e.hit=hit; throw e; }
    });
    var refs=r.segs.map(function(s,i){ return i<olds.length?doc(db,'reservations',olds[i].id):doc(collection(db,'reservations')); });
    var gid=refs.length>1?refs[0].id:'';
    var owner=olds[0]||{ ownerPhone:me.phone, ownerName:me.name };
    r.segs.forEach(function(s,i){
      tx.set(refs[i], {
        carId:r.carId, date:s.date, start:s.start, end:s.end, type:r.type, groupId:gid,
        ownerPhone:owner.ownerPhone, ownerName:owner.ownerName,
        dest:r.dest||'', purpose:r.purpose||'', riders:r.riders||[], riderPhones:r.riderPhones||[], memo:r.memo||'', returnedAt:r.returnedAt||'',
        createdAt:(olds[i]&&olds[i].createdAt)||serverTimestamp(), updatedAt:serverTimestamp(), updatedBy:me.phone
      });
      ranges[dayKey(r.carId,s.date)].push({ id:refs[i].id, start:s.start, end:s.end, who:r.type==='maint'?'정비':(r.riders&&r.riders[0]?short1(r.riders[0]):owner.ownerName) });
    });
    olds.slice(r.segs.length).forEach(function(o){ tx.delete(doc(db,'reservations',o.id)); });
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
function render(){
  var app=document.getElementById('app');
  if(!me){ app.innerHTML=''; return; }
  app.innerHTML=topBar()+'<div class="page-body">'+statusRow()+monthView()+myList()+'</div>';
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
    return '<div class="car-stat '+cls+'" data-act="'+(cur?'open':'new')+'" data-id="'+(cur?cur.id:'')+'" data-car="'+c.id+'">'+
      '<div class="cs-name"><span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+(c.plate?' <small>'+esc(c.plate)+'</small>':'')+'</div>'+
      '<div class="cs-state">'+state+'</div><div class="cs-sub">'+sub+'</div></div>';
  }).join('')+'</div>'+(NOTICE?'<div class="notice">'+esc(NOTICE)+'</div>':'');
}
function evLabel(r){ return r.type==='maint'?'정비':who(r)+(r.dest?' '+r.dest:''); }
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
           '<span class="ev-t">'+esc(evLabel(r))+'</span><span class="ev-c">'+c.short+'</span></div>'; }).join('')+
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
    .filter(function(r){ if(!r.groupId) return true; if(seenG[r.groupId]) return false; seenG[r.groupId]=1; return true; }).slice(0,5);
  if(!mine.length) return '';
  return '<div class="card-title">내 예약</div><div class="dash-list-wrap">'+mine.map(function(r){ var c=car(r.carId);
    return '<div class="sup-row" data-act="open" data-id="'+r.id+'"><div class="sup-row-top"><span class="sup-biz">'+esc(r.dest||'-')+'</span>'+
      '<span class="badge-cat" style="background:'+c.bg+';color:'+c.color+'">'+c.short+'</span></div>'+
      '<div class="sup-row-sub">'+esc(shortRangeFull(r))+(r.purpose?' · '+esc(r.purpose):'')+' · '+esc(whoFull(r))+'</div></div>'; }).join('')+'</div>';
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
    (past?'':'<button class="btn primary full" data-act="new" data-date="'+date+'"><i class="ti ti-plus"></i> 이 날 예약 등록</button>');
}
// 휴대폰 화면 여부 (폭 600px 이하)
var mq=window.matchMedia('(max-width:600px)');
function isMobile(){ return mq.matches; }
try{ mq.addEventListener('change',function(){ if(me&&!form) render(); }); }catch(e){}
var mobileSel=ymd(new Date());
// ── 팝업: 예약 상세 / 그날 목록 (운영지원 달력 팝업과 같은 모양) ──────────────
var popup=null; // {type:'detail', id} | {type:'day', date}
function renderPopup(){
  var el=document.getElementById('popup');
  if(!popup){ el.className='cal-popup'; el.innerHTML=''; return; }
  var h='';
  if(popup.type==='detail'){
    var r=list.filter(function(x){ return x.id===popup.id; })[0];
    if(!r){ popup=null; el.className='cal-popup'; el.innerHTML=''; return; }
    var g=group(r), c=car(r.carId), edit=canEdit(r), others=isAdmin()&&r.ownerPhone!==me.phone&&(r.riderPhones||[]).indexOf(me.phone)<0;
    var inUse=g.some(function(x){ var t=ymd(new Date()), n=nowHM(); return x.date===t&&x.start<=n&&n<x.end; });
    var callP=(r.riderPhones&&r.riderPhones[0])||r.ownerPhone, callN=r.riders&&r.riders[0]?short1(r.riders[0]):short1(r.ownerName);
    h='<div class="cal-popup-inner"><div class="cal-popup-header"><h4><span class="cs-dot" style="background:'+c.color+'"></span>'+c.name+(r.purpose?' <span class="badge-cat">'+esc(r.purpose)+'</span>':'')+'</h4><button class="btn sm" data-act="pclose"><i class="ti ti-x"></i></button></div>'+
      '<div class="cal-popup-body"><div class="dl">'+
      '<div><span>업장</span><b>'+esc(r.dest||'-')+'</b></div>'+
      '<div><span>일시</span><div><b>'+esc(rangeText(g))+'</b>'+(r.returnedAt?' <span class="badge-cat" style="background:#EAF3DE;color:#3B6D11">'+esc(r.returnedAt)+' 반납 완료</span>':'')+'</div></div>'+
      '<div><span>예약자</span><b>'+esc(whoFull(r))+'</b></div>'+
      (r.riders&&r.riders.length&&r.ownerName?'<div><span>등록</span>'+esc(r.ownerName)+(r.ownerPhone===me.phone?' (나)':'')+'</div>':'')+
      (r.memo?'<div><span>상세 내용</span>'+esc(r.memo)+'</div>':'')+'</div>'+
      (edit?(others?'<div class="warn">다른 사람 예약이에요. 관리자 권한으로 수정·취소할 수 있어요.</div>':'')+
        (inUse?'<button class="btn primary full" style="margin:0 0 8px" data-act="return" data-id="'+r.id+'"><i class="ti ti-key"></i> 지금 반납 완료</button>':'')+
        '<div class="pbtns"><button class="btn" data-act="edit" data-id="'+r.id+'"><i class="ti ti-pencil"></i> 수정</button><button class="btn danger" data-act="cancel" data-id="'+r.id+'"><i class="ti ti-trash"></i> 예약 취소</button></div>'
        :(callP?'<div class="pbtns"><a class="btn" href="tel:'+esc(callP)+'"><i class="ti ti-phone"></i> '+esc(callN)+'에게 전화 ('+telFmt(callP)+')</a></div><div class="hint">다른 사람 예약은 보기만 가능해요.</div>':''))+
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
    carId:a?a.carId:(opts.car||null),
    dest:a?(a.dest||''):'', destPicked:!!(a&&a.dest), purpose:a?(a.purpose||''):'',
    riders:a&&a.riders?a.riders.slice(0,2):[], memo:a?(a.memo||''):'',
    maint:a?a.type==='maint':false, busy:false, open:!!a, _n:0
  };
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
// 30분 단위 시간 선택 (06:00 ~ 22:00)
var TIME_OPTS=(function(){ var o=[]; for(var m=6*60;m<=22*60;m+=30) o.push(pad(Math.floor(m/60))+':'+pad(m%60)); return o; })();
function timeSelect(f,v){
  var opts=TIME_OPTS.slice(); if(v&&opts.indexOf(v)<0){ opts.push(v); opts.sort(); }
  return '<select data-f="'+f+'" style="padding:8px 10px;border:.5px solid #ccc;border-radius:8px;font-size:13px;width:100%;background:#fff;color:#1a1a18;font-family:inherit;">'+
    (v?'':'<option value="">선택</option>')+opts.map(function(t){ return '<option'+(t===v?' selected':'')+'>'+t+'</option>'; }).join('')+'</select>';
}
// 소속 이름 (FS 앱 직원 관리와 같은 순서)
var DEPT_ORDER=['운영','CS','지원','관리','영업'];
var DEPT_NAME={ '운영':'운영팀 (FS)', 'CS':'운영팀 (CS)', '지원':'지원팀', '관리':'관리팀', '영업':'영업팀' };
function myShort(){ return String(me.name||'').split(' ')[0]; }
function grp(label, body, opt){ return '<div class="sup-form-group"><label>'+label+(opt?' <span class="opt">'+opt+'</span>':'')+'</label>'+body+'</div>'; }
function renderForm(){
  var el=document.getElementById('form');
  if(!form){ el.className='sup-modal'; el.innerHTML=''; return; }
  var multi=!!form.date&&form.endDate>form.date, valid=formValid(), op=form.open;
  var cars=CARS.map(function(c){ return { c:c, cf:valid?conflictsFor(c.id):null }; });
  if(form.carId&&cars.some(function(x){ return x.c.id===form.carId&&x.cf; })) form.carId=null;

  // 단계별로 하나씩 열림 (수정할 때는 전부 보임)
  var s2=!!form.date;                                    // 시간(오전/오후/종일)
  var s3=s2&&(op||multi||!!form.slot);                   // 출발·반납 시간
  var s4=s3&&valid;                                      // 차량
  var s5=s4&&!!form.carId;                               // 업장
  var s6=s5&&!!form.dest.trim();                         // 예약자 (최대 2명)
  var s6u=s6&&form.riders.length>0;                      // 카테고리
  var s7=s6u&&!!form.purpose;                            // 상세 내용
  var canSave=s7&&!form.busy;

  var h='<div class="sup-modal-inner"><div class="sup-modal-header"><h3>'+(form.editIds.length?'차량 예약 수정':'차량 예약 등록')+'</h3><button class="btn sm" data-act="fclose"><i class="ti ti-x"></i></button></div><div class="sup-modal-body" id="form-body">';
  h+='<div class="g2">'+
     grp('시작일 *','<input type="date" value="'+form.date+'" data-f="date">')+
     grp('종료일','<input type="date" min="'+form.date+'" value="'+(multi?form.endDate:'')+'" data-f="endDate"'+(form.date?'':' disabled')+'>','(기간 사용 시)')+'</div>'+
     (form.date?'<div class="dayb">'+dayLabel(form.date)+(multi?' ~ '+dayLabel(form.endDate)+' · '+datesBetween(form.date,form.endDate).length+'일':'')+dayBookings()+'</div>':'');
  if(s2&&!multi){
    h+='<div class="step">'+grp('시간 *','<div class="chips">'+Object.keys(SLOTS).map(function(k){ var t=SLOTS[k]; return '<div class="staff-chip'+(form.slot===k?' selected':'')+'" data-act="slot" data-k="'+k+'">'+t.label+' <small>'+t.s+'–'+t.e+'</small></div>'; }).join('')+'</div>')+'</div>';
  }
  if(s3){
    h+='<div class="step"><div class="g2">'+
       grp('출발 시간 *'+(multi?' (첫날)':''),timeSelect('start',form.start))+
       grp('반납 시간 *'+(multi?' (마지막 날)':''),timeSelect('end',form.end))+'</div>'+
       (form.start&&form.end&&!valid?'<div class="err">반납 시간이 출발보다 늦어야 해요.</div>':'')+'</div>';
  }
  if(s4){
    h+='<div class="step">'+grp('차량 *','<div class="carpicks">'+cars.map(function(x){ var c=x.c, on=form.carId===c.id;
      return '<div class="carpick'+(x.cf?' no':on?' on':'')+'" data-act="car" data-car="'+c.id+'" style="'+(on?'border-color:'+c.color+';background:'+c.bg+';':'')+'">'+
        '<div class="cp-n"><span class="cs-dot" style="background:'+(x.cf?'#ccc':c.color)+'"></span>'+c.name+'</div>'+
        '<div class="cp-s'+(x.cf?' bad':'')+'">'+(x.cf?esc(who(x.cf.r))+' '+x.cf.r.start+'–'+x.cf.r.end+(x.cf.date!==form.date?' ('+(parseYmd(x.cf.date).getMonth()+1)+'/'+parseYmd(x.cf.date).getDate()+')':''):'비어 있음')+'</div></div>'; }).join('')+'</div>'+
      (cars.every(function(x){ return x.cf; })?'<div class="err">이 시간엔 빈 차가 없어요. 시간을 바꿔보세요.</div>':''))+'</div>';
  }
  if(s5){
    h+='<div class="step">'+grp('업장 선택 *','<div class="searchable-select"><input id="f-dest" type="text" autocomplete="off" placeholder="업장명 검색..." value="'+esc(form.dest)+'" data-f="dest"><div id="dest-sug" class="ss-dropdown"></div></div>')+'</div>';
  }
  if(s6){
    var people=staffList.slice();
    form.riders.forEach(function(n){ if(!people.some(function(x){ return x.n===n; })) people.push({ n:n, g:'' }); });
    var groups=[]; people.forEach(function(x){ if(groups.indexOf(x.g)<0) groups.push(x.g); });
    groups.sort(function(a,b){ var ia=DEPT_ORDER.indexOf(a), ib=DEPT_ORDER.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
    h+='<div class="step">'+grp('예약자 *', people.length?groups.map(function(g){
          return (g?'<div class="chip-grp">'+esc(DEPT_NAME[g]||g+'팀')+'</div>':'')+'<div class="chips">'+people.filter(function(x){ return x.g===g; }).map(function(x){
            return '<div class="staff-chip'+(form.riders.indexOf(x.n)>=0?' selected':'')+'" data-act="rider" data-n="'+esc(x.n)+'">'+esc(x.n)+'</div>'; }).join('')+'</div>';
        }).join(''):'<div class="hint l">직원 목록을 불러오는 중이에요…</div>','(차를 쓰는 사람 · 최대 2명)')+'</div>';
  }
  if(s6u){
    h+='<div class="step">'+grp('카테고리 *','<div class="chips">'+PURPOSES.map(function(p){ return '<div class="staff-chip'+(form.purpose===p?' selected':'')+'" data-act="purpose" data-p="'+p+'">'+p+'</div>'; }).join('')+'</div>')+'</div>';
  }
  if(s7){
    h+='<div class="step">'+grp('상세 내용','<textarea placeholder="용무 간략히 (짐, 특이사항 등)" data-f="memo">'+esc(form.memo)+'</textarea>')+'</div>';
  }
  var hint=!s2?'시작일을 골라주세요.':!s3?'시간을 골라주세요.':!s4?'출발·반납 시간을 확인해주세요.':!s5?'차량을 골라주세요.':!s6?'업장을 골라주세요.':!s6u?'예약자를 골라주세요. (최대 2명)':!s7?'카테고리를 골라주세요.':esc(rangeText(formSegs()))+' · '+car(form.carId).name;
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
async function submitForm(){
  if(!form||!form.carId||!formValid()) return;
  var r={ carId:form.carId, segs:formSegs(), type:'use',
          dest:form.dest.trim(), purpose:form.purpose, riders:form.riders.slice(0,2), riderPhones:form.riders.slice(0,2).map(phoneOf).filter(Boolean), memo:form.memo.trim() };
  var olds=form.olds; form.busy=true; renderForm();
  try{
    await saveReservation(r, olds);
    toast(olds.length?'예약을 수정했어요.':'예약했어요.');
    var d0=parseYmd(r.segs[0].date); form=null; monthCursor=firstOfMonth(d0); render(); popLayer();
  }catch(e){
    console.error(e); form.busy=false;
    if(e.message==='CONFLICT') toast('방금 '+(e.hit&&e.hit.who?e.hit.who+'님이 ':'다른 사람이 ')+'그 시간을 먼저 예약했어요. 다른 시간이나 차를 골라주세요.');
    else if(e.code==='permission-denied') toast('권한이 없어요. 관리자에게 문의해주세요.');
    else toast('저장하지 못했어요. 인터넷 연결을 확인해주세요.');
    renderForm();
  }
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
    mobileSel=ymd(new Date()).slice(0,7)===ymd(monthCursor).slice(0,7)?ymd(new Date()):ymd(monthCursor); render(); }
  else if(a==='day'&&isMobile()){ mobileSel=t.getAttribute('data-date'); render(); }
  else if(a==='day'){ var dt=t.getAttribute('data-date'); if(dt>=ymd(new Date())) openForm({ date:dt }); else { pushLayer(); popup={type:'day',date:dt}; renderPopup(); } }
  else if(a==='daylist'){ pushLayer(); popup={type:'day',date:t.getAttribute('data-date')}; renderPopup(); }
  else if(a==='new'){ openForm({ date:t.getAttribute('data-date')||null, car:t.getAttribute('data-car')||null }); }
  else if(a==='open'){ var id=t.getAttribute('data-id'); if(id){ pushLayer(); popup={type:'detail',id:id}; renderPopup(); } else openForm({ car:t.getAttribute('data-car') }); }
  else if(a==='pclose'){ popup=null; renderPopup(); popLayer(); }
  else if(a==='edit'){ var r=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(r) openForm({ edit:r }); }
  else if(a==='cancel'){
    var r2=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r2) return;
    var g=group(r2);
    if(!confirm(rangeText(g)+' '+car(r2.carId).name+' 예약을 취소할까요?')) return;
    try{ await cancelReservation(g); popup=null; renderPopup(); popLayer(); toast('예약을 취소했어요.'); }
    catch(e){ console.error(e); toast(e.code==='permission-denied'?'본인 예약만 취소할 수 있어요.':'취소하지 못했어요.'); }
  }
  else if(a==='return'){
    var r3=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r3) return;
    var g3=group(r3), td=ymd(new Date()), now=nowHM();
    if(!confirm('지금('+now+') 반납 완료로 처리할까요?\n이후 시간은 다른 사람이 예약할 수 있게 비워져요.')) return;
    var segs=g3.filter(function(x){ return x.date<=td; }).map(function(x){ return { date:x.date, start:x.start, end:x.date===td?now:x.end }; })
      .filter(function(x){ return x.end>x.start; });
    if(!segs.length) return;
    try{
      await saveReservation({ carId:r3.carId, segs:segs, type:'use', dest:r3.dest, purpose:r3.purpose, riders:r3.riders||[], riderPhones:r3.riderPhones||[], memo:r3.memo, returnedAt:now }, g3);
      popup=null; renderPopup(); popLayer(); toast('반납 완료! '+car(r3.carId).name+', 이제 다른 사람이 쓸 수 있어요.');
    }catch(e){ console.error(e); toast(e.code==='permission-denied'?'반납 처리 권한이 없어요.':'반납 처리하지 못했어요.'); }
  }
  else if(a==='fclose'){ form=null; renderForm(); popLayer(); }
  else if(a==='slot'){ var k=t.getAttribute('data-k'); form.slot=k; form.start=SLOTS[k].s; form.end=SLOTS[k].e; renderForm(); }
  else if(a==='car'){ if(t.classList.contains('no')) return; form.carId=t.getAttribute('data-car'); renderForm(); }
  else if(a==='purpose'){ var p=t.getAttribute('data-p'); form.purpose=form.purpose===p?'':p; renderForm(); }
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
  var f=ev.target.getAttribute&&ev.target.getAttribute('data-f'); if(!f||!form) return;
  if(f==='date'){ if(!ev.target.value) return; var len=form.date?datesBetween(form.date,form.endDate).length-1:0; form.date=ev.target.value; form.endDate=ymd(addDays(parseYmd(form.date),len)); }
  else if(f==='endDate'){ var v=ev.target.value; form.endDate=v&&v>form.date?v:form.date; }
  else { form[f]=ev.target.value; if(f==='start'||f==='end') form.slot=form.slot||'custom'; }
  if(f==='memo') return;
  renderForm();
});
document.addEventListener('focusin', function(ev){ if(form&&ev.target.id==='f-dest') openSug(); });
document.addEventListener('focusout', function(ev){
  if(ev.target.id==='f-dest') setTimeout(function(){ var sg=document.getElementById('dest-sug'); if(sg) sg.classList.remove('open'); },150);
});
document.addEventListener('input', function(ev){
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
