// hyg.js — 위생점검 체크리스트 (간단판). FS 앱과 같은 로그인, FS 권한 있는 직원만.
// 분기마다 자동으로 새로 시작. 업장마다 체크(완료) / 빈칸(아직) / 갈 날짜(예정).
import { db, checkAllowedUser, loginUser, registerUser, watchAuth, logoutUser } from '../src/js/db.js';
import {
  collection, doc, query, where, onSnapshot, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { regionOf } from '../src/js/region.js';

// ── 상태 ──────────────────────────
var me=null;                 // {phone,name,role,apps}
var sites=[];                // [{id,name,region}]
var staff=[];                // [{n:'이름 직급', p:휴대폰}]
var checks={};               // siteId → {status:'plan'|'done', planDate, planBy, doneDate, doneBy}
var assign={};               // 지역 → 담당자 (meta/hygAssign)
var filt={ region:'', todo:false };
var opened={};               // 펼친 지역 이름 → true (처음엔 모두 접힘)   // region: '' 전체 | '@mine' 내 담당 | 지역 이름
var dlg=null;                // {siteId, mode:'done'|'plan', prev}
var unsubs=[];
var loginPhone='', isNewUser=false;

// ── 분기 ──────────────────────────
function qOf(d){ return d.getFullYear()+'Q'+(Math.floor(d.getMonth()/3)+1); }
function qLabel(q){ return q.slice(0,4)+'년 '+q.slice(5)+'분기'; }
function qPrev(q){ var y=+q.slice(0,4), n=+q.slice(5)-1; if(n<1){ y--; n=4; } return y+'Q'+n; }
var ROUND=qOf(new Date());

// ── 도구 ──────────────────────────
function pad(n){ return String(n).padStart(2,'0'); }
function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function parseYmd(s){ var p=String(s).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
var DOW=['일','월','화','수','목','금','토'];
function md(s){ if(!s) return ''; var d=parseYmd(s); return (d.getMonth()+1)+'/'+d.getDate(); }
function mdw(s){ if(!s) return ''; var d=parseYmd(s); return (d.getMonth()+1)+'/'+d.getDate()+' ('+DOW[d.getDay()]+')'; }
function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function short1(n){ return String(n||'').split(' ')[0]; }
function hasApp(info,a){ return !info||!info.apps||info.apps.indexOf(a)>=0; }
function isAdmin(){ return !!(me&&me.role==='admin'); }
function myName(){ var x=staff.filter(function(s){ return s.p&&s.p===me.phone; })[0]; return x?x.n:(me.name||''); }
function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('on'); },2600); }
function stOf(id){ var c=checks[id]; return c?c.status:'none'; }
function siteById(id){ return sites.filter(function(x){ return x.id===id; })[0]; }
var ORD={ none:0, plan:1, done:2 };
var CK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';

// 지역: 시·군 단위, 1곳뿐인 지역은 '그 외 지역'
function regions(){
  var by={}; sites.forEach(function(s){ (by[s.region]=by[s.region]||[]).push(s); });
  var rest=[]; Object.keys(by).forEach(function(k){ if(by[k].length<2||k==='기타 지역'){ rest=rest.concat(by[k]); delete by[k]; } });
  var out=Object.keys(by).map(function(k){ return { name:k, items:by[k] }; }).sort(function(a,b){ return b.items.length-a.items.length||a.name.localeCompare(b.name,'ko'); });
  if(rest.length) out.push({ name:'그 외 지역', items:rest });
  return out;
}
function regionKey(s){ var rs=regions(); for(var i=0;i<rs.length;i++) if(rs[i].items.indexOf(s)>=0) return rs[i].name; return ''; }

// ── Firestore ──────────────────────────
function listen(){
  unsubs.forEach(function(u){ u(); }); unsubs=[];
  unsubs.push(onSnapshot(collection(db,'contracts'), function(snap){
    sites=snap.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); })
      .filter(function(x){ return x.name&&!x.terminated; })
      .map(function(x){ return { id:x.id, name:x.name, region:regionOf(x).city }; })
      .sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    render();
  }, function(e){ console.error(e); toast('사업장을 불러오지 못했어요 ('+(e.code||'')+')'); }));
  unsubs.push(onSnapshot(collection(db,'staff'), function(snap){
    staff=snap.docs.map(function(d){ return d.data(); }).filter(function(x){ return x.active!==false&&x.name&&hasApp(x,'fs'); })
      .sort(function(a,b){ return (a.order||99)-(b.order||99); })
      .map(function(x){ return { n:x.title?x.name+' '+x.title:x.name, p:String(x.phone||'').replace(/[^0-9]/g,'') }; });
    render();
  }, function(e){ console.warn('staff', e.code); }));
  unsubs.push(onSnapshot(doc(db,'meta','hygAssign'), function(snap){ assign=snap.exists()?(snap.data().map||{}):{}; render(); }, function(e){ console.warn('assign', e.code); }));
  unsubs.push(onSnapshot(query(collection(db,'hygChecks'), where('round','==',ROUND)), function(snap){
    checks={}; snap.docs.forEach(function(d){ var x=d.data(); checks[x.siteId]=x; }); render();
  }, function(e){ console.error(e); toast('점검 기록을 불러오지 못했어요 ('+(e.code||'')+')'); }));
}
function checkRef(siteId, round){ return doc(db,'hygChecks', (round||ROUND)+'_'+siteId); }

// ── 화면 ──────────────────────────
function box(on){ return '<span class="hz-box'+(on?' on':'')+'">'+(on?CK:'')+'</span>'; }
function itemHtml(s){
  var c=checks[s.id], t=stOf(s.id), r='';
  if(t==='done') r='<span class="hz-r">'+md(c.doneDate)+' '+esc(short1(c.doneBy))+'</span>';
  else if(t==='plan') r='<span class="hz-r p">'+md(c.planDate)+' 갈 예정'+(short1(c.planBy)!==short1(myName())?' · '+esc(short1(c.planBy)):'')+'</span>';
  return '<div class="hz-it'+(t==='done'?' dn':'')+'" data-act="site" data-id="'+s.id+'">'+box(t==='done')+'<span class="hz-nm">'+esc(s.name)+'</span>'+r+'</div>';
}
function render(){
  var app=document.getElementById('app');
  if(!me){ app.innerHTML=''; return; }
  ensureCss();
  var all=regions(), mine=short1(myName());
  var shown=all.filter(function(g){
    if(!filt.region) return true;
    if(filt.region==='@mine') return short1(assign[g.name])===mine;
    return g.name===filt.region;
  });
  var tot=sites.length, done=sites.filter(function(s){ return stOf(s.id)==='done'; }).length;
  var h='<div class="top-bar">'+'<a class="back-btn" href="../"><i class="ti ti-arrow-left"></i> 홈</a>'+
    '<h2>위생점검</h2><div class="top-actions"><span class="hz-q">'+qLabel(ROUND)+'</span><button class="btn sm" data-act="logout" title="로그아웃"><i class="ti ti-logout"></i></button></div></div>';
  h+='<div class="page-body hz">';
  h+='<div class="hz-top"><div class="hz-big"><div class="hz-t">이번 분기 점검</div><div class="hz-n">'+done+'<small> / '+tot+'곳 끝</small></div>'+
    '<div class="hz-bar"><i style="width:'+(tot?100*done/tot:0)+'%"></i></div><div class="hz-left">남은 곳 <b>'+(tot-done)+'</b></div></div>'+
    '<div class="hz-f"><select data-v="region" class="hz-sel"><option value="">전체 지역</option><option value="@mine"'+(filt.region==='@mine'?' selected':'')+'>내 담당 지역</option>'+
      all.map(function(g){ return '<option value="'+esc(g.name)+'"'+(filt.region===g.name?' selected':'')+'>'+esc(g.name)+' ('+g.items.length+')</option>'; }).join('')+'</select>'+
    '<label class="hz-cb"><input type="checkbox" data-v="todo"'+(filt.todo?' checked':'')+'><span>안 한 곳만</span></label></div></div>';
  if(!sites.length) h+='<div class="empty-state">불러오는 중…</div>';
  else if(!shown.length) h+='<div class="empty-state">'+(filt.region==='@mine'?'내 담당으로 지정된 지역이 없어요.':'해당하는 지역이 없어요.')+'</div>';
  h+='<div class="hz-grid">';
  shown.forEach(function(g){
    var d=g.items.filter(function(s){ return stOf(s.id)==='done'; }).length, who=assign[g.name]||'';
    var list=g.items.filter(function(s){ return !filt.todo||stOf(s.id)!=='done'; })
      .sort(function(a,b){ return (ORD[stOf(a.id)]-ORD[stOf(b.id)])||a.name.localeCompare(b.name,'ko'); });
    if(filt.todo&&!list.length) return;
    var whoHtml=isAdmin()
      ? '<select class="hz-as'+(who?'':' empty')+'" data-v="assign" data-k="'+esc(g.name)+'"><option value="">담당 선택</option>'+staff.map(function(x){ return '<option value="'+esc(x.n)+'"'+(x.n===who?' selected':'')+'>담당 '+esc(short1(x.n))+'</option>'; }).join('')+(who&&!staff.some(function(x){ return x.n===who; })?'<option selected value="'+esc(who)+'">담당 '+esc(short1(who))+'</option>':'')+'</select>'
      : (who?'<span class="hz-who">담당 '+esc(short1(who))+'</span>':'');
    var op=!!opened[g.name]||(!!filt.region&&filt.region!=='@mine')||shown.length===1;
    h+='<div class="hz-col'+(op?' open':'')+'"><div class="hz-rh" data-act="toggle" data-k="'+esc(g.name)+'"><b>'+esc(g.name)+'</b>'+whoHtml+
      '<span class="hz-mini"><i style="width:'+(100*d/g.items.length)+'%"></i></span><em>'+d+'<span>/'+g.items.length+'</span></em><i class="ti ti-chevron-'+(op?'up':'down')+' hz-chev"></i></div>'+
      (op?'<div class="hz-lst">'+list.map(itemHtml).join('')+'</div>':'')+'</div>';
  });
  h+='</div></div>';
  app.innerHTML=h;
  renderDlg();
}

// ── 업장 창 ──────────────────────────
function staffSelect(id, val){
  var opts=staff.slice(); if(val&&!opts.some(function(x){ return x.n===val; })) opts.unshift({ n:val });
  return '<select id="'+id+'" class="hz-fld">'+opts.map(function(x){ return '<option value="'+esc(x.n)+'"'+(x.n===val?' selected':'')+'>'+esc(x.n)+(x.n===myName()?' (나)':'')+'</option>'; }).join('')+'</select>';
}
function prevLine(){
  var p=dlg.prev; if(p===undefined) return '';
  return '<div class="hz-prev">지난 분기: '+(p?mdw(p.doneDate)+' · '+esc(short1(p.doneBy)):'기록 없음')+'</div>';
}
function renderDlg(){
  var el=document.getElementById('popup');
  if(!dlg){ el.className='cal-popup'; el.innerHTML=''; return; }
  var s=siteById(dlg.siteId); if(!s){ dlg=null; el.className='cal-popup'; el.innerHTML=''; return; }
  var c=checks[s.id], t=stOf(s.id), today=ymd(new Date()), me_=myName();
  var h='<div class="cal-popup-inner hz-dlg"><h3>'+esc(s.name)+'</h3>';
  if(t==='done'){
    h+='<div class="hz-q2">이미 점검한 곳이에요</div><div class="hz-ok"><b>'+mdw(c.doneDate)+' · '+esc(c.doneBy)+'</b> 완료</div>'+prevLine()+
      '<button class="hz-bo" data-act="undone">잘못 눌렀어요 (완료 취소)</button>';
  } else if(dlg.mode==='plan'){
    h+='<div class="hz-q2">언제 갈 예정인가요?</div>'+
      '<label class="hz-l">갈 날짜</label><input type="date" id="h-pdate" class="hz-fld" min="'+today+'" value="'+(t==='plan'?c.planDate:'')+'">'+
      '<label class="hz-l">점검자</label>'+staffSelect('h-pby', t==='plan'?c.planBy:me_)+
      '<button class="hz-bp" data-act="plan">갈 날짜 적기</button>'+
      '<div class="hz-lk" data-act="mode" data-m="done">← 점검 끝났어요</div>';
  } else {
    h+='<div class="hz-q2">점검 끝났나요?</div>'+
      (t==='plan'?'<div class="hz-planinfo">'+mdw(c.planDate)+' 갈 예정 · '+esc(short1(c.planBy))+'<span data-act="unplan">예정 지우기</span></div>':'')+
      '<label class="hz-l">점검일</label><input type="date" id="h-ddate" class="hz-fld" max="'+today+'" value="'+today+'">'+
      '<label class="hz-l">점검자</label>'+staffSelect('h-dby', me_)+
      '<button class="hz-bg" data-act="done">점검 완료</button>'+prevLine()+
      '<div class="hz-lk" data-act="mode" data-m="plan">'+(t==='plan'?'갈 날짜 바꾸기':'아직 안 갔어요 — 갈 날짜만 적어두기')+'</div>';
  }
  h+='<div class="hz-close" data-act="close">닫기</div></div>';
  el.className='cal-popup open'; el.innerHTML=h;
}
async function loadPrev(siteId){
  try{
    var snap=await getDoc(checkRef(siteId, qPrev(ROUND)));
    var p=snap.exists()?snap.data():null; if(p&&p.status!=='done') p=null;
    if(dlg&&dlg.siteId===siteId){ dlg.prev=p; renderDlg(); }
  }catch(e){ console.warn('prev', e.code); }
}
function base(s){ return { round:ROUND, siteId:s.id, siteName:s.name, region:regionKey(s), updatedAt:serverTimestamp(), updatedBy:me.phone }; }
function errMsg(e){ console.error(e); toast(e.code==='permission-denied'?'저장 권한이 없어요.':'저장하지 못했어요. 다시 해주세요.'); }
async function doDone(){
  var s=siteById(dlg.siteId); if(!s) return;
  var d=document.getElementById('h-ddate').value, by=document.getElementById('h-dby').value;
  if(!d){ toast('점검일을 골라주세요.'); return; }
  var c=checks[s.id]||{};
  try{ await setDoc(checkRef(s.id), Object.assign(base(s), { status:'done', doneDate:d, doneBy:by, planDate:c.planDate||'', planBy:c.planBy||'' })); toast(s.name+' 점검 완료!'); closeDlg(); }
  catch(e){ errMsg(e); }
}
async function doPlan(){
  var s=siteById(dlg.siteId); if(!s) return;
  var d=document.getElementById('h-pdate').value, by=document.getElementById('h-pby').value;
  if(!d){ toast('갈 날짜를 골라주세요.'); return; }
  var c=checks[s.id];
  if(c&&c.status==='plan'&&c.planBy!==by&&!confirm(short1(c.planBy)+'님이 '+md(c.planDate)+'에 가기로 적어뒀어요. 바꿀까요?')) return;
  try{ await setDoc(checkRef(s.id), Object.assign(base(s), { status:'plan', planDate:d, planBy:by })); toast(s.name+' '+md(d)+' 갈 예정으로 적었어요.'); closeDlg(); }
  catch(e){ errMsg(e); }
}
async function undo(what){
  var s=siteById(dlg.siteId), c=s&&checks[s.id]; if(!c) return;
  if(!confirm(what==='plan'?'갈 예정을 지울까요?':'완료를 취소할까요?')) return;
  try{ await deleteDoc(checkRef(s.id)); toast('취소했어요.'); dlg.mode='done'; renderDlg(); }
  catch(e){ errMsg(e); }
}
function openDlg(id){ dlg={ siteId:id, mode:'done' }; try{ history.pushState({ hz:1 },''); }catch(e){} renderDlg(); loadPrev(id); }
function closeDlg(){ if(!dlg) return; dlg=null; renderDlg(); try{ if(history.state&&history.state.hz) history.back(); }catch(e){} }
async function saveAssign(region, name){
  var map=Object.assign({}, assign); if(name) map[region]=name; else delete map[region];
  try{ await setDoc(doc(db,'meta','hygAssign'), { map:map, updatedAt:serverTimestamp(), by:me.phone }); toast(region+' 담당: '+(name?short1(name):'없음')); }
  catch(e){ console.error(e); toast(e.code==='permission-denied'?'관리자만 바꿀 수 있어요.':'저장하지 못했어요.'); render(); }
}

// ── 이벤트 ──────────────────────────
document.addEventListener('click', async function(ev){
  if(ev.target.id==='popup'){ closeDlg(); return; }
  if(ev.target.closest('select')) return;   // 담당 드롭다운 누를 땐 접고 펴지 않음
  var t=ev.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act');
  if(a==='logout'){ if(confirm('로그아웃할까요?')){ await logoutUser(); location.reload(); } }
  else if(a==='toggle'){ var k=t.getAttribute('data-k'); opened[k]=!opened[k]; render(); }
  else if(a==='site'){ openDlg(t.getAttribute('data-id')); }
  else if(a==='close'){ closeDlg(); }
  else if(a==='mode'){ dlg.mode=t.getAttribute('data-m'); renderDlg(); }
  else if(a==='done'){ doDone(); }
  else if(a==='plan'){ doPlan(); }
  else if(a==='unplan'){ undo('plan'); }
  else if(a==='undone'){ undo('done'); }
});
document.addEventListener('change', function(ev){
  var v=ev.target.getAttribute&&ev.target.getAttribute('data-v'); if(!v) return;
  if(v==='region'){ filt.region=ev.target.value; render(); }
  else if(v==='todo'){ filt.todo=ev.target.checked; render(); }
  else if(v==='assign'){ saveAssign(ev.target.getAttribute('data-k'), ev.target.value); }
});
window.addEventListener('popstate', function(){ if(dlg){ dlg=null; renderDlg(); } });
// 자정 넘어 앱을 켜둔 채 분기가 바뀌면 새로고침
setInterval(function(){ if(qOf(new Date())!==ROUND) location.reload(); }, 60000);

var CSS=
  '.hz-q{font-size:13px;color:#666;margin-right:6px;white-space:nowrap;}'+
  '.hz-top{max-width:640px;}'+
  '.hz-big{background:#fff;border:.5px solid #e8e8e4;border-radius:14px;padding:16px;}'+
  '.hz-t{font-size:13px;color:#666;}.hz-n{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.2;}.hz-n small{font-size:15px;color:#999;font-weight:500;letter-spacing:0;}'+
  '.hz-bar{height:10px;border-radius:99px;background:#eceae4;overflow:hidden;margin-top:10px;}.hz-bar i{display:block;height:100%;background:#3B6D11;border-radius:99px;transition:width .3s;}'+
  '.hz-left{font-size:12px;color:#888;margin-top:6px;}.hz-left b{color:#1a1a18;}'+
  '.hz-f{display:flex;gap:12px;align-items:center;margin:12px 0 4px;}'+
  '.hz-sel{flex:1;min-width:0;padding:9px 10px;border:.5px solid #ccc;border-radius:8px;font-size:14px;background:#fff;color:#1a1a18;font-family:inherit;}'+
  '.hz-cb{display:inline-flex;align-items:center;gap:6px;font-size:14px;white-space:nowrap;cursor:pointer;}.hz-cb input{width:20px;height:20px;margin:0;accent-color:#3B6D11;}'+
  '.hz-col{background:#fff;border:.5px solid #e8e8e4;border-radius:12px;overflow:hidden;margin-top:8px;}.hz-col.open{border-color:#B5D4F4;}'+
  '.hz-rh{display:flex;align-items:center;gap:8px;padding:13px 14px;font-size:13px;cursor:pointer;}.hz-rh b{font-size:15px;white-space:nowrap;}'+
  '.hz-mini{flex:1;max-width:90px;height:6px;border-radius:99px;background:#eceae4;overflow:hidden;margin-left:auto;}.hz-mini i{display:block;height:100%;background:#3B6D11;}'+
  '.hz-chev{color:#aaa;font-size:15px;}'+
  '.hz-rh em{font-style:normal;min-width:34px;text-align:right;font-size:13px;font-weight:700;}.hz-rh em span{color:#999;font-weight:400;}'+
  '.hz-who{font-size:12px;color:#888;}'+
  '.hz-as{font-size:12px;color:#185FA5;border:.5px solid #B5D4F4;border-radius:6px;padding:3px 4px;background:#F5F9FD;font-family:inherit;max-width:110px;}.hz-as.empty{color:#999;border-color:#ddd;background:#fff;}'+
  '.hz-lst{border-top:.5px solid #eee;}'+
  '.hz-it{display:flex;align-items:center;gap:12px;padding:12px 14px;border-top:.5px solid #f0f0ec;font-size:15px;cursor:pointer;}.hz-it:first-child{border-top:0;}.hz-it:active{background:#f5f5f2;}'+
  '.hz-nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;}.hz-it.dn .hz-nm{color:#999;font-weight:400;}'+
  '.hz-r{font-size:12px;color:#888;white-space:nowrap;}.hz-r.p{color:#185FA5;font-weight:600;}'+
  '.hz-box{width:20px;height:20px;border:1.5px solid #bbb;border-radius:4px;background:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;}.hz-box.on{background:#3B6D11;border-color:#3B6D11;}'+
  '.hz-dlg{width:340px;max-width:calc(100% - 32px);padding:22px 20px 16px;border-radius:16px;box-sizing:border-box;}'+
  '.hz-dlg h3{margin:0;font-size:19px;}.hz-q2{font-size:14px;color:#555;margin:4px 0 14px;}'+
  '.hz-l{display:block;font-size:12px;color:#888;margin:0 0 4px;}'+
  '.hz-fld{width:100%;padding:11px 12px;border:.5px solid #ccc;border-radius:10px;font-size:15px;margin-bottom:10px;background:#fff;color:#1a1a18;font-family:inherit;box-sizing:border-box;}'+
  '.hz-bg,.hz-bp,.hz-bo{display:flex;width:100%;align-items:center;justify-content:center;padding:14px;border-radius:12px;font-size:16px;font-weight:700;border:0;font-family:inherit;cursor:pointer;margin-top:4px;}'+
  '.hz-bg{background:#3B6D11;color:#fff;}.hz-bp{background:#185FA5;color:#fff;}.hz-bo{background:#fff;border:.5px solid #ccc;color:#444;font-size:14px;font-weight:500;}'+
  '.hz-lk{text-align:center;font-size:13px;color:#185FA5;margin-top:14px;cursor:pointer;}'+
  '.hz-close{text-align:center;font-size:13px;color:#999;margin-top:12px;cursor:pointer;padding:4px;}'+
  '.hz-ok{background:#EAF3DE;color:#27500A;border-radius:12px;padding:14px;font-size:14px;margin-bottom:10px;}'+
  '.hz-prev{font-size:12px;color:#888;margin:10px 0 0;text-align:center;}'+
  '.hz-planinfo{display:flex;align-items:center;gap:8px;background:#E6F1FB;color:#0C447C;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px;}.hz-planinfo span{margin-left:auto;color:#A32D2D;font-size:12px;cursor:pointer;text-decoration:underline;}'+
  '@media(min-width:900px){.hz-top{display:flex;gap:16px;align-items:stretch;max-width:none;}.hz-big{flex:1;}.hz-f{flex-direction:column;align-items:stretch;justify-content:center;margin:0;width:240px;gap:10px;}.hz-f .hz-sel{flex:none;}'+
  '.hz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0 12px;align-items:start;}.hz-it{font-size:14px;padding:9px 12px;gap:10px;}}';
function ensureCss(){ if(document.getElementById('hz-css')) return; var st=document.createElement('style'); st.id='hz-css'; st.textContent=CSS; document.head.appendChild(st); }

// ── 로그인 (차량 예약과 같은 방식, FS 권한 필요) ──────────────────────────
function showLogin(step, msg){
  var el=document.getElementById('login'); el.style.display='flex';
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
    if(!hasApp(info,'fs')){ showLogin('phone','위생점검은 FS 권한이 있는 직원만 쓸 수 있어요.'); return; }
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
      try{ await registerUser(loginPhone,pw); } catch(e){ if(e.code==='auth/email-already-in-use') await loginUser(loginPhone,pw); else throw e; }
    } else await loginUser(loginPhone,pw);
  }catch(e){
    console.error(e);
    showLogin('pw', (e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'||e.code==='auth/user-not-found')?'비밀번호가 틀렸어요.':'로그인 오류 ('+(e.code||'')+')');
  }
};
window.lgBack=function(){ showLogin('phone'); };
window.lgLogout=async function(){ await logoutUser(); location.reload(); };
watchAuth(async function(user){
  var splash=document.getElementById('splash');
  if(!user){ me=null; unsubs.forEach(function(u){ u(); }); unsubs=[]; if(splash) splash.remove(); showLogin('phone'); render(); return; }
  var phone=(user.email||'').split('@')[0], info=null;
  try{ info=await checkAllowedUser(phone); }catch(e){ console.error(e); }
  if(splash) splash.remove();
  if(!info||!hasApp(info,'fs')){
    showLogin('phone','이 계정은 위생점검 권한(FS)이 없어요.<br><button class="lg-btn ghost" onclick="lgLogout()">다른 번호로 로그인</button>');
    return;
  }
  document.getElementById('login').style.display='none';
  me={ phone:phone, name:info.name||'', role:info.role||'staff', apps:info.apps };
  listen(); render();
});
