// hyg.js — 위생점검 체크리스트 (간단판). FS 앱과 같은 로그인, FS 권한 있는 직원만.
// 분기마다 자동으로 새로 시작. 업장마다 체크(완료) / 빈칸(아직) / 갈 날짜(예정).
import { db, checkAllowedUser, loginUser, registerUser, watchAuth, logoutUser } from '../src/js/db.js';
import {
  collection, doc, query, where, onSnapshot, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { regionOf } from '../src/js/region.js';
import { COORDS } from '../src/js/coords.js';

// ── 상태 ──────────────────────────
var me=null;                 // {phone,name,role,apps}
var sites=[];                // [{id,name,region,town,lat,lng}]
var staff=[];                // [{n:'이름 직급', p:휴대폰}]
var checks={};               // siteId → {status:'plan'|'done', planDate, planBy, doneDate, doneBy}
var assign={};               // 담당 (meta/hygAssign.map): '평택시' → 기본 담당, '평택시|고덕면' → 그 읍·면만 다른 담당
var filt={ region:'', todo:false, q:'' };
var near={ center:'', r:5 };   // 검색한 업장 근처: 기준 업장 id, 반경 km   // q: 사업장 이름 검색어   // region: '' 전체 | '@mine' 내 담당 | 지역 이름
var opened={};               // 펼친 지역 이름 → true (처음엔 모두 접힘)
var modal=false;             // 관리자 '담당 정하기' 창
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
function kmBetween(a,b){ var R=6371,p=Math.PI/180,dLa=(b.lat-a.lat)*p,dLn=(b.lng-a.lng)*p; var h=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLn/2)*Math.sin(dLn/2); return 2*R*Math.asin(Math.sqrt(h)); }
function fmtKm(d){ return d<1?Math.round(d*1000)+'m':(Math.round(d*10)/10)+'km'; }
function norm(v){ return String(v||'').replace(/\s+/g,'').toLowerCase(); }
function short1(n){ return String(n||'').split(' ')[0]; }
function hasApp(info,a){ return !info||!info.apps||info.apps.indexOf(a)>=0; }
// 위생점검 권한: FS + 위생점검 체크된 직원, 또는 관리자
function canHyg(info){ return !!info&&hasApp(info,'fs')&&(hasApp(info,'hyg')||info.role==='admin'); }
function isAdmin(){ return !!(me&&me.role==='admin'); }
function myName(){ var x=staff.filter(function(s){ return s.p&&s.p===me.phone; })[0]; return x?x.n:(me.name||''); }
function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('on'); },2600); }
function stOf(id){ var c=checks[id]; return c?c.status:'none'; }
function siteById(id){ return sites.filter(function(x){ return x.id===id; })[0]; }
var ORD={ done:0, plan:1, none:2 };   // 완료(날짜순) → 예정(날짜순) → 나머지
var CK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';

// 지역: 시·군 단위 (업장 1곳뿐인 시는 '그 외 지역').
// 카드는 '시 + 담당자'로 묶음: 담당이 한 명이면 시 하나 = 카드 하나, 읍·면별로 담당이 갈리면 담당자 수만큼 카드가 나뉨.
function cities(){
  var by={}; sites.forEach(function(s){ (by[s.region]=by[s.region]||[]).push(s); });
  var rest=[]; Object.keys(by).forEach(function(k){ if(by[k].length<2||k==='기타 지역'){ rest=rest.concat(by[k]); delete by[k]; } });
  var out=Object.keys(by).map(function(k){ return { name:k, items:by[k] }; }).sort(function(a,b){ return b.items.length-a.items.length||a.name.localeCompare(b.name,'ko'); });
  if(rest.length) out.push({ name:'그 외 지역', items:rest, rest:true });
  return out;
}
// 읍·면 단위 구분: 포승읍 / 고덕면 / 동 지역은 '시내' / 주소에서 못 찾으면 '기타'
function townKey(s){ var t=s.town||''; return /[읍면]$/.test(t)?t:/동$/.test(t)?'시내':'기타'; }
function townsOf(c){ var m={}; c.items.forEach(function(s){ var k=townKey(s); m[k]=(m[k]||0)+1; }); return Object.keys(m).sort(function(a,b){ return m[b]-m[a]||a.localeCompare(b,'ko'); }).map(function(k){ return { k:k, n:m[k] }; }); }
function whoFor(city, s){ return (!s||city==='그 외 지역')?(assign[city]||''):(assign[city+'|'+townKey(s)]||assign[city]||''); }
function regions(){
  var out=[];
  cities().forEach(function(c){
    var by={}, order=[];
    c.items.forEach(function(s){ var w=whoFor(c.name,s); if(!by[w]){ by[w]=[]; order.push(w); } by[w].push(s); });
    order.sort(function(a,b){ return by[b].length-by[a].length; });
    order.forEach(function(w){
      var tw=[]; by[w].forEach(function(s){ var k=townKey(s); if(tw.indexOf(k)<0) tw.push(k); });
      out.push({ key:c.name+'#'+w, city:c.name, who:w, items:by[w], towns:tw, split:order.length>1, rest:!!c.rest });
    });
  });
  return out;
}
function regionKey(s){ var rs=regions(); for(var i=0;i<rs.length;i++) if(rs[i].items.indexOf(s)>=0) return rs[i].city; return ''; }

// ── Firestore ──────────────────────────
function listen(){
  unsubs.forEach(function(u){ u(); }); unsubs=[];
  unsubs.push(onSnapshot(collection(db,'contracts'), function(snap){
    sites=snap.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); })
      .filter(function(x){ return x.name&&!x.terminated; })
      .map(function(x){ var rg=regionOf(x), co=(x.lat&&x.lng)?{ lat:x.lat, lng:x.lng }:(COORDS[x.name]||null);
        return { id:x.id, name:x.name, region:rg.city, town:rg.town, co:co }; })
      .sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
    render();
  }, function(e){ console.error(e); toast('사업장을 불러오지 못했어요 ('+(e.code||'')+')'); }));
  unsubs.push(onSnapshot(collection(db,'staff'), function(snap){
    staff=snap.docs.map(function(d){ return d.data(); }).filter(function(x){ return x.active!==false&&x.name&&hasApp(x,'fs')&&hasApp(x,'hyg'); })
      .sort(function(a,b){ return (a.order||99)-(b.order||99); })
      .map(function(x){ return { n:x.title?x.name+' '+x.title:x.name, p:String(x.phone||'').replace(/[^0-9]/g,'') }; });
    render();
  }, function(e){ console.warn('staff', e.code); }));
  unsubs.push(onSnapshot(doc(db,'meta','hygAssign'), function(snap){ var x=snap.exists()?snap.data():{}; assign=x.map||{}; render(); }, function(e){ console.warn('assign', e.code); }));
  unsubs.push(onSnapshot(query(collection(db,'hygChecks'), where('round','==',ROUND)), function(snap){
    checks={}; snap.docs.forEach(function(d){ var x=d.data(); checks[x.siteId]=x; }); render();
  }, function(e){ console.error(e); toast('점검 기록을 불러오지 못했어요 ('+(e.code||'')+')'); }));
}
function checkRef(siteId, round){ return doc(db,'hygChecks', (round||ROUND)+'_'+siteId); }

// ── 화면 ──────────────────────────
function box(on){ return '<span class="hz-box'+(on?' on':'')+'">'+(on?CK:'')+'</span>'; }
function itemHtml(s, dist){
  var c=checks[s.id], t=stOf(s.id), r='';
  if(t==='done') r='<span class="hz-r">'+md(c.doneDate)+' '+esc(short1(c.doneBy))+'</span>';
  else if(t==='plan') r='<span class="hz-r p">'+md(c.planDate)+' 예정'+(short1(c.planBy)!==short1(myName())?' · '+esc(short1(c.planBy)):'')+'</span>';
  return '<div class="hz-it'+(t==='done'?' dn':'')+'" data-act="site" data-id="'+s.id+'">'+box(t==='done')+'<span class="hz-nm">'+esc(s.name)+'</span>'+(dist!=null?'<span class="hz-km">'+fmtKm(dist)+'</span>':'')+r+'</div>';
}
function sortItems(list){
  return list.slice().sort(function(a,b){
    var ta=stOf(a.id), tb=stOf(b.id); if(ta!==tb) return ORD[ta]-ORD[tb];
    var ca=checks[a.id]||{}, cb=checks[b.id]||{};
    if(ta==='done') return String(ca.doneDate).localeCompare(String(cb.doneDate))||a.name.localeCompare(b.name,'ko');
    if(ta==='plan') return String(ca.planDate).localeCompare(String(cb.planDate))||a.name.localeCompare(b.name,'ko');
    return a.name.localeCompare(b.name,'ko');
  });
}
function render(){
  var app=document.getElementById('app');
  if(!me){ app.innerHTML=''; return; }
  ensureCss();
  if(!document.getElementById('hz-list')){
    app.innerHTML='<div class="top-bar"><a class="back-btn" href="../"><i class="ti ti-arrow-left"></i> 홈</a>'+
      '<h2>위생점검</h2><div class="top-actions"><span class="hz-q">'+qLabel(ROUND)+'</span><button class="btn sm" data-act="logout" title="로그아웃"><i class="ti ti-logout"></i></button></div></div>'+
      '<div class="page-body hz"><div id="hz-head"></div>'+
      '<div class="hz-search"><i class="ti ti-search"></i><input id="hz-q" type="search" placeholder="사업장 이름 검색" autocomplete="off"><span class="hz-qx" data-act="qclear" style="display:none">✕</span></div>'+
      '<div class="hz-main"><div id="hz-list"></div>'+
      '<div class="hz-mapcol"><div id="hz-map"></div><div class="hz-maplg"><span><i style="background:#3B6D11"></i>완료</span><span><i style="background:#378ADD"></i>예정</span><span><i style="background:#C8C4BC"></i>안 한 곳</span></div></div></div></div>';
  }
  var all=regions(), mine=short1(myName()), cs=cities();
  var shown=all.filter(function(g){
    if(!filt.region) return true;
    if(filt.region==='@mine') return !!g.who&&short1(g.who)===mine;
    return g.city===filt.region;
  });
  var tot=sites.length, done=sites.filter(function(s){ return stOf(s.id)==='done'; }).length;
  document.getElementById('hz-head').innerHTML='<div class="hz-top"><div class="hz-big"><div class="hz-t">이번 분기 점검</div><div class="hz-n">'+done+'<small> / '+tot+'곳 끝</small></div>'+
    '<div class="hz-bar"><i style="width:'+(tot?100*done/tot:0)+'%"></i></div><div class="hz-left">남은 곳 <b>'+(tot-done)+'</b></div></div>'+
    '<div class="hz-f"><div class="hz-f2"><label class="hz-cb"><input type="checkbox" data-v="mine"'+(filt.region==='@mine'?' checked':'')+'><span>내 담당만</span></label>'+
    '<label class="hz-cb"><input type="checkbox" data-v="todo"'+(filt.todo?' checked':'')+'><span>안 한 곳만</span></label>'+
    (isAdmin()?'<span class="hz-adm" data-act="massign">담당 정하기</span>':'')+'</div></div></div>';
  var q=norm(filt.q), h='', nearInfo=null;
  if(q){ shown=all.filter(function(g){ return g.items.some(function(s){ return norm(s.name).indexOf(q)>=0; }); });
    if(!shown.length&&sites.length) h+='<div class="empty-state">"'+esc(filt.q)+'" 이름의 사업장이 없어요.</div>';
    // 검색한 업장 근처 (반경 km)
    var hits=sites.filter(function(s){ return norm(s.name).indexOf(q)>=0; });
    if(hits.length){
      var ctr=hits.filter(function(s){ return s.id===near.center; })[0]||hits[0];
      var nl=ctr.co?sites.filter(function(s){ return s!==ctr&&s.co; }).map(function(s){ return { s:s, d:kmBetween(ctr.co,s.co) }; })
        .filter(function(x){ return x.d<=near.r; }).sort(function(a,b){ return a.d-b.d; }):[];
      nearInfo={ ctr:ctr, list:nl };
      h+='<div class="hz-near"><div class="hz-near-h"><i class="ti ti-map-pin"></i>'+
        (hits.length>1?'<select data-v="ncenter" class="hz-nsel">'+hits.map(function(s){ return '<option value="'+s.id+'"'+(s===ctr?' selected':'')+'>'+esc(s.name)+'</option>'; }).join('')+'</select>':'<b>'+esc(ctr.name)+'</b>')+
        '<span>근처</span><select data-v="nr" class="hz-nsel">'+[1,3,5,10,20].map(function(k){ return '<option value="'+k+'"'+(near.r===k?' selected':'')+'>'+k+'km 안</option>'; }).join('')+'</select>'+
        '<em>'+nl.length+'곳</em></div>'+
        (!ctr.co?'<div class="hz-near-e">이 업장은 위치 정보가 없어 근처를 찾을 수 없어요.</div>'
          :nl.length?'<div class="hz-lst">'+nl.map(function(x){ return itemHtml(x.s, x.d); }).join('')+'</div>'
          :'<div class="hz-near-e">'+near.r+'km 안에 다른 업장이 없어요. 반경을 넓혀보세요.</div>')+'</div>';
    }
  }
  if(!sites.length) h+='<div class="empty-state">불러오는 중…</div>';
  else if(!shown.length&&!q) h+='<div class="empty-state">'+(filt.region==='@mine'?'내 담당으로 지정된 지역이 없어요.':'해당하는 지역이 없어요.')+'</div>';
  h+='<div class="hz-grid">';
  var mapSites=[];
  shown.forEach(function(g){
    var d=g.items.filter(function(s){ return stOf(s.id)==='done'; }).length, who=g.who;
    var list=sortItems(g.items.filter(function(s){ return (!filt.todo||stOf(s.id)!=='done')&&(!q||norm(s.name).indexOf(q)>=0); }));
    mapSites=mapSites.concat(list);
    if(filt.todo&&!list.length) return;
    var whoHtml=isAdmin()
      ? '<select class="hz-as'+(who?'':' empty')+'" data-v="assign" data-k="'+esc(g.key)+'"><option value="">담당 선택</option>'+staff.map(function(x){ return '<option value="'+esc(x.n)+'"'+(x.n===who?' selected':'')+'>담당 '+esc(short1(x.n))+'</option>'; }).join('')+(who&&!staff.some(function(x){ return x.n===who; })?'<option selected value="'+esc(who)+'">담당 '+esc(short1(who))+'</option>':'')+'</select>'
      : (who?'<span class="hz-who">담당 '+esc(short1(who))+'</span>':'');
    var op=!!q||!!opened[g.key]||(!!filt.region&&filt.region!=='@mine')||shown.length===1;
    var sub=g.split?'<small class="hz-tw">'+esc(g.towns.join('·'))+'</small>':'';
    h+='<div class="hz-col'+(op?' open':'')+'"><div class="hz-rh" data-act="toggle" data-k="'+esc(g.key)+'"><span class="hz-nmw"><b>'+esc(g.city)+'</b>'+sub+'</span>'+whoHtml+
      '<span class="hz-mini"><i style="width:'+(100*d/g.items.length)+'%"></i></span><em>'+d+'<span>/'+g.items.length+'</span></em><i class="ti ti-chevron-'+(op?'up':'down')+' hz-chev"></i></div>'+
      (op?'<div class="hz-lst">'+list.map(function(x){ return itemHtml(x); }).join('')+'</div>':'')+'</div>';
  });
  h+='</div>';
  document.getElementById('hz-list').innerHTML=h;
  var foc=!q&&mapFocus&&shown.filter(function(g){ return g.key===mapFocus; })[0], fItems=null, fLabel='';
  if(foc){ fItems=foc.items; fLabel=foc.city+(foc.split?' ('+foc.towns.join('·')+')':''); }
  if(!q&&mapZoom){ fItems=mapZoom.map(siteById).filter(Boolean); fLabel='가까운 '+fItems.length+'곳'; }
  var ring=null;
  if(nearInfo&&nearInfo.ctr.co){ mapSites=[nearInfo.ctr].concat(nearInfo.list.map(function(x){ return x.s; })); fItems=mapSites; fLabel=nearInfo.ctr.name+' 근처 '+near.r+'km'; ring={ s:nearInfo.ctr, km:near.r }; }
  renderDlg(); renderModal(); drawMap(mapSites, fItems, fLabel, ring);
}

// ── 지도 (PC 화면에서만) — 실제 지도 대신 단순한 점 지도. 가까운 업장끼리는 숫자 동그라미로 묶임 ──────────────────────────
var mapFocus=null, mapZoom=null, lastMap=null;   // mapZoom: 지도에서 큰 동그라미를 눌러 확대한 업장들   // mapFocus: 방금 펼친 카드 → 그 지역으로 확대
var HQ={ lat:37.017, lng:126.930 };   // 본사 (청북읍)
var ST_COLOR={ done:'#3B6D11', plan:'#378ADD', none:'#C8C4BC' };
function drawMap(list, focus, label, ring){
  lastMap={ list:list, focus:focus, label:label, ring:ring };
  var el=document.getElementById('hz-map'); if(!el||el.offsetParent===null) return;
  var W=el.clientWidth, H=el.clientHeight; if(!W||!H) return;
  var pts=list.filter(function(s){ return s.co; });
  if(!pts.length){ el.innerHTML='<div class="hz-mapempty">지도에 표시할 업장이 없어요</div>'; return; }
  var fit=focus?focus.filter(function(s){ return s.co; }):pts; if(!fit.length) fit=pts;
  var la=fit.map(function(s){ return s.co.lat; }), ln=fit.map(function(s){ return s.co.lng; });
  if(ring){ var dla=ring.km/111, dln=ring.km/(111*Math.cos(ring.s.co.lat*Math.PI/180)); la.push(ring.s.co.lat-dla, ring.s.co.lat+dla); ln.push(ring.s.co.lng-dln, ring.s.co.lng+dln); }
  la.sort(function(a,b){ return a-b; }); ln.sort(function(a,b){ return a-b; });
  // 전체 보기에선 멀리 떨어진 몇 곳 때문에 나머지가 뭉치지 않게 양끝 5%는 범위에서 빼고, 그 점들은 가장자리에 붙여 그림
  var cut=(!focus&&fit.length>=12)?Math.floor(fit.length*0.05):0;
  var minLa=la[cut], maxLa=la[la.length-1-cut], minLn=ln[cut], maxLn=ln[ln.length-1-cut];
  var cLa=(minLa+maxLa)/2, cLn=(minLn+maxLn)/2, kx=Math.cos(cLa*Math.PI/180);
  var sx=Math.max((maxLn-minLn)*kx,0.03), sy=Math.max(maxLa-minLa,0.03), pad=40;
  var sc=Math.min((W-2*pad)/sx,(H-2*pad)/sy);
  function P(co){ return [W/2+(co.lng-cLn)*kx*sc, H/2-(co.lat-cLa)*sc]; }
  function PC(co){ var p=P(co); return [Math.max(14,Math.min(W-14,p[0])), Math.max(14,Math.min(H-14,p[1]))]; }
  // 화면에서 22px 안에 있는 업장끼리 묶기
  var cl=[];
  pts.forEach(function(s){ if(ring&&s===ring.s) return; var p=focus?P(s.co):PC(s.co), hit=null;
    for(var i=0;i<cl.length;i++){ var c=cl[i]; if(Math.hypot(c.x-p[0],c.y-p[1])<22){ hit=c; break; } }
    if(hit){ hit.items.push(s); hit.sx+=p[0]; hit.sy+=p[1]; hit.x=hit.sx/hit.items.length; hit.y=hit.sy/hit.items.length; }
    else cl.push({ items:[s], sx:p[0], sy:p[1], x:p[0], y:p[1] });
  });
  // 동그라미끼리 겹치면 다시 합침 (겹친 숫자가 안 보이게)
  function rad(c){ var n=c.items.length; return n===1?8:Math.min(11+n,18); }
  for(var merged=true; merged;){ merged=false;
    for(var i=0;i<cl.length&&!merged;i++) for(var j=i+1;j<cl.length;j++){ var A=cl[i], B=cl[j];
      if(Math.hypot(A.x-B.x,A.y-B.y)<rad(A)+rad(B)+3){ A.items=A.items.concat(B.items); A.sx+=B.sx; A.sy+=B.sy; A.x=A.sx/A.items.length; A.y=A.sy/A.items.length; cl.splice(j,1); merged=true; break; } } }
  var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="display:block">';
  // 시 이름 (흐리게)
  cities().forEach(function(c){ if(c.rest) return; var cs=c.items.filter(function(s){ return s.co; }); if(!cs.length) return;
    var a=0,b=0; cs.forEach(function(s){ a+=s.co.lat; b+=s.co.lng; }); var p=P({ lat:a/cs.length, lng:b/cs.length });
    if(p[0]<-40||p[0]>W+40||p[1]<-20||p[1]>H+20) return;
    svg+='<text x="'+p[0]+'" y="'+(p[1]+4)+'" text-anchor="middle" font-size="'+(focus?22:16)+'" font-weight="700" fill="#E4E1D8">'+esc(c.name.replace(/(특별|광역)?시$|군$/,''))+'</text>'; });
  if(ring){ var rc=P(ring.s.co), rr=ring.km/111*sc;
    svg+='<circle cx="'+rc[0]+'" cy="'+rc[1]+'" r="'+rr+'" fill="rgba(55,138,221,.06)" stroke="#378ADD" stroke-width="1.2" stroke-dasharray="5 4"/>'+
      '<text x="'+rc[0]+'" y="'+(rc[1]-rr-6)+'" text-anchor="middle" font-size="11" fill="#378ADD">'+ring.km+'km</text>'; }
  var hq=P(HQ); svg+='<g><circle cx="'+hq[0]+'" cy="'+hq[1]+'" r="9" fill="#A32D2D"/><text x="'+hq[0]+'" y="'+(hq[1]+4)+'" text-anchor="middle" font-size="11" fill="#fff">★</text><text x="'+hq[0]+'" y="'+(hq[1]+22)+'" text-anchor="middle" font-size="11" fill="#A32D2D" font-weight="600">본사</text></g>';
  cl.sort(function(a,b){ return a.items.length-b.items.length; }).forEach(function(c){
    var n=c.items.length, ids=c.items.map(function(s){ return s.id; }).join(',');
    svg+='<g class="hz-dot" data-act="mapdot" data-ids="'+ids+'">';
    if(n===1){ svg+='<circle cx="'+c.x+'" cy="'+c.y+'" r="7" fill="'+ST_COLOR[stOf(c.items[0].id)]+'" stroke="#fff" stroke-width="2"/>';
      if(focus) svg+='<text x="'+(c.x+11)+'" y="'+(c.y+4)+'" font-size="12" fill="#555" stroke="#FAFAF7" stroke-width="3" paint-order="stroke">'+esc(c.items[0].name)+'</text>'; }   // 확대했을 땐 이름도
    else{
      var r=Math.min(11+n,18), L=2*Math.PI*r, d=0, p=0;
      c.items.forEach(function(s){ var t=stOf(s.id); if(t==='done') d++; else if(t==='plan') p++; });
      svg+='<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r+'" fill="#fff" stroke="'+ST_COLOR.none+'" stroke-width="5"/>';
      var off=0; [['done',d],['plan',p]].forEach(function(z){ if(!z[1]) return; var len=L*z[1]/n;
        svg+='<circle cx="'+c.x+'" cy="'+c.y+'" r="'+r+'" fill="none" stroke="'+ST_COLOR[z[0]]+'" stroke-width="5" stroke-dasharray="'+len+' '+(L-len)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+c.x+' '+c.y+')"/>'; off+=len; });
      svg+='<text x="'+c.x+'" y="'+(c.y+4.5)+'" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1a18">'+n+'</text>';
    }
    svg+='</g>';
  });
  if(ring){ var cp=P(ring.s.co), ct=stOf(ring.s.id);
    svg+='<g class="hz-dot" data-act="mapdot" data-ids="'+ring.s.id+'"><circle cx="'+cp[0]+'" cy="'+cp[1]+'" r="13" fill="none" stroke="#1a1a18" stroke-width="2"/><circle cx="'+cp[0]+'" cy="'+cp[1]+'" r="8" fill="'+ST_COLOR[ct]+'" stroke="#fff" stroke-width="2"/>'+
      '<text x="'+cp[0]+'" y="'+(cp[1]+28)+'" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1a18" stroke="#FAFAF7" stroke-width="4" paint-order="stroke">'+esc(ring.s.name)+'</text></g>'; }
  svg+='</svg>';
  var top=focus?'<div class="hz-mapbar"><span>'+esc(label||'')+' 확대</span><button class="btn sm" data-act="mapall">전체 보기</button></div>':'<div class="hz-mapbar hint2">숫자 동그라미를 누르면 확대돼요</div>';
  el.innerHTML=svg+top+'<div class="hz-tip" id="hz-tip"></div>';
}
// 지도 점에 마우스를 올리면 업장 이름·상태 말풍선 (PC)
function tipLine(s){ var c=checks[s.id], t=stOf(s.id);
  return '<div class="hz-tl"><i style="background:'+ST_COLOR[t]+'"></i><b>'+esc(s.name)+'</b><span>'+(t==='done'?md(c.doneDate)+' '+esc(short1(c.doneBy)):t==='plan'?md(c.planDate)+' 예정':'안 함')+'</span></div>'; }
document.addEventListener('mousemove', function(ev){
  var tip=document.getElementById('hz-tip'); if(!tip) return;
  var g=ev.target.closest&&ev.target.closest('#hz-map .hz-dot');
  if(!g){ tip.style.display='none'; return; }
  var ids=g.getAttribute('data-ids').split(','), list=sortItems(ids.map(siteById).filter(Boolean));
  var more=list.length>10?'<div class="hz-tl" style="color:#999">외 '+(list.length-10)+'곳 · 누르면 확대</div>':'';
  tip.innerHTML=list.slice(0,10).map(tipLine).join('')+more;
  var box=document.getElementById('hz-map').getBoundingClientRect(), x=ev.clientX-box.left+14, y=ev.clientY-box.top+14;
  tip.style.display='block';
  if(x+tip.offsetWidth>box.width-6) x=ev.clientX-box.left-tip.offsetWidth-14;
  if(y+tip.offsetHeight>box.height-6) y=ev.clientY-box.top-tip.offsetHeight-14;
  tip.style.left=Math.max(4,x)+'px'; tip.style.top=Math.max(4,y)+'px';
});
var rsT=null;
window.addEventListener('resize', function(){ clearTimeout(rsT); rsT=setTimeout(function(){ if(lastMap) drawMap(lastMap.list, lastMap.focus, lastMap.label, lastMap.ring); },200); });

// ── 관리자: 담당 정하기 (시마다 기본 담당 + 필요한 읍·면만 다르게) ──────────────────────────
function staffOpts(cur, firstLabel){
  var o='<option value="">'+firstLabel+'</option>'+staff.map(function(x){ return '<option value="'+esc(x.n)+'"'+(x.n===cur?' selected':'')+'>'+esc(x.n)+'</option>'; }).join('');
  if(cur&&!staff.some(function(x){ return x.n===cur; })) o+='<option selected value="'+esc(cur)+'">'+esc(cur)+'</option>';
  return o;
}
function renderModal(){
  var el=document.getElementById('form');
  if(!modal){ el.className='sup-modal'; el.innerHTML=''; return; }
  var cs=cities();
  el.className='sup-modal open';
  el.innerHTML='<div class="sup-modal-inner" style="height:auto;max-height:92vh;max-width:460px"><div class="sup-modal-header"><h3>담당 정하기</h3><button class="btn sm" data-act="mclose"><i class="ti ti-x"></i></button></div>'+
    '<div class="sup-modal-body"><div class="hint l" style="margin-bottom:10px">시마다 담당을 고르세요. 일부 읍·면만 다른 사람이 맡으면 "읍·면별로 다르게"를 펼쳐 그 곳만 바꾸면 돼요. 담당이 같은 곳은 붙어 있든 떨어져 있든 한 카드로 묶여요.</div>'+
    cs.map(function(c){
      var tws=c.rest?[]:townsOf(c), base=assign[c.name]||'';
      var hasOv=tws.some(function(t){ return assign[c.name+'|'+t.k]; });
      return '<div class="hz-mrow"><div class="hz-mc"><span><b>'+esc(c.name)+'</b> <small>'+c.items.length+'곳</small></span><select class="m-as hz-msel" data-k="'+esc(c.name)+'">'+staffOpts(base,'— 미지정 —')+'</select></div>'+
        (tws.length>1?'<details class="hz-det"'+(hasOv?' open':'')+'><summary>읍·면별로 다르게</summary>'+tws.map(function(t){ var cur=assign[c.name+'|'+t.k]||'';
          return '<div class="hz-mc sub"><span>'+esc(t.k)+' <small>'+t.n+'곳</small></span><select class="m-as hz-msel" data-k="'+esc(c.name+'|'+t.k)+'">'+staffOpts(cur,'시 담당과 같음')+'</select></div>'; }).join('')+'</details>':'')+'</div>';
    }).join('')+
    '</div><div class="sup-modal-footer"><button class="btn" data-act="mclose">취소</button><button class="btn primary" data-act="msave">저장</button></div></div>';
}
function cleanMap(map){   // 시 담당과 같은 읍·면 지정은 지움
  Object.keys(map).forEach(function(k){ var p=k.split('|'); if(!map[k]||(p.length===2&&map[k]===map[p[0]])) delete map[k]; });
  return map;
}
async function writeAssign(map, msg){
  try{ await setDoc(doc(db,'meta','hygAssign'), { map:cleanMap(map), updatedAt:serverTimestamp(), by:me.phone }); toast(msg); return true; }
  catch(e){ console.error(e); toast(e.code==='permission-denied'?'관리자만 바꿀 수 있어요.':'저장하지 못했어요.'); render(); return false; }
}
async function saveModal(){
  var map={}; [].slice.call(document.querySelectorAll('.m-as')).forEach(function(e){ if(e.value) map[e.getAttribute('data-k')]=e.value; });
  if(await writeAssign(map,'담당을 저장했어요.')){ modal=false; renderModal(); }
}
// 카드 머리의 담당 드롭다운: 시 전체가 한 카드면 시 담당을, 나뉜 카드면 그 카드의 읍·면들만 바꿈
async function saveCardAssign(key, name){
  var g=regions().filter(function(x){ return x.key===key; })[0]; if(!g) return;
  var map=Object.assign({}, assign);
  if(!g.split||g.rest){ map[g.city]=name; Object.keys(map).forEach(function(k){ if(k.indexOf(g.city+'|')===0) delete map[k]; }); }
  else g.towns.forEach(function(t){ map[g.city+'|'+t]=name; });
  if(!name&&(!g.split||g.rest)) delete map[g.city];
  await writeAssign(map, g.city+(g.split?' ('+g.towns.join('·')+')':'')+' 담당: '+(name?short1(name):'없음'));
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
  if(dlg.group){   // 지도에서 묶음 동그라미를 누름 → 그 안의 업장 목록
    var gs=sortItems(dlg.group.map(siteById).filter(Boolean));
    el.className='cal-popup open';
    el.innerHTML='<div class="cal-popup-inner hz-dlg"><h3>가까운 업장 '+gs.length+'곳</h3><div class="hz-q2">누르면 예정·완료를 적을 수 있어요</div><div class="hz-lst hz-glst">'+gs.map(function(x){ return itemHtml(x); }).join('')+'</div><div class="hz-close" data-act="close">닫기</div></div>';
    return;
  }
  var s=siteById(dlg.siteId); if(!s){ dlg=null; el.className='cal-popup'; el.innerHTML=''; return; }
  var c=checks[s.id], t=stOf(s.id), today=ymd(new Date()), me_=myName();
  var h='<div class="cal-popup-inner hz-dlg"><h3>'+esc(s.name)+'</h3>';
  if(t==='done'){
    var canUndo=isAdmin()||c.updatedBy===me.phone;
    h+='<div class="hz-q2">이미 점검한 곳이에요</div><div class="hz-ok"><b>'+mdw(c.doneDate)+' · '+esc(c.doneBy)+'</b> 완료</div>'+
      (canUndo?'<button class="hz-bo" data-act="undone">잘못 눌렀어요 (완료 취소)</button>':'<div class="hz-prev" style="margin:0 0 4px">완료 취소는 체크한 사람이나 관리자만 할 수 있어요.</div>')+prevLine();
  } else {
    // 날짜·점검자 한 번 고르고 → [점검 예정] 또는 [점검 완료]
    h+='<div class="hz-q2">'+(t==='plan'?'날짜를 바꿔 다시 예정하거나 완료하세요':'날짜를 고르고 예정 또는 완료')+'</div>'+
      (t==='plan'?'<div class="hz-planinfo">'+mdw(c.planDate)+' 예정 · '+esc(short1(c.planBy))+'<span data-act="unplan">예정 지우기</span></div>':'')+
      '<label class="hz-l">날짜</label><input type="date" id="h-date" class="hz-fld" value="'+(t==='plan'&&c.planDate<=today?c.planDate:today)+'">'+
      '<label class="hz-l">점검자</label>'+staffSelect('h-by', t==='plan'?c.planBy:me_)+
      '<div class="hz-btns"><button class="hz-bp" data-act="plan">점검 예정</button><button class="hz-bg" data-act="done">점검 완료</button></div>'+prevLine();
  }
  if(s.co) h+='<div class="hz-lk" data-act="nearof" data-id="'+s.id+'">이 업장 근처 보기</div>';
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
  var d=document.getElementById('h-date').value, by=document.getElementById('h-by').value;
  if(!d){ toast('날짜를 골라주세요.'); return; }
  if(d>ymd(new Date())){ toast('완료는 오늘이나 지난 날짜만 돼요. 앞으로 갈 날이면 [점검 예정]을 눌러주세요.'); return; }
  var c=checks[s.id]||{};
  try{ await setDoc(checkRef(s.id), Object.assign(base(s), { status:'done', doneDate:d, doneBy:by, planDate:c.planDate||'', planBy:c.planBy||'' })); toast(s.name+' 점검 완료!'); closeDlg(); }
  catch(e){ errMsg(e); }
}
async function doPlan(){
  var s=siteById(dlg.siteId); if(!s) return;
  var d=document.getElementById('h-date').value, by=document.getElementById('h-by').value;
  if(!d){ toast('날짜를 골라주세요.'); return; }
  if(d<ymd(new Date())){ toast('예정은 오늘이나 앞으로의 날짜만 돼요. 이미 다녀왔으면 [점검 완료]를 눌러주세요.'); return; }
  var c=checks[s.id];
  if(c&&c.status==='plan'&&c.planBy!==by&&!confirm(short1(c.planBy)+'님이 '+md(c.planDate)+' 점검 예정으로 적어뒀어요. 바꿀까요?')) return;
  try{ await setDoc(checkRef(s.id), Object.assign(base(s), { status:'plan', planDate:d, planBy:by })); toast(s.name+' '+md(d)+' 점검 예정으로 적었어요.'); closeDlg(); }
  catch(e){ errMsg(e); }
}
async function undo(what){
  var s=siteById(dlg.siteId), c=s&&checks[s.id]; if(!c) return;
  if(!confirm(what==='plan'?'예정을 지울까요?':'완료를 취소할까요?')) return;
  try{ await deleteDoc(checkRef(s.id)); toast('취소했어요.'); dlg.mode='done'; renderDlg(); }
  catch(e){ errMsg(e); }
}
function openDlg(id){ var inDlg=!!dlg; dlg={ siteId:id, mode:'done' }; if(!inDlg){ try{ history.pushState({ hz:1 },''); }catch(e){} } renderDlg(); loadPrev(id); }
function openGroup(ids){ dlg={ group:ids }; try{ history.pushState({ hz:1 },''); }catch(e){} renderDlg(); }
function closeDlg(){ if(!dlg) return; dlg=null; renderDlg(); try{ if(history.state&&history.state.hz) history.back(); }catch(e){} }

// ── 이벤트 ──────────────────────────
document.addEventListener('click', async function(ev){
  if(ev.target.id==='popup'){ closeDlg(); return; }
  if(ev.target.closest('select')||ev.target.closest('label')||ev.target.closest('summary')) return;   // 담당 드롭다운 누를 땐 접고 펴지 않음
  var t=ev.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act');
  if(a==='logout'){ if(confirm('로그아웃할까요?')){ await logoutUser(); location.reload(); } }
  else if(a==='toggle'){ var k=t.getAttribute('data-k'); opened[k]=!opened[k]; mapFocus=opened[k]?k:(mapFocus===k?null:mapFocus); mapZoom=null; render(); }
  else if(a==='mapdot'){ var ids=t.getAttribute('data-ids').split(',');
    if(ids.length===1) openDlg(ids[0]);
    else if(ids.length>=5&&(!mapZoom||ids.length<mapZoom.length)){ mapZoom=ids; render(); }   // 큰 묶음 → 그쪽으로 확대
    else openGroup(ids); }                                                                     // 작은 묶음 → 목록 창
  else if(a==='mapall'){ mapFocus=null; mapZoom=null; if(filt.q){ filt.q=''; var qi=document.getElementById('hz-q'); if(qi) qi.value=''; var qx=document.querySelector('.hz-qx'); if(qx) qx.style.display='none'; } render(); }
  else if(a==='nearof'){ var ns=siteById(t.getAttribute('data-id')); closeDlg(); if(ns){ near.center=ns.id; filt.q=ns.name; var qi2=document.getElementById('hz-q'); if(qi2) qi2.value=ns.name; var qx2=document.querySelector('.hz-qx'); if(qx2) qx2.style.display=''; render(); window.scrollTo({ top:0, behavior:'smooth' }); } }
  else if(a==='qclear'){ var qi=document.getElementById('hz-q'); qi.value=''; filt.q=''; t.style.display='none'; render(); qi.focus(); }
  else if(a==='site'){ openDlg(t.getAttribute('data-id')); }
  else if(a==='close'){ closeDlg(); }
  else if(a==='mode'){ dlg.mode=t.getAttribute('data-m'); renderDlg(); }
  else if(a==='done'){ doDone(); }
  else if(a==='plan'){ doPlan(); }
  else if(a==='unplan'){ undo('plan'); }
  else if(a==='undone'){ undo('done'); }
  else if(a==='massign'){ modal=true; renderModal(); }
  else if(a==='mclose'){ modal=false; renderModal(); }
  else if(a==='msave'){ saveModal(); }
});
document.addEventListener('change', function(ev){
  var v=ev.target.getAttribute&&ev.target.getAttribute('data-v'); if(!v) return;
  if(v==='mine'){ filt.region=ev.target.checked?'@mine':''; render(); }
  else if(v==='ncenter'){ near.center=ev.target.value; render(); }
  else if(v==='nr'){ near.r=+ev.target.value; render(); }
  else if(v==='todo'){ filt.todo=ev.target.checked; render(); }
  else if(v==='assign'){ saveCardAssign(ev.target.getAttribute('data-k'), ev.target.value); }
});
document.addEventListener('input', function(ev){
  if(ev.target.id!=='hz-q') return;
  filt.q=ev.target.value; var x=document.querySelector('.hz-qx'); if(x) x.style.display=filt.q?'':'none'; render();
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
  '.hz-f2{flex:1;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}.hz-f2 .hz-adm{margin-left:auto;}.hz-adm{font-size:12px;color:#185FA5;cursor:pointer;white-space:nowrap;text-decoration:underline;}'+
  '.hz-main{display:flex;flex-direction:column;}.hz-mapcol{order:-1;margin-top:10px;}#hz-map{position:relative;height:300px;border-radius:12px;border:.5px solid #e8e8e4;background:#FAFAF7;overflow:hidden;}'+
  '.hz-near{background:#fff;border:1px solid #B5D4F4;border-radius:12px;overflow:hidden;margin-top:8px;}.hz-near-h{display:flex;align-items:center;gap:6px;padding:10px 12px;font-size:13px;background:#F5F9FD;flex-wrap:wrap;}.hz-near-h .ti{color:#185FA5;font-size:16px;}.hz-near-h em{margin-left:auto;font-style:normal;font-weight:700;color:#185FA5;}'+
  '.hz-nsel{padding:5px 6px;border:.5px solid #B5D4F4;border-radius:6px;font-size:13px;background:#fff;font-family:inherit;max-width:170px;}.hz-near .hz-lst{border-top:.5px solid #e3eef9;}.hz-near-e{padding:14px;font-size:13px;color:#888;}'+
  '.hz-km{font-size:12px;color:#185FA5;font-weight:600;white-space:nowrap;}'+
  '.hz-mapcol-x{display:none;}.hz-maplg{display:flex;gap:12px;font-size:11px;color:#666;margin-top:6px;}.hz-maplg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;}.hz-dot{cursor:pointer;}.hz-dot:hover circle{filter:brightness(1.1);}.hz-mapbar{position:absolute;left:10px;top:10px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.92);border-radius:8px;padding:4px 4px 4px 10px;font-size:12px;color:#555;}.hz-mapbar.hint2{top:auto;bottom:8px;color:#999;padding:5px 10px;background:rgba(255,255,255,.8);}.hz-tip{position:absolute;display:none;pointer-events:none;background:#fff;border:.5px solid #ddd;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.12);padding:6px 10px;font-size:12px;z-index:5;max-width:260px;}.hz-tl{display:flex;align-items:center;gap:6px;padding:2px 0;white-space:nowrap;}.hz-tl i{width:8px;height:8px;border-radius:50%;flex-shrink:0;}.hz-tl b{font-weight:600;overflow:hidden;text-overflow:ellipsis;}.hz-tl span{margin-left:auto;padding-left:10px;color:#888;}.hz-mapempty{padding:40px;text-align:center;color:#aaa;font-size:13px;}.hz-glst{border:.5px solid #eee;border-radius:10px;max-height:50vh;overflow:auto;}.hz-search{position:relative;margin:10px 0 2px;}.hz-search .ti-search{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#999;font-size:16px;}.hz-search input{width:100%;box-sizing:border-box;padding:11px 36px 11px 36px;border:.5px solid #ccc;border-radius:10px;font-size:15px;background:#fff;font-family:inherit;color:#1a1a18;-webkit-appearance:none;}.hz-search input::-webkit-search-cancel-button{display:none;}.hz-qx{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#999;cursor:pointer;padding:4px 6px;font-size:14px;}'+
  '.hz-cb{display:inline-flex;align-items:center;gap:6px;font-size:14px;white-space:nowrap;cursor:pointer;}.hz-cb input{width:20px;height:20px;margin:0;accent-color:#3B6D11;}'+
  '.hz-col{background:#fff;border:.5px solid #e8e8e4;border-radius:12px;overflow:hidden;margin-top:8px;}.hz-col.open{border-color:#B5D4F4;}'+
  '.hz-rh{display:flex;align-items:center;gap:8px;padding:13px 14px;font-size:13px;cursor:pointer;}.hz-rh b{font-size:15px;white-space:nowrap;}'+
  '.hz-mini{flex:1;max-width:90px;height:6px;border-radius:99px;background:#eceae4;overflow:hidden;margin-left:auto;}.hz-mini i{display:block;height:100%;background:#3B6D11;}'+
  '.hz-chev{color:#aaa;font-size:15px;}'+
  '.hz-rh em{font-style:normal;min-width:34px;text-align:right;font-size:13px;font-weight:700;}.hz-rh em span{color:#999;font-weight:400;}'+
  '.hz-who{font-size:12px;color:#888;white-space:nowrap;}'+
  '.hz-nmw{display:flex;flex-direction:column;min-width:0;}.hz-tw{font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;}'+
  '.hz-mrow{border-top:.5px solid #f0f0ec;padding:8px 0;}.hz-mc{display:grid;grid-template-columns:1fr 170px;gap:8px;align-items:center;font-size:14px;}.hz-mc small{color:#999;font-weight:400;font-size:12px;}.hz-mc.sub{font-size:13px;padding:4px 0 4px 14px;}'+
  '.hz-msel{padding:7px 8px;border:.5px solid #ccc;border-radius:8px;font-size:13px;background:#fff;font-family:inherit;}'+
  '.hz-det summary{font-size:12px;color:#185FA5;cursor:pointer;margin-top:6px;}'+
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
  '.hz-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;}.hz-btns button{margin-top:0;}'+
  '.hz-bg{background:#3B6D11;color:#fff;}.hz-bp{background:#185FA5;color:#fff;}.hz-bo{background:#fff;border:.5px solid #ccc;color:#444;font-size:14px;font-weight:500;}'+
  '.hz-lk{text-align:center;font-size:13px;color:#185FA5;margin-top:14px;cursor:pointer;}'+
  '.hz-close{text-align:center;font-size:13px;color:#999;margin-top:12px;cursor:pointer;padding:4px;}'+
  '.hz-ok{background:#EAF3DE;color:#27500A;border-radius:12px;padding:14px;font-size:14px;margin-bottom:10px;}'+
  '.hz-prev{font-size:12px;color:#888;margin:10px 0 0;text-align:center;}'+
  '.hz-planinfo{display:flex;align-items:center;gap:8px;background:#E6F1FB;color:#0C447C;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px;}.hz-planinfo span{margin-left:auto;color:#A32D2D;font-size:12px;cursor:pointer;text-decoration:underline;}'+
  '@media(min-width:900px){.hz-top{display:flex;gap:16px;align-items:stretch;max-width:none;}.hz-big{flex:1;}.hz-f{flex-direction:column;align-items:stretch;justify-content:center;margin:0;width:240px;gap:10px;}.hz-f2{flex-direction:column;align-items:flex-start;gap:12px;}.hz-f2 .hz-adm{margin-left:0;}'+
  '.hz-main{display:grid;grid-template-columns:minmax(0,1fr) 44%;gap:16px;align-items:start;}.hz-mapcol{order:0;display:block;position:sticky;top:12px;margin-top:8px;}#hz-map{height:calc(100vh - 140px);min-height:420px;}'+
  '.hz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0 12px;align-items:start;}.hz-it{font-size:14px;padding:9px 12px;gap:10px;}}';
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
    if(!canHyg(info)){ showLogin('phone','위생점검 권한이 없어요. 관리자에게 문의하세요.'); return; }
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
  if(!canHyg(info)){
    showLogin('phone','이 계정은 위생점검 권한이 없어요.<br><button class="lg-btn ghost" onclick="lgLogout()">다른 번호로 로그인</button>');
    return;
  }
  document.getElementById('login').style.display='none';
  me={ phone:phone, name:info.name||'', role:info.role||'staff', apps:info.apps };
  listen(); render();
});
