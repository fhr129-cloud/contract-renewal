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
var DAY_START = 7, DAY_END = 21; // 주간 타임라인에 그리는 시간 범위
var SLOTS = { am:{label:'오전', s:'09:00', e:'13:00'}, pm:{label:'오후', s:'13:00', e:'18:00'}, day:{label:'종일', s:'09:00', e:'18:00'} };
var PURPOSES = ['운영 지원','위생 점검','물품 배송','미팅','기타'];

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
var unsub = null;
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
}
// 같은 차·같은 날짜의 시간대를 carDays/{차_날짜} 문서 하나에 모아두고, 트랜잭션으로 겹침을 막는다.
function dayKey(carId,date){ return carId+'_'+date; }
async function saveReservation(r, old){
  var dates = r.dates&&r.dates.length ? r.dates : [r.date];
  return runTransaction(db, async function(tx){
    var keys = [];
    dates.forEach(function(d){ var k=dayKey(r.carId,d); if(keys.indexOf(k)<0) keys.push(k); });
    if(old){ var ok=dayKey(old.carId,old.date); if(keys.indexOf(ok)<0) keys.push(ok); }
    var ranges = {};
    for(var i=0;i<keys.length;i++){
      var s = await tx.get(doc(db,'carDays',keys[i]));
      ranges[keys[i]] = (s.exists()?(s.data().ranges||[]):[]).filter(function(x){ return !old||x.id!==old.id; });
    }
    dates.forEach(function(d){
      var hit = ranges[dayKey(r.carId,d)].filter(function(x){ return overlaps(x,r); })[0];
      if(hit){ var e=new Error('CONFLICT'); e.date=d; e.hit=hit; throw e; }
    });
    dates.forEach(function(d){
      var ref = (old&&dates.length===1) ? doc(db,'reservations',old.id) : doc(collection(db,'reservations'));
      tx.set(ref, {
        carId:r.carId, date:d, start:r.start, end:r.end, type:r.type,
        ownerPhone: old?old.ownerPhone:me.phone, ownerName: old?old.ownerName:me.name,
        dest:r.dest||'', purpose:r.purpose||'', memo:r.memo||'',
        createdAt: old&&old.createdAt?old.createdAt:serverTimestamp(), updatedAt: serverTimestamp(),
        updatedBy: me.phone
      });
      ranges[dayKey(r.carId,d)].push({ id:ref.id, start:r.start, end:r.end, who: r.type==='maint'?'정비':(old?old.ownerName:me.name) });
    });
    keys.forEach(function(k){ var i=k.indexOf('_'); tx.set(doc(db,'carDays',k), { carId:k.slice(0,i), date:k.slice(i+1), ranges:ranges[k] }); });
  });
}
async function cancelReservation(r){
  return runTransaction(db, async function(tx){
    var ref = doc(db,'carDays',dayKey(r.carId,r.date));
    var s = await tx.get(ref);
    var rs = (s.exists()?(s.data().ranges||[]):[]).filter(function(x){ return x.id!==r.id; });
    tx.set(ref, { carId:r.carId, date:r.date, ranges:rs });
    tx.delete(doc(db,'reservations',r.id));
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
  else if(cur){ cls='busy'; state='사용 중'; sub=esc(cur.ownerName)+' · ~'+cur.end+' 반납'; }
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
  h+='<div class="card tl"><div class="tl-axis"><span></span><div>'+[7,10,13,16,19].map(function(x){ return '<span style="left:'+((x-DAY_START)/(DAY_END-DAY_START)*100)+'%">'+x+'시</span>'; }).join('')+'</div></div>';
  for(var i=0;i<7;i++){
    var d=addDays(ws,i), ds=ymd(d), isToday=ds===t, wkend=d.getDay()===0||d.getDay()===6;
    h+='<div class="tl-row'+(isToday?' today':'')+'" data-act="new" data-date="'+ds+'">'+
       '<div class="tl-day'+(wkend?' red':'')+'">'+DOW[d.getDay()]+' '+d.getDate()+(isToday?'<em>오늘</em>':'')+'</div><div class="tl-track">';
    CARS.forEach(function(c,ci){
      itemsOn(ds,c.id).forEach(function(r){
        var a=Math.max(toMin(r.start),DAY_START*60), b=Math.min(toMin(r.end),DAY_END*60); if(b<=a) return;
        var L=(a-DAY_START*60)/((DAY_END-DAY_START)*60)*100, W=(b-a)/((DAY_END-DAY_START)*60)*100;
        h+='<button class="bar'+(r.type==='maint'?' maint':'')+(r.type!=='maint'&&r.ownerPhone===me.phone?' mine':'')+'" data-act="open" data-id="'+r.id+'" style="left:'+L+'%;width:'+W+'%;top:'+(ci?17:3)+'px;'+(r.type==='maint'?'':'background:'+c.color+';')+'">'+esc(r.type==='maint'?'정비':r.ownerName)+'</button>';
      });
    });
    if(isToday){ var nm=toMin(n); if(nm>DAY_START*60&&nm<DAY_END*60) h+='<span class="now" style="left:'+((nm-DAY_START*60)/((DAY_END-DAY_START)*60)*100)+'%"></span>'; }
    if(!itemsOn(ds).length) h+='<span class="empty">비어 있음 · 누르면 예약</span>';
    h+='</div></div>';
  }
  h+='</div>';
  // 내 예약
  var mine=list.filter(function(r){ return r.ownerPhone===me.phone&&r.type!=='maint'&&(r.date>t||(r.date===t&&r.end>n)); }).sort(function(a,b){ return (a.date+a.start).localeCompare(b.date+b.start); }).slice(0,3);
  if(mine.length){
    h+='<div class="sec sp">내 예약</div><div class="card">'+mine.map(function(r){ var d=parseYmd(r.date), c=car(r.carId);
      return '<button class="mine-row" data-act="open" data-id="'+r.id+'"><span class="md"><small>'+DOW[d.getDay()]+'</small><b style="color:'+c.color+'">'+d.getDate()+'</b></span><span class="mt"><b>'+c.name+'</b><small>'+r.start+' – '+r.end+(r.dest?' · '+esc(r.dest):'')+'</small></span><span class="chev">›</span></button>'; }).join('')+'</div>';
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
  var c=car(r.carId), edit=canEdit(r), others=isAdmin()&&r.ownerPhone!==me.phone&&r.type!=='maint';
  el.className='ov on';
  el.innerHTML='<div class="sheet" role="dialog" aria-label="예약 상세"><div class="grip"></div>'+
    '<div class="sh-h"><span class="dot lg" style="background:'+c.color+'"></span><b>'+c.name+'</b>'+(r.type==='maint'?'<span class="tag">정비</span>':'')+'<button class="x" data-act="close" aria-label="닫기">'+ICON.x+'</button></div>'+
    '<dl><dt>사용자</dt><dd><b>'+esc(who(r))+'</b></dd><dt>일시</dt><dd><b>'+dayLabel(r.date)+' '+r.start+' – '+r.end+'</b></dd>'+
    (r.dest?'<dt>행선지</dt><dd>'+esc(r.dest)+'</dd>':'')+((r.purpose||r.memo)?'<dt>용무</dt><dd>'+esc([r.purpose,r.memo].filter(Boolean).join(' · '))+'</dd>':'')+'</dl>'+
    (edit?(others?'<div class="warn">다른 사람 예약이에요. 관리자 권한으로 수정·취소할 수 있어요.</div>':'')+'<div class="btns"><button class="b ghost" data-act="edit" data-id="'+r.id+'">수정</button><button class="b danger" data-act="cancel" data-id="'+r.id+'">예약 취소</button></div>'
         :(r.type!=='maint'&&r.ownerPhone?'<a class="b call" href="tel:'+esc(r.ownerPhone)+'">'+ICON.phone+esc(r.ownerName)+'에게 전화 <small>'+telFmt(r.ownerPhone)+'</small></a><div class="hint">다른 사람 예약은 보기만 가능해요.</div>':''))+
  '</div>';
}

// ── 예약 입력 ──────────────────────────
function openForm(opts){
  opts=opts||{};
  var base = opts.edit;
  var date = base?base.date:(opts.date||ymd(new Date()));
  var slot = base?'custom':(date===ymd(new Date())&&nowHM()>='12:00'?'pm':'am');
  form = {
    editId: base?base.id:null, date:date, endDate:date, slot:slot,
    start: base?base.start:SLOTS[slot].s, end: base?base.end:SLOTS[slot].e,
    carId: base?base.carId:(opts.car||null), dest: base?base.dest:'', purpose: base?base.purpose:'', memo: base?base.memo:'',
    maint: base?base.type==='maint':false, busy:false
  };
  pushLayer(); sheetId=null; render();
}
// 안드로이드 '뒤로' 버튼이 창만 닫도록 기록을 하나 쌓는다
function pushLayer(){ try{ if(history.state&&history.state.layer) history.replaceState({layer:1},''); else history.pushState({layer:1},''); }catch(e){} }
function popLayer(){ try{ if(history.state&&history.state.layer) history.back(); }catch(e){} }
function conflictsFor(carId){
  var dates=form.maint?datesBetween(form.date,form.endDate):[form.date];
  for(var i=0;i<dates.length;i++){
    var hit=itemsOn(dates[i],carId).filter(function(r){ return r.id!==form.editId&&overlaps(r,form); })[0];
    if(hit) return { r:hit, date:dates[i] };
  }
  return null;
}
function datesBetween(a,b){ var out=[], d=parseYmd(a), e=parseYmd(b<a?a:b); while(d<=e&&out.length<31){ out.push(ymd(d)); d=addDays(d,1); } return out; }
function renderForm(){
  var el=document.getElementById('form');
  if(!form){ el.className='full'; el.innerHTML=''; return; }
  var valid = form.end>form.start;
  var cars = CARS.map(function(c){ var cf=valid?conflictsFor(c.id):null; return { c:c, cf:cf }; });
  if(form.carId&&cars.some(function(x){ return x.c.id===form.carId&&x.cf; })) form.carId=null;
  if(!form.carId){ var free=cars.filter(function(x){ return !x.cf; })[0]; form.carId=free?free.c.id:null; }
  var dests=[]; list.forEach(function(r){ if(r.dest&&dests.indexOf(r.dest)<0) dests.push(r.dest); });
  var canSave = valid&&form.carId&&!form.busy;
  var h='<header class="top"><button class="back" data-act="fclose">취소</button><div class="ttl c"><div class="t1">'+(form.editId?'예약 수정':'예약하기')+'</div></div><span style="width:44px"></span></header><main class="pad form">';
  h+='<label class="lbl" for="f-date">날짜</label><div class="daterow"><input id="f-date" type="date" value="'+form.date+'" data-f="date">'+
     [0,1,2].map(function(k){ var d=ymd(addDays(new Date(),k)); return '<button class="chip'+(form.date===d?' on':'')+'" data-act="fdate" data-date="'+d+'">'+['오늘','내일','모레'][k]+'</button>'; }).join('')+'</div>'+
     '<div class="lbl">'+dayLabel(form.date)+'</div>';
  h+='<div class="lbl">시간</div><div class="slots">'+Object.keys(SLOTS).map(function(k){ var s=SLOTS[k]; return '<button class="slot'+(form.slot===k?' on':'')+'" data-act="slot" data-k="'+k+'"><b>'+s.label+'</b><small>'+s.s+'–'+s.e+'</small></button>'; }).join('')+'</div>'+
     '<div class="times"><label>출발<input type="time" step="1800" value="'+form.start+'" data-f="start"></label><span>–</span><label>반납<input type="time" step="1800" value="'+form.end+'" data-f="end"></label></div>'+
     (valid?'':'<div class="err">반납 시간이 출발보다 늦어야 해요.</div>');
  h+='<div class="lbl">차량</div>'+cars.map(function(x){ var c=x.c, on=form.carId===c.id;
     return '<button class="carpick'+(x.cf?' no':on?' on':'')+'" data-act="car" data-car="'+c.id+'"'+(x.cf?' disabled':'')+'><span class="dot lg" style="background:'+(x.cf?'#ccc':c.color)+'"></span><span class="cp"><b>'+c.name+'</b><small'+(x.cf?' class="bad"':'')+'>'+
       (x.cf?(x.cf.date!==form.date?dayLabel(x.cf.date)+' ':'')+esc(who(x.cf.r))+' '+x.cf.r.start+'–'+x.cf.r.end+' 사용 — 시간이 겹쳐요':(c.plate?esc(c.plate)+' · ':'')+'이 시간 비어 있음')+'</small></span><span class="tagr">'+(x.cf?'예약 불가':on?'선택됨':'')+'</span></button>'; }).join('');
  if(!form.maint){
    h+='<label class="lbl" for="f-dest">행선지</label><input id="f-dest" type="text" list="dest-list" placeholder="사업장 이름 또는 장소" value="'+esc(form.dest)+'" data-f="dest"><datalist id="dest-list">'+dests.map(function(d){ return '<option value="'+esc(d)+'">'; }).join('')+'</datalist>';
    h+='<div class="lbl">용무 <span>선택</span></div><div class="chips">'+PURPOSES.map(function(p){ return '<button class="chip'+(form.purpose===p?' on':'')+'" data-act="purpose" data-p="'+p+'">'+p+'</button>'; }).join('')+'</div>'+
       '<input type="text" placeholder="메모 (동승자, 짐 등)" value="'+esc(form.memo)+'" data-f="memo">';
  }
  if(isAdmin()&&!(form.editId&&!form.maint)){
    h+='<div class="adm"><div class="admt">관리자에게만 보임</div><label class="chk"><input type="checkbox" data-f="maint"'+(form.maint?' checked':'')+(form.editId?' disabled':'')+'> 정비·검사로 막기</label>'+
       (form.maint&&!form.editId?'<label class="lbl" for="f-end">마지막 날짜 <span>여러 날이면</span></label><input id="f-end" type="date" min="'+form.date+'" value="'+form.endDate+'" data-f="endDate">':'')+
       '<div class="hint">체크하면 "정비"로 표시되고 그 시간엔 아무도 예약할 수 없어요.</div></div>';
  }
  h+='<div style="height:120px"></div></main><footer class="foot"><div class="sum">'+(form.carId&&valid?dayLabel(form.date)+(form.maint&&form.endDate>form.date?' ~ '+dayLabel(form.endDate):'')+' '+form.start+'–'+form.end+' · '+car(form.carId).name+(form.maint?' · 정비':(form.dest?' · '+esc(form.dest):'')):(valid?'이 시간엔 빈 차가 없어요. 시간을 바꿔보세요.':''))+'</div>'+
     '<button class="b primary" data-act="save"'+(canSave?'':' disabled')+'>'+(form.busy?'저장 중…':form.editId?'수정 저장':'예약 확정')+'</button></footer>';
  el.className='full on'; el.innerHTML=h;
}
async function submitForm(){
  if(!form||!form.carId||form.end<=form.start) return;
  var old = form.editId ? list.filter(function(r){ return r.id===form.editId; })[0] : null;
  var r = { carId:form.carId, date:form.date, start:form.start, end:form.end, type:form.maint?'maint':'use',
            dest:form.maint?'':form.dest.trim(), purpose:form.maint?'':form.purpose, memo:form.maint?'':form.memo.trim() };
  if(form.maint&&!old) r.dates = datesBetween(form.date, form.endDate);
  form.busy=true; renderForm();
  try{
    await saveReservation(r, old);
    toast(old?'예약을 수정했어요.':(r.type==='maint'?'정비로 막았어요.':'예약했어요.'));
    form=null; monthSel=r.date; weekStart=mondayOf(parseYmd(r.date)); render(); popLayer();
  }catch(e){
    console.error(e); form.busy=false;
    if(e.message==='CONFLICT') toast('방금 다른 사람이 '+(e.hit&&e.hit.who?e.hit.who+'님이 ':'')+'그 시간을 먼저 예약했어요. 다른 시간이나 차를 골라주세요.');
    else if(e.code==='permission-denied') toast('권한이 없어요. 관리자에게 문의해주세요.');
    else toast('저장하지 못했어요. 인터넷 연결을 확인해주세요.');
    renderForm();
  }
}

// ── 이벤트 (화면 전체에서 data-act 하나로 처리) ──────────────────
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
    if(!confirm(dayLabel(r2.date)+' '+r2.start+'–'+r2.end+' '+car(r2.carId).name+' 예약을 취소할까요?')) return;
    try{ await cancelReservation(r2); sheetId=null; renderSheet(); popLayer(); toast('예약을 취소했어요.'); }
    catch(e){ console.error(e); toast(e.code==='permission-denied'?'본인 예약만 취소할 수 있어요.':'취소하지 못했어요.'); }
  }
  else if(a==='fclose'){ form=null; render(); popLayer(); }
  else if(a==='fdate'){ form.date=t.getAttribute('data-date'); if(form.endDate<form.date) form.endDate=form.date; renderForm(); }
  else if(a==='slot'){ var k=t.getAttribute('data-k'); form.slot=k; form.start=SLOTS[k].s; form.end=SLOTS[k].e; renderForm(); }
  else if(a==='car'){ form.carId=t.getAttribute('data-car'); renderForm(); }
  else if(a==='purpose'){ var p=t.getAttribute('data-p'); form.purpose=form.purpose===p?'':p; renderForm(); }
  else if(a==='save'){ submitForm(); }
});
document.addEventListener('click', function(ev){ if(ev.target.id==='sheet'){ sheetId=null; renderSheet(); popLayer(); } });
document.addEventListener('change', function(ev){
  var f=ev.target.getAttribute&&ev.target.getAttribute('data-f'); if(!f||!form) return;
  if(f==='maint'){ form.maint=ev.target.checked; }
  else { form[f]=ev.target.value; if(f==='start'||f==='end') form.slot='custom'; if(f==='date'&&form.endDate<form.date) form.endDate=form.date; }
  if(f==='dest'||f==='memo') return; // 글자 입력은 다시 그리지 않음 (커서 유지)
  renderForm();
});
document.addEventListener('input', function(ev){
  var f=ev.target.getAttribute&&ev.target.getAttribute('data-f'); if(form&&(f==='dest'||f==='memo')) form[f]=ev.target.value;
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
