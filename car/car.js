// car.js — 차량 예약 앱 (레이 2대). FS 앱과 같은 Firebase·로그인을 쓴다.
import { db, checkAllowedUser, loginUser, registerUser, watchAuth, logoutUser } from '../src/js/db.js';
import {
  collection, doc, query, where, onSnapshot, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── 설정: 차량번호·안내 문구는 여기만 고치면 됨 ──────────────────
export var CARS = [
  { id:'ray1', name:'레이 1호', plate:'', color:'#185FA5', bg:'#E6F1FB' },
  { id:'ray2', name:'레이 2호', plate:'', color:'#C2600F', bg:'#FBEBD6' }
];
var NOTICE = '';                 // 예: '키: 본사 1층 경영지원팀 · 주차: 본사 주차장 B구역'
var DAY_START = 8, DAY_END = 20; // 주간 타임라인에 그리는 시간 범위
var TICKS = [10,12,14,16,18];      // 시간표 눈금
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
var view = 'home';        // 'home' | 'month'
var weekStart = mondayOf(new Date());
var monthCursor = firstOfMonth(new Date());
var monthSel = ymd(new Date());
var sheetId = null;       // 상세 창에 띄운 예약 id
var form = null;          // 예약 입력 중인 값
var unsub = null, unsubSites = null;
var sites = [];           // FS 사업장 이름 목록 (meta/sites)
var staffList = [];       // 동승자 선택용 직원 [{n:이름 직급, g:소속}]
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
function canEdit(r){ return isAdmin()||(r&&r.type!=='maint'&&r.ownerPhone===me.phone); }
function telFmt(p){ p=String(p||''); return p.length===11?p.slice(0,3)+'-'+p.slice(3,7)+'-'+p.slice(7):p; }
function who(r){ return r.type==='maint'?'정비':(r.ownerName||'')+(r.ownerPhone===me.phone?' (나)':''); }
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
        .map(function(x){ return { n:x.title?x.name+' '+x.title:x.name, g:x.group||'운영' }; });
      refreshLists();
    }, function(err){ console.warn('직원 목록 오류', err.code); });
  } else {
    // 차량만 쓰는 직원은 FS 데이터를 못 읽으므로, 관리자가 복사해둔 이름 목록을 읽음
    unsubSites = onSnapshot(doc(db,'meta','sites'), function(snap){
      sites = snap.exists() ? (snap.data().names||[]) : []; refreshLists();
    }, function(err){ console.warn('사업장 목록 없음', err.code); });
    unsubStaff = onSnapshot(doc(db,'meta','staff'), function(snap){
      staffList = (snap.exists() ? (snap.data().names||[]) : []).map(function(n){ return { n:n, g:'' }; }); refreshLists();
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
        dest:r.dest||'', purpose:r.purpose||'', riders:r.riders||[], memo:r.memo||'',
        createdAt:(olds[i]&&olds[i].createdAt)||serverTimestamp(), updatedAt:serverTimestamp(), updatedBy:me.phone
      });
      ranges[dayKey(r.carId,s.date)].push({ id:refs[i].id, start:s.start, end:s.end, who:r.type==='maint'?'정비':owner.ownerName });
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

// ── 화면 ──────────────────────────
function render(){
  var app = document.getElementById('app');
  if(!me){ app.innerHTML=''; return; }
  app.innerHTML = topBar() + (view==='month' ? monthView() : homeView());
  renderSheet(); renderForm();
}
function topBar(){
  var today=new Date();
  return '<header class="top">'+
    (hasApp(me,'fs')?'<a class="back" href="../">← FS</a>':'')+
    '<div class="ttl"><div class="t1">차량 예약</div><div class="t2">'+(today.getMonth()+1)+'월 '+today.getDate()+'일 ('+DOW[today.getDay()]+') · '+esc(me.name)+'</div></div>'+
    '<button class="icon" data-act="view" data-v="'+(view==='month'?'home':'month')+'" aria-label="'+(view==='month'?'주간 보기':'월간 달력')+'">'+(view==='month'?ICON.list:ICON.cal)+'</button>'+
    '<button class="icon" data-act="logout" aria-label="로그아웃">'+ICON.out+'</button>'+
  '</header>';
}
function statusCard(c){
  var t=ymd(new Date()), n=nowHM();
  var today=itemsOn(t,c.id);
  var cur=today.filter(function(r){ return r.start<=n&&n<r.end; })[0];
  var next=list.filter(function(r){ return r.carId===c.id&&(r.date>t||(r.date===t&&r.start>n)); }).sort(function(a,b){ return (a.date+a.start).localeCompare(b.date+b.start); })[0];
  var nextTxt = next ? '다음 예약 '+(next.date===t?'오늘':next.date===ymd(addDays(new Date(),1))?'내일':dayLabel(next.date))+' '+next.start : '다음 예약 없음';
  var cls, state, sub;
  if(cur&&cur.type==='maint'){ cls='busy'; state='정비 중'; sub='~'+cur.end; }
  else if(cur){ var g=group(cur), last=g[g.length-1]; cls='busy'; state='사용 중'; sub=esc(String(cur.ownerName||'').split(' ')[0])+' · ~'+(last.date!==t?(parseYmd(last.date).getMonth()+1)+'/'+parseYmd(last.date).getDate()+' ':'')+last.end+' 반납'; }
  else { cls='free'; state='지금 사용 가능'; sub=nextTxt; }
  return '<button class="stat '+cls+'" data-act="'+(cur?'open':'new')+'" data-id="'+(cur?cur.id:'')+'" data-car="'+c.id+'">'+
    '<span class="row"><span class="dot" style="background:'+c.color+'"></span><b>'+c.name+'</b></span>'+
    (c.plate?'<span class="plate">'+esc(c.plate)+'</span>':'')+
    '<span class="state">'+state+'</span><span class="sub">'+sub+'</span></button>';
}
function homeView(){
  var t=ymd(new Date()), n=nowHM();
  var h='<main class="pad">'+
    '<div class="sec">지금 차량 상태 <span>'+n+' 기준</span></div>'+
    '<div class="stats">'+CARS.map(statusCard).join('')+'</div>'+
    (NOTICE?'<div class="notice">'+esc(NOTICE)+'</div>':'');
  // 주간 타임라인
  var ws=weekStart, we=addDays(ws,6);
  h+='<div class="sec sp"><span class="wk"><button class="nav" data-act="week" data-d="-7" aria-label="이전 주">‹</button>'+
     (ws.getMonth()+1)+'.'+ws.getDate()+' – '+(we.getMonth()+1)+'.'+we.getDate()+
     '<button class="nav" data-act="week" data-d="7" aria-label="다음 주">›</button></span>'+
     '<span class="legend">'+CARS.map(function(c){ return '<i style="background:'+c.color+'"></i>'+c.name.replace('레이 ',''); }).join('')+'</span></div>';
  var span=(DAY_END-DAY_START)*60;
  function pct(m){ return ((m-DAY_START*60)/span*100).toFixed(2)+'%'; }
  var lines=TICKS.map(function(x){ return '<i class="tl-line" style="left:'+pct(x*60)+'"></i>'; }).join('');
  h+='<div class="card tl"><div class="tl-axis"><span></span><div>'+TICKS.map(function(x){ return '<span style="left:'+pct(x*60)+'">'+x+'시</span>'; }).join('')+'</div></div>';
  for(var i=0;i<7;i++){
    var d=addDays(ws,i), ds=ymd(d), isToday=ds===t, wkend=d.getDay()===0||d.getDay()===6;
    h+='<div class="tl-row'+(isToday?' today':'')+'" data-act="new" data-date="'+ds+'">'+
       '<div class="tl-day'+(wkend?' red':'')+'"><b>'+DOW[d.getDay()]+'</b><span>'+d.getDate()+'</span></div><div class="tl-track">'+lines;
    CARS.forEach(function(c,ci){
      itemsOn(ds,c.id).forEach(function(r){
        var a=Math.max(toMin(r.start),DAY_START*60), b=Math.min(toMin(r.end),DAY_END*60); if(b<=a) return;
        var label=r.type==='maint'?'정비':String(r.ownerName||'').split(' ')[0];
        h+='<button class="bar'+(r.type==='maint'?' maint':'')+(r.type!=='maint'&&r.ownerPhone===me.phone?' mine':'')+'" data-act="open" data-id="'+r.id+'" style="left:'+pct(a)+';width:'+((b-a)/span*100).toFixed(2)+'%;top:'+(ci?24:6)+'px;'+(r.type==='maint'?'':'background:'+c.color+';')+'">'+((b-a)>=90?esc(label):'')+'</button>';
      });
    });
    h+='</div></div>';
  }
  h+='</div>';
  // 내 예약
  var seenG={};
  var mine=list.filter(function(r){ return r.ownerPhone===me.phone&&r.type!=='maint'&&(r.date>t||(r.date===t&&r.end>n)); }).sort(function(a,b){ return (a.date+a.start).localeCompare(b.date+b.start); })
    .filter(function(r){ if(!r.groupId) return true; if(seenG[r.groupId]) return false; seenG[r.groupId]=1; return true; }).slice(0,3);
  if(mine.length){
    h+='<div class="sec sp">내 예약</div><div class="card">'+mine.map(function(r){ var d=parseYmd(r.date), c=car(r.carId);
      return '<button class="mine-row" data-act="open" data-id="'+r.id+'"><span class="md"><small>'+DOW[d.getDay()]+'</small><b style="color:'+c.color+'">'+d.getDate()+'</b></span><span class="mt"><b>'+c.name+'</b><small>'+shortRange(r)+(r.dest?' · '+esc(r.dest):'')+'</small></span><span class="chev">›</span></button>'; }).join('')+'</div>';
  }
  h+='<div style="height:90px"></div></main><button class="fab" data-act="new">'+ICON.plus+'예약하기</button>';
  return h;
}
function monthView(){
  var m=monthCursor, y=m.getFullYear(), mo=m.getMonth(), t=ymd(new Date());
  var first=new Date(y,mo,1), lead=(first.getDay()+6)%7, days=new Date(y,mo+1,0).getDate();
  var h='<main class="pad"><div class="mhead"><button class="nav" data-act="month" data-d="-1" aria-label="이전 달">‹</button><b>'+y+'년 '+(mo+1)+'월</b><button class="nav" data-act="month" data-d="1" aria-label="다음 달">›</button></div>'+
    '<div class="mgrid dow">'+['월','화','수','목','금','토','일'].map(function(x,i){ return '<span'+(i>4?' class="red"':'')+'>'+x+'</span>'; }).join('')+'</div><div class="mgrid">';
  for(var i=0;i<lead;i++) h+='<span></span>';
  for(var d=1;d<=days;d++){
    var ds=y+'-'+pad(mo+1)+'-'+pad(d), dow=(lead+d-1)%7;
    var cls='mcell'+(ds===t?' today':'')+(ds===monthSel?' sel':'')+(ds<t?' past':'');
    h+='<button class="'+cls+'" data-act="mday" data-date="'+ds+'"><span class="mn'+(dow>4?' red':'')+'">'+d+'</span>';
    CARS.forEach(function(c){
      var its=itemsOn(ds,c.id), maint=its.some(function(r){ return r.type==='maint'; });
      var mins=its.reduce(function(s,r){ return s+Math.max(0,Math.min(toMin(r.end),18*60)-Math.max(toMin(r.start),9*60)); },0);
      var f=Math.min(1,mins/540);
      h+='<i class="mb" style="background:'+(maint?'repeating-linear-gradient(135deg,#9A968E 0 3px,#D9D6CF 3px 6px)':(f?'linear-gradient(90deg,'+c.color+' '+Math.round(f*100)+'%,#EEECE7 '+Math.round(f*100)+'%)':'#EEECE7'))+'"></i>';
    });
    h+='</button>';
  }
  h+='</div><div class="legend m">'+CARS.map(function(c){ return '<i style="background:'+c.color+'"></i>'+c.name.replace('레이 ',''); }).join('')+'<i class="hatch"></i>정비 <span>막대 길이 = 9~18시 중 예약된 비율</span></div>';
  h+='<div class="sec sp">'+dayLabel(monthSel)+'</div><div class="card">';
  CARS.forEach(function(c){
    var its=itemsOn(monthSel,c.id);
    its.forEach(function(r){ h+='<button class="drow" data-act="open" data-id="'+r.id+'"><i style="background:'+(r.type==='maint'?'#9A968E':c.color)+'"></i><span><b>'+c.name+' · '+esc(who(r))+'</b><small>'+r.start+'–'+r.end+(r.dest?' · '+esc(r.dest):'')+(r.purpose?' · '+esc(r.purpose):'')+'</small></span></button>'; });
    if(!its.length) h+='<div class="drow free"><i style="background:'+c.color+'"></i><span><b class="ok">'+c.name+' · 종일 비어 있음</b></span><button class="mini" data-act="new" data-date="'+monthSel+'" data-car="'+c.id+'">예약</button></div>';
  });
  h+='</div><div style="height:90px"></div></main><button class="fab" data-act="new" data-date="'+monthSel+'">'+ICON.plus+'예약하기</button>';
  return h;
}

// ── 상세 창 ──────────────────────────
function renderSheet(){
  var el=document.getElementById('sheet');
  var r=sheetId&&list.filter(function(x){ return x.id===sheetId; })[0];
  if(!r){ el.className='ov'; el.innerHTML=''; return; }
  var g=group(r), c=car(r.carId), edit=canEdit(r), others=isAdmin()&&r.ownerPhone!==me.phone&&r.type!=='maint';
  var riders=(r.riders||[]).join(', ');
  el.className='ov on';
  el.innerHTML='<div class="sheet" role="dialog" aria-label="예약 상세"><div class="grip"></div>'+
    '<div class="sh-h"><span class="dot lg" style="background:'+c.color+'"></span><b>'+c.name+'</b>'+(r.type==='maint'?'<span class="tag">정비</span>':(r.purpose?'<span class="tag">'+esc(r.purpose)+'</span>':''))+'<button class="x" data-act="close" aria-label="닫기">'+ICON.x+'</button></div>'+
    '<dl>'+(r.dest?'<dt>업장</dt><dd><b>'+esc(r.dest)+'</b></dd>':'')+
    '<dt>일시</dt><dd><b>'+rangeText(g)+'</b></dd>'+
    '<dt>예약자</dt><dd>'+esc(who(r))+'</dd>'+
    (riders?'<dt>동승자</dt><dd>'+esc(riders)+'</dd>':'')+
    (r.memo?'<dt>내용</dt><dd>'+esc(r.memo)+'</dd>':'')+'</dl>'+
    (edit?(others?'<div class="warn">다른 사람 예약이에요. 관리자 권한으로 수정·취소할 수 있어요.</div>':'')+'<div class="btns"><button class="b ghost" data-act="edit" data-id="'+r.id+'">수정</button><button class="b danger" data-act="cancel" data-id="'+r.id+'">예약 취소</button></div>'
         :(r.type!=='maint'&&r.ownerPhone?'<a class="b call" href="tel:'+esc(r.ownerPhone)+'">'+ICON.phone+esc(r.ownerName)+'에게 전화 <small>'+telFmt(r.ownerPhone)+'</small></a><div class="hint">다른 사람 예약은 보기만 가능해요.</div>':''))+
  '</div>';
}

// ── 예약 입력 (운영지원 일정 등록과 같은 순서: 업장 → 날짜 → 시간·차량 → 카테고리 → 지원자 → 내용) ──
function openForm(opts){
  opts=opts||{};
  var g=opts.edit?group(opts.edit):null, a=g&&g[0], b=g&&g[g.length-1];
  var date=a?a.date:(opts.date||ymd(new Date()));
  var slot=a?'custom':(date===ymd(new Date())&&nowHM()>='12:00'?'pm':'am');
  form={
    editIds:g?g.map(function(x){ return x.id; }):[], olds:g||[],
    date:date, endDate:b?b.date:date, slot:slot,
    start:a?a.start:SLOTS[slot].s, end:b?b.end:SLOTS[slot].e,
    carId:a?a.carId:(opts.car||null), carManual:!!(a||opts.car),
    dest:a?(a.dest||''):'', destPicked:!!(a&&a.dest), purpose:a?(a.purpose||''):'', riders:a?(a.riders||[]).slice():[], memo:a?(a.memo||''):'',
    maint:a?a.type==='maint':false, busy:false, open:!!a
  };
  pushLayer(); sheetId=null; render();
}
function pushLayer(){ try{ if(history.state&&history.state.layer) history.replaceState({layer:1},''); else history.pushState({layer:1},''); }catch(e){} }
function popLayer(){ try{ if(history.state&&history.state.layer) history.back(); }catch(e){} }
function datesBetween(a,b){ var out=[], d=parseYmd(a), e=parseYmd(b<a?a:b); while(d<=e&&out.length<31){ out.push(ymd(d)); d=addDays(d,1); } return out; }
function formSegs(){ return segsOf(form.date, form.endDate, form.start, form.end); }
function formValid(){ return form.endDate>form.date || form.end>form.start; }
function conflictsFor(carId){
  var segs=formSegs();
  for(var i=0;i<segs.length;i++){
    var s=segs[i], hit=itemsOn(s.date,carId).filter(function(r){ return form.editIds.indexOf(r.id)<0&&overlaps(r,s); })[0];
    if(hit) return { r:hit, date:s.date };
  }
  return null;
}
function myShort(){ return String(me.name||'').split(' ')[0]; }
function renderForm(){
  var el=document.getElementById('form');
  if(!form){ el.className='full'; el.innerHTML=''; return; }
  var multi=form.endDate>form.date, valid=formValid();
  var cars=CARS.map(function(c){ return { c:c, cf:valid?conflictsFor(c.id):null }; });
  if(form.carId&&cars.some(function(x){ return x.c.id===form.carId&&x.cf; })) form.carId=null;
  if(!form.carId){ var free=cars.filter(function(x){ return !x.cf; })[0]; form.carId=free?free.c.id:null; }

  // 단계 열림: 앞 칸을 채우면 다음 칸이 나타남 (수정할 때는 전부 보임)
  var s1=form.open||form.maint||!!form.dest.trim();
  var s2=s1&&!!form.date;
  var s3=s2&&valid&&!!form.carId&&!form.maint;
  var s4=s3;
  var canSave=valid&&form.carId&&!form.busy&&(form.maint||(form.dest.trim()&&form.purpose));

  var h='<header class="top"><button class="back" data-act="fclose">취소</button><div class="ttl c"><div class="t1">'+(form.editIds.length?'예약 수정':'차량 예약')+'</div></div><span style="width:44px"></span></header><main class="pad form">';

  if(!form.maint){
    h+='<div class="lbl">업장 선택 *</div><div class="dest"><input id="f-dest" type="text" autocomplete="off" placeholder="업장명 검색..." value="'+esc(form.dest)+'" data-f="dest">'+
       (form.dest?'<button class="dest-x" data-act="dclear" aria-label="지우기">'+ICON.x+'</button>':'')+
       '<div id="dest-sug" class="ss-dropdown"></div></div>';
  }
  if(s1){
    h+='<div class="step"><div class="two">'+
       '<div><div class="lbl">시작일 * <button class="lnk" data-act="fdate" data-date="'+ymd(new Date())+'">오늘</button><button class="lnk" data-act="fdate" data-date="'+ymd(addDays(new Date(),1))+'">내일</button></div>'+
       '<input type="date" value="'+form.date+'" data-f="date"></div>'+
       '<div><div class="lbl">종료일 <span>(기간 사용 시)</span></div><input type="date" min="'+form.date+'" value="'+(multi?form.endDate:'')+'" data-f="endDate"></div></div>'+
       '<div class="lbl-sub">'+dayLabel(form.date)+(multi?' ~ '+dayLabel(form.endDate)+' · '+datesBetween(form.date,form.endDate).length+'일':'')+'</div></div>';
  }
  if(s2){
    h+='<div class="step"><div class="lbl">시간 *</div>'+
       (multi?'':'<div class="slots">'+Object.keys(SLOTS).map(function(k){ var t=SLOTS[k]; return '<button class="slot'+(form.slot===k?' on':'')+'" data-act="slot" data-k="'+k+'"><b>'+t.label+'</b><small>'+t.s+'–'+t.e+'</small></button>'; }).join('')+'</div>')+
       '<div class="times"><label>출발'+(multi?' (첫날)':'')+'<input type="time" step="1800" value="'+form.start+'" data-f="start"></label><span>–</span><label>반납'+(multi?' (마지막 날)':'')+'<input type="time" step="1800" value="'+form.end+'" data-f="end"></label></div>'+
       (valid?'':'<div class="err">반납 시간이 출발보다 늦어야 해요.</div>');
    h+='<div class="lbl">차량 *</div>'+cars.map(function(x){ var c=x.c, on=form.carId===c.id;
      return '<button class="carpick'+(x.cf?' no':on?' on':'')+'" data-act="car" data-car="'+c.id+'"'+(x.cf?' disabled':'')+'><span class="dot lg" style="background:'+(x.cf?'#ccc':c.color)+'"></span><span class="cp"><b>'+c.name+'</b><small'+(x.cf?' class="bad"':'')+'>'+
        (x.cf?(x.cf.date!==form.date?dayLabel(x.cf.date)+' ':'')+esc(who(x.cf.r))+' '+x.cf.r.start+'–'+x.cf.r.end+' 사용 — 시간이 겹쳐요':(c.plate?esc(c.plate)+' · ':'')+'이 시간 비어 있음')+'</small></span><span class="tagr">'+(x.cf?'예약 불가':on?'선택됨':'')+'</span></button>'; }).join('')+'</div>';
  }
  if(s3){
    h+='<div class="step"><div class="lbl">카테고리 *</div><div class="chips">'+PURPOSES.map(function(p){ return '<button class="chip'+(form.purpose===p?' on':'')+'" data-act="purpose" data-p="'+p+'">'+p+'</button>'; }).join('')+'</div></div>';
  }
  if(s4){
    var mine=myShort();
    var people=staffList.filter(function(x){ return x.n.split(' ')[0]!==mine; });
    form.riders.forEach(function(n){ if(!people.some(function(x){ return x.n===n; })) people.push({ n:n, g:'' }); });
    var groups=[]; people.forEach(function(x){ if(groups.indexOf(x.g)<0) groups.push(x.g); });
    h+='<div class="step"><div class="lbl">동승자 <span>같이 가는 사람이 있으면 선택</span></div>'+
       (people.length?groups.map(function(g){
          return (g?'<div style="font-size:11px;color:#8A877F;margin:6px 2px 5px;">'+esc(g)+'팀</div>':'')+'<div class="chips">'+people.filter(function(x){ return x.g===g; }).map(function(x){
            return '<button class="chip'+(form.riders.indexOf(x.n)>=0?' on':'')+'" data-act="rider" data-n="'+esc(x.n)+'">'+esc(x.n)+'</button>'; }).join('')+'</div>';
        }).join(''):'<div class="lbl-sub">직원 목록을 불러오는 중이에요…</div>')+
       '<div class="lbl">상세 내용</div><textarea placeholder="용무 간략히 (짐, 특이사항 등)" data-f="memo">'+esc(form.memo)+'</textarea></div>';
  }
  h+='<div style="height:130px"></div></main><footer class="foot"><div class="sum">'+
     (canSave?esc(rangeText(formSegs()))+' · '+car(form.carId).name+(form.maint?' · 정비':' · '+esc(form.dest)):
      (!s1?'업장을 먼저 골라주세요.':!valid?'':!form.carId?'이 시간엔 빈 차가 없어요. 시간을 바꿔보세요.':!form.purpose&&!form.maint?'카테고리를 골라주세요.':''))+'</div>'+
     '<button class="b primary" data-act="save"'+(canSave?'':' disabled')+'>'+(form.busy?'저장 중…':form.editIds.length?'수정 저장':'예약 확정')+'</button></footer>';
  var y=el.scrollTop;
  el.className='full on'; el.innerHTML=h; el.scrollTop=y;
}
// 업장 선택: 운영지원 일정 등록과 같은 방식. 칸을 누르면 전체 사업장 목록이 펼쳐지고, 글자를 치면 걸러짐.
// 목록에 없는 곳은 맨 아래 "직접 입력"으로 그대로 쓸 수 있음.
var FIXED_SITES = ['온정본사','온정CS'];
function destSug(q){
  q=String(q||'').trim();
  var ql=q.replace(/\s/g,'').toLowerCase();
  var m=function(n){ return !ql||n.replace(/\s/g,'').toLowerCase().indexOf(ql)>=0; };
  var names=[]; FIXED_SITES.concat(sites).forEach(function(n){ if(n&&names.indexOf(n)<0) names.push(n); });
  var past=[]; list.forEach(function(r){ if(r.dest&&names.indexOf(r.dest)<0&&past.indexOf(r.dest)<0) past.push(r.dest); });
  function opt(n,k,direct){ return '<button class="ss-option'+(direct?' direct':'')+'" data-act="dpick" data-v="'+esc(n)+'"><span>'+(direct?'"'+esc(n)+'" 직접 입력':esc(n))+'</span>'+(k?'<small>'+k+'</small>':'')+'</button>'; }
  var html=names.filter(m).map(function(n){ return opt(n,''); }).join('')+past.filter(m).map(function(n){ return opt(n,'지난 행선지'); }).join('');
  if(q&&names.indexOf(q)<0&&past.indexOf(q)<0) html+=opt(q,'',true);
  return html||'<div class="ss-none">없음</div>';
}
function openSug(){
  var sg=document.getElementById('dest-sug'); if(!sg||!form) return;
  // 이미 고른 업장이면 전체 목록을 다시 보여줌 (운영지원과 동일)
  sg.innerHTML=destSug(form.destPicked?'':form.dest); sg.classList.add('open'); sg.scrollTop=0;
}
async function submitForm(){
  if(!form||!form.carId||!formValid()) return;
  var r={ carId:form.carId, segs:formSegs(), type:form.maint?'maint':'use',
          dest:form.maint?'':form.dest.trim(), purpose:form.maint?'':form.purpose,
          riders:form.maint?[]:form.riders.slice(), memo:form.maint?'':form.memo.trim() };
  var olds=form.olds; form.busy=true; renderForm();
  try{
    await saveReservation(r, olds);
    toast(olds.length?'예약을 수정했어요.':(r.type==='maint'?'정비로 막았어요.':'예약했어요.'));
    form=null; monthSel=r.segs[0].date; weekStart=mondayOf(parseYmd(r.segs[0].date)); render(); popLayer();
  }catch(e){
    console.error(e); form.busy=false;
    if(e.message==='CONFLICT') toast('방금 '+(e.hit&&e.hit.who?e.hit.who+'님이 ':'다른 사람이 ')+'그 시간을 먼저 예약했어요. 다른 시간이나 차를 골라주세요.');
    else if(e.code==='permission-denied') toast('권한이 없어요. 관리자에게 문의해주세요.');
    else toast('저장하지 못했어요. 인터넷 연결을 확인해주세요.');
    renderForm();
  }
}

// ── 이벤트 (화면 전체에서 data-act 하나로 처리) ──────────────────
// 검색 목록을 누를 때 입력칸 포커스가 먼저 빠지면서 화면이 다시 그려지는 걸 막음
document.addEventListener('pointerdown', function(ev){ if(ev.target.closest('.ss-option,.dest-x')) ev.preventDefault(); });
document.addEventListener('click', async function(ev){
  var t=ev.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act');
  if(a==='view'){ view=t.getAttribute('data-v'); render(); }
  else if(a==='logout'){ if(confirm('로그아웃할까요?')){ await logoutUser(); location.reload(); } }
  else if(a==='week'){ weekStart=addDays(weekStart,+t.getAttribute('data-d')); render(); }
  else if(a==='month'){ monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+(+t.getAttribute('data-d')),1); render(); }
  else if(a==='mday'){ monthSel=t.getAttribute('data-date'); render(); }
  else if(a==='new'){ ev.stopPropagation(); openForm({ date:t.getAttribute('data-date')||(view==='month'?monthSel:null), car:t.getAttribute('data-car')||null }); }
  else if(a==='open'){ ev.stopPropagation(); var id=t.getAttribute('data-id'); if(id){ pushLayer(); sheetId=id; renderSheet(); } else openForm({ car:t.getAttribute('data-car') }); }
  else if(a==='close'){ sheetId=null; renderSheet(); popLayer(); }
  else if(a==='edit'){ var r=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(r) openForm({ edit:r }); }
  else if(a==='cancel'){
    var r2=list.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!r2) return;
    var g=group(r2);
    if(!confirm(rangeText(g)+' '+car(r2.carId).name+' 예약을 취소할까요?')) return;
    try{ await cancelReservation(g); sheetId=null; renderSheet(); popLayer(); toast('예약을 취소했어요.'); }
    catch(e){ console.error(e); toast(e.code==='permission-denied'?'본인 예약만 취소할 수 있어요.':'취소하지 못했어요.'); }
  }
  else if(a==='fclose'){ form=null; render(); popLayer(); }
  else if(a==='fdate'){ var nd=t.getAttribute('data-date'); var len=datesBetween(form.date,form.endDate).length-1; form.date=nd; form.endDate=ymd(addDays(parseYmd(nd),len)); renderForm(); }
  else if(a==='slot'){ var k=t.getAttribute('data-k'); form.slot=k; form.start=SLOTS[k].s; form.end=SLOTS[k].e; renderForm(); }
  else if(a==='car'){ form.carId=t.getAttribute('data-car'); renderForm(); }
  else if(a==='purpose'){ var p=t.getAttribute('data-p'); form.purpose=form.purpose===p?'':p; renderForm(); }
  else if(a==='rider'){ var n=t.getAttribute('data-n'), ix=form.riders.indexOf(n); if(ix>=0) form.riders.splice(ix,1); else form.riders.push(n); renderForm(); }
  else if(a==='save'){ submitForm(); }
  else if(a==='dpick'){ form.dest=t.getAttribute('data-v'); form.destPicked=true; var inp=document.getElementById('f-dest'); if(inp){ inp.value=form.dest; inp.blur(); } renderForm(); }
  else if(a==='dclear'){ form.dest=''; form.destPicked=false; renderForm(); var i=document.getElementById('f-dest'); if(i) i.focus(); }
});
document.addEventListener('click', function(ev){ if(ev.target.id==='sheet'){ sheetId=null; renderSheet(); popLayer(); } });
document.addEventListener('change', function(ev){
  var f=ev.target.getAttribute&&ev.target.getAttribute('data-f'); if(!f||!form) return;
  if(f==='maint'){ form.maint=ev.target.checked; }
  else if(f==='date'){ var len=datesBetween(form.date,form.endDate).length-1; form.date=ev.target.value||form.date; form.endDate=ymd(addDays(parseYmd(form.date),len)); }
  else if(f==='endDate'){ var v=ev.target.value; form.endDate=v&&v>form.date?v:form.date; }
  else { form[f]=ev.target.value; if(f==='start'||f==='end') form.slot='custom'; }
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
window.addEventListener('popstate', function(){ if(form){ form=null; render(); } else if(sheetId){ sheetId=null; renderSheet(); } });

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
setInterval(function(){ if(me&&!form) render(); }, 60000);
