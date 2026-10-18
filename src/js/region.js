// region.js — 소재지별 탭: 본사 기준 지도(사업장 점) + 지역·팀 드롭다운 + 가까운 순 목록
import { COORDS } from './coords.js';

var TEAM_COLOR={1:'#185FA5',2:'#3B6D11',3:'#854F0B'};
var CENTERS={'평택시':[36.992,127.113],'화성시':[37.199,126.831],'아산시':[36.790,127.002],'천안시':[36.815,127.114],'용인시':[37.241,127.178],'안성시':[37.008,127.280],'오산시':[37.150,127.077],'수원시':[37.263,127.029],'안산시':[37.322,126.831],'시흥시':[37.380,126.803],'이천시':[37.272,127.435],'성남시':[37.420,127.127]};
var TOWN2CITY={'포승읍':'평택시','청북읍':'평택시','진위면':'평택시','서탄면':'평택시','오성면':'평택시','고덕면':'평택시','팽성읍':'평택시','세교동':'평택시','모곡동':'평택시','둔포면':'아산시','음봉면':'아산시','정남면':'화성시','우정읍':'화성시','양감면':'화성시'};
var HOME_KM=30;   // 첫 화면: 본사 중심 반경 (km)

// 본사 — 주소는 여기 한 줄만 바꾸면 됨. 좌표는 앱 실행 시 카카오 지오코딩으로 갱신해 기억
var HQ={id:'__hq',name:'본사',addr:'경기 평택시 청북읍 청북로 172',lat:37.017,lng:126.930};
(function(){ try{ var c=JSON.parse(localStorage.getItem('hqCoord')||'null'); if(c&&c.addr===HQ.addr){ HQ.lat=c.lat; HQ.lng=c.lng; } }catch(e){} })();
function geocodeHQ(){
  try{
    var saved=JSON.parse(localStorage.getItem('hqCoord')||'null'); if(saved&&saved.addr===HQ.addr) return;
    if(!window.kakaoReady||!window.kakao||!kakao.maps||!kakao.maps.services) return;
    new kakao.maps.services.Geocoder().addressSearch(HQ.addr,function(res,st){
      if(st===kakao.maps.services.Status.OK&&res[0]){ HQ.lat=parseFloat(res[0].y); HQ.lng=parseFloat(res[0].x);
        try{ localStorage.setItem('hqCoord',JSON.stringify({addr:HQ.addr,lat:HQ.lat,lng:HQ.lng})); }catch(e){}
        if(map) drawAll(true); }
    });
  }catch(e){}
}

var map=null, layers={dots:null,deco:null};
// 화면 상태 (탭을 다시 열어도 유지)
var st={ city:'', team:'', sel:null, near:false, nearKm:5, view:'home' };   // view: home(본사 30km) | all(전체)
var cache={contracts:[], regions:[]};

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function coordOf(c){ if(c.lat&&c.lng) return {lat:c.lat,lng:c.lng}; return COORDS[c.name]||null; }
function kmBetween(a,b){
  var R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLng=(b.lng-a.lng)*p;
  var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
function shortName(n){ var t=String(n||'').replace(/\([^)]*\)/g,'').replace(/\s+/g,''); return t.length>6?t.slice(0,5):t; }
function shortCity(n){ return n.replace(/광역시$|특별시$/,'').replace(/시$|군$/,''); }
export function regionOf(c){
  var a=(c.addr||'').trim(), city=null, town=null;
  var m=a.match(/([가-힣]+?(?:특별|광역)?시|[가-힣]+?군)(?=\s|$)/);
  if(m&&!/(도|로|길)$/.test(m[1])) city=m[1];
  var tm=a.match(/([가-힣]+?[읍면동])(?=\s|$|\d)/);
  if(tm) town=tm[1];
  if(!city&&town&&TOWN2CITY[town]) city=TOWN2CITY[town];
  if(!city){
    var co=coordOf(c);
    if(co){
      var best=null,bd=1e9;
      Object.keys(CENTERS).forEach(function(k){ var d=kmBetween(co,{lat:CENTERS[k][0],lng:CENTERS[k][1]}); if(d<bd){bd=d;best=k;} });
      if(best&&bd<20) city=best;
    }
  }
  return {city:city||'기타 지역',town:town||'기타'};
}
function hqKm(c){ var co=coordOf(c); return co?kmBetween({lat:HQ.lat,lng:HQ.lng},co):null; }
function dotColor(c){ return c.terminated?'#aaa':(TEAM_COLOR[c.team]||'#4A90D9'); }
function byId(id){ return cache.contracts.filter(function(x){ return x.id===id; })[0]; }
// 지역·팀 드롭다운으로 거른 사업장
function shown(){
  return cache.contracts.filter(function(c){
    if(st.city&&c._region.city!==st.city) return false;
    if(st.team&&String(c.team)!==st.team) return false;
    return true;
  });
}
function nearList(center){
  var co=center.id==='__hq'?{lat:HQ.lat,lng:HQ.lng}:coordOf(center); if(!co) return [];
  return cache.contracts.filter(function(x){ return x.id!==center.id&&coordOf(x); })
    .map(function(x){ return {c:x,d:kmBetween(co,coordOf(x))}; }).filter(function(x){ return x.d<=st.nearKm; })
    .sort(function(a,b){ return a.d-b.d; });
}

// ── 렌더 ──
export function renderRegionTab(el,contracts){
  cache.contracts=contracts;
  var by={};
  contracts.forEach(function(c){ c._region=regionOf(c); by[c._region.city]=(by[c._region.city]||0)+1; });
  cache.regions=Object.keys(by).map(function(k){ return {name:k,n:by[k]}; })
    .sort(function(a,b){ return (a.name==='기타 지역')-(b.name==='기타 지역')||b.n-a.n||a.name.localeCompare(b.name,'ko'); });
  if(st.city&&!by[st.city]) st.city='';
  if(st.sel&&st.sel!=='__hq'&&!byId(st.sel)){ st.sel=null; st.near=false; }
  el.innerHTML='<div class="rg2"><div class="rg2-filters" id="rg-filters"></div>'+
    '<div class="rg2-mapcol"><div class="rg2-map"><div id="rg-map"></div>'+
      '<div class="rg2-ov tl" id="rg-ov-tl"></div><div class="rg2-ov br" id="rg-ov-br"></div>'+
      '<div class="rg2-ov bl" id="rg-ov-bl"></div><div class="rg2-sheet" id="rg-sheet"></div></div></div>'+
    '<div class="rg2-list" id="rg-list"></div></div>';
  setTimeout(function(){ initMap(); drawAll(true); },50);
}
export function destroyRegionMap(){ if(map){ map.remove(); map=null; } }

function initMap(){
  if(map){ map.remove(); map=null; }
  if(!document.getElementById('rg-map')) return;
  map=L.map('rg-map',{zoomControl:false,attributionControl:true});
  map.attributionControl.setPrefix(false);
  L.control.zoom({position:'topright'}).addTo(map);
  // 밝은 기본 지도 (CARTO Voyager, OpenStreetMap 기반)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    maxZoom:19, subdomains:'abcd', attribution:'© OpenStreetMap © CARTO'
  }).addTo(map);
  layers.deco=L.layerGroup().addTo(map); layers.dots=L.layerGroup().addTo(map);
  map.on('moveend',function(){ layoutLabels(); drawOverlay(); });
  geocodeHQ();
}

function drawAll(refit){ drawFilters(); drawMap(refit); drawSheet(); drawList(); drawOverlay(); }

function fitView(){
  if(!map) return;
  var items=shown();
  if(st.sel){
    var c=st.sel==='__hq'?HQ:byId(st.sel), co=c&&(st.sel==='__hq'?{lat:HQ.lat,lng:HQ.lng}:coordOf(c));
    if(co){ if(st.near) map.fitBounds(L.latLng(co.lat,co.lng).toBounds(st.nearKm*2200)); else map.setView([co.lat,co.lng], Math.max(map.getZoom()||0,13)); }
    return;
  }
  if(st.city||st.view==='all'){
    var pts=items.map(coordOf).filter(Boolean).map(function(p){ return [p.lat,p.lng]; });
    if(st.view==='all'&&!st.city) pts.push([HQ.lat,HQ.lng]);
    if(pts.length){ map.fitBounds(pts,{padding:[30,30],maxZoom:13}); return; }
  }
  map.fitBounds(L.latLng(HQ.lat,HQ.lng).toBounds(HOME_KM*2000),{padding:[10,10]});
}

function drawMap(refit){
  if(!map) return;
  layers.dots.clearLayers(); layers.deco.clearLayers();
  var items=shown(), sel=st.sel&&st.sel!=='__hq'?byId(st.sel):null;
  var center=st.sel==='__hq'?{lat:HQ.lat,lng:HQ.lng}:(sel?coordOf(sel):null);
  // 본사 거리 원 (전체 화면일 때만)
  if(!st.sel&&!st.city){
    [10,20,30].forEach(function(k){
      L.circle([HQ.lat,HQ.lng],{radius:k*1000,color:'#A32D2D',weight:1,opacity:.35,dashArray:'3 5',fill:false,interactive:false}).addTo(layers.deco);
      var p=L.latLng(HQ.lat,HQ.lng).toBounds(k*2000*0.7071).getNorthEast();
      L.marker(p,{interactive:false,icon:L.divIcon({className:'rg2-ring',html:k+'km',iconSize:[34,14],iconAnchor:[0,14]})}).addTo(layers.deco);
    });
  }
  if(center&&st.near) L.circle([center.lat,center.lng],{radius:st.nearKm*1000,color:'#185FA5',weight:1,dashArray:'4 4',fillColor:'#185FA5',fillOpacity:0.06,interactive:false}).addTo(layers.deco);
  items.forEach(function(x){ var co=coordOf(x); if(!co) return;
    var isSel=sel&&x.id===sel.id, far=center&&st.near&&!isSel&&kmBetween(center,co)>st.nearKm;
    var m=L.circleMarker([co.lat,co.lng],{radius:isSel?10:6,fillColor:isSel?'#A32D2D':dotColor(x),color:'#fff',weight:isSel?3:1.5,fillOpacity:far?0.3:1});
    m._biz=x; m._pri=isSel?0:(far?2:1);
    var lbl=isSel?x.name:shortName(x.name); m._lw=lbl.length*11+8;
    m.bindTooltip(esc(lbl),{direction:'right',offset:[6,0],permanent:true,interactive:true,className:isSel?'rg-tip-sel':'rg-tip'});
    m.on('click',function(){ select(x.id); });
    m.addTo(layers.dots);
  });
  var on=st.sel==='__hq';
  L.marker([HQ.lat,HQ.lng],{zIndexOffset:1000,icon:L.divIcon({className:'rg-hq-wrap',html:'<div class="rg-hq'+(on?' on':'')+'">★</div><div class="rg-hq-lbl">본사</div>',iconSize:[26,40],iconAnchor:[13,13]})})
    .on('click',function(){ select(on?null:'__hq'); }).addTo(layers.deco);
  if(refit) fitView();
  setTimeout(layoutLabels,0);
}
// 이름표 겹침 방지: 겹치지 않는 것만 표시 (선택 > 나머지 순)
function layoutLabels(){
  if(!map||!layers.dots) return;
  var ms=[]; layers.dots.eachLayer(function(m){ if(m._biz&&m.getTooltip()) ms.push(m); });
  var size=map.getSize(), pts=ms.map(function(m){ var p=map.latLngToContainerPoint(m.getLatLng()); return {m:m,x:p.x,y:p.y}; });
  var boxes=pts.map(function(q){ return {x0:q.x-8,y0:q.y-8,x1:q.x+8,y1:q.y+8,self:q}; });
  var hq=map.latLngToContainerPoint([HQ.lat,HQ.lng]); boxes.push({x0:hq.x-16,y0:hq.y-14,x1:hq.x+16,y1:hq.y+30}); // 본사 표시 자리
  pts.sort(function(a,b){ return a.m._pri-b.m._pri||a.y-b.y; });
  pts.forEach(function(q){
    var el=q.m.getTooltip().getElement(); if(!el) return;
    var b={x0:q.x+6,y0:q.y-9,x1:q.x+6+q.m._lw,y1:q.y+9};
    var onScreen=b.x0>=0&&b.y0>=0&&b.x1<=size.x&&b.y1<=size.y;
    var hit=!onScreen||q.m._pri===2||boxes.some(function(o){ if(o.self===q) return false; return !(b.x1<o.x0||b.x0>o.x1||b.y1<o.y0||b.y0>o.y1); });
    if(hit&&q.m._pri!==0){ el.style.display='none'; }
    else { el.style.display=''; boxes.push(b); }
  });
}
// 지도 위 안내 (왼쪽 위 / 오른쪽 아래 / 왼쪽 아래)
function drawOverlay(){
  var tl=document.getElementById('rg-ov-tl'), br=document.getElementById('rg-ov-br'), bl=document.getElementById('rg-ov-bl');
  if(!tl||!map) return;
  var items=shown().filter(function(c){ return coordOf(c); }), b=map.getBounds();
  var out=items.filter(function(c){ var co=coordOf(c); return !b.contains([co.lat,co.lng]); }).length;
  if(st.sel) tl.innerHTML='<button class="rg2-pill" onclick="window._rgHome()">← 전체 지도</button>';
  else if(st.city) tl.innerHTML='<span class="rg2-pill">'+esc(shortCity(st.city))+' · '+items.length+'곳</span>';
  else tl.innerHTML='<span class="rg2-pill">'+(st.view==='all'?'전체':'본사 기준 '+HOME_KM+'km')+' · '+(items.length-out)+'곳</span>';
  br.innerHTML=st.sel?'':(out>0?'<button class="rg2-pill blue" onclick="window._rgAll()">지도 밖 '+out+'곳 보기 ›</button>'
    :(st.view==='all'&&!st.city?'<button class="rg2-pill blue" onclick="window._rgHome()">본사 중심으로</button>':''));
  bl.innerHTML=st.sel?'':'<div class="rg2-legend"><span><i style="background:#185FA5"></i>1팀</span><span><i style="background:#3B6D11"></i>2팀</span><span><i style="background:#854F0B"></i>3팀</span><span><i style="background:#A32D2D"></i>본사</span></div>';
}
function drawFilters(){
  var el=document.getElementById('rg-filters'); if(!el) return;
  var all=cache.contracts.length;
  el.innerHTML='<select onchange="window._rgCity(this.value)"><option value="">지역: 전체 ('+all+')</option>'+
    cache.regions.map(function(r){ return '<option value="'+esc(r.name)+'"'+(r.name===st.city?' selected':'')+'>'+esc(r.name)+' ('+r.n+')</option>'; }).join('')+'</select>'+
    '<select onchange="window._rgTeam(this.value)"><option value="">팀: 전체</option>'+[1,2,3].map(function(t){ return '<option value="'+t+'"'+(String(t)===st.team?' selected':'')+'>'+t+'팀</option>'; }).join('')+'</select>';
}
// 점을 누르면 지도 아래쪽에 뜨는 작은 카드
function drawSheet(){
  var el=document.getElementById('rg-sheet'); if(!el) return;
  if(!st.sel){ el.className='rg2-sheet'; el.innerHTML=''; return; }
  var isHQ=st.sel==='__hq', c=isHQ?HQ:byId(st.sel); if(!c){ el.innerHTML=''; return; }
  var n=nearList(c).length, kms=isHQ?[10,20,30]:[5,10], d=isHQ?null:hqKm(c);
  el.className='rg2-sheet open';
  el.innerHTML='<div class="rg2-sh-top"><span class="rg-dot lg" style="background:'+(isHQ?'#A32D2D':dotColor(c))+'"></span><b>'+(isHQ?'★ ':'')+esc(c.name)+'</b>'+
      (isHQ?'':'<span class="rg2-sh-t">'+(c.team?c.team+'팀':'')+(c.terminated?' · 해지':'')+'</span>')+
      (d!=null?'<span class="rg2-sh-km">본사에서 '+d.toFixed(0)+'km</span>':'')+'<button class="rg-x" onclick="window._rgHome()" aria-label="닫기">✕</button></div>'+
    '<div class="rg2-sh-sub">'+esc(isHQ?HQ.addr:(c.addr||''))+'</div>'+
    '<div class="rg2-sh-near">주변 <select onchange="window._rgKm(+this.value)">'+kms.map(function(k){ return '<option value="'+k+'"'+(st.nearKm===k?' selected':'')+'>'+k+'km</option>'; }).join('')+'</select> 안 사업장 '+n+'곳</div>'+
    '<div class="rg2-sh-btns"><button class="btn'+(st.near?' on':'')+'" onclick="window._rgNear()">'+(st.near?'주변 보기 끄기':'주변 '+st.nearKm+'km 보기')+'</button>'+
      (isHQ?'':'<button class="btn primary" onclick="goDetail(\''+c.id+'\')">상세 보기</button>')+'</div>';
}
function drawList(){
  var el=document.getElementById('rg-list'); if(!el) return;
  var rows, title;
  if(st.sel&&st.near){
    var c=st.sel==='__hq'?HQ:byId(st.sel);
    rows=nearList(c).map(function(x){ return {c:x.c,d:x.d}; });
    title=esc(c.name)+' 주변 '+st.nearKm+'km';
  } else {
    rows=shown().map(function(x){ return {c:x,d:hqKm(x)}; }).sort(function(a,b){ return (a.d==null?999:a.d)-(b.d==null?999:b.d); });
    title='본사에서 가까운 순';
  }
  el.innerHTML='<div class="rg2-list-h">'+title+'<span>'+rows.length+'곳</span></div>'+
    (rows.length?rows.map(function(x){ var c=x.c, on=c.id===st.sel;
      return '<div class="rg2-row'+(on?' on':'')+(c.terminated?' term':'')+'" onclick="window._rgSite(\''+c.id+'\')">'+
        '<span class="rg-dot" style="background:'+dotColor(c)+'"></span><span class="rg2-row-n">'+esc(c.name)+'</span>'+
        '<span class="rg2-row-t">'+(c.team?c.team+'팀 · ':'')+esc(c._region.town!=='기타'?c._region.town:shortCity(c._region.city))+(c.terminated?' · 해지':'')+'</span>'+
        '<span class="rg2-row-d">'+(x.d!=null?x.d.toFixed(x.d<10?1:0)+'km':'-')+'</span></div>'; }).join('')
      :'<div class="rg-near-empty">'+(st.near?st.nearKm+'km 안에 다른 사업장이 없어요':'사업장이 없어요')+'</div>');
}

// ── 상태 변경 ──
function select(id){
  st.sel=id||null; if(!id) st.near=false;
  if(id==='__hq'){ st.nearKm=[10,20,30].indexOf(st.nearKm)<0?10:st.nearKm; st.near=true; }
  else if(id&&[5,10].indexOf(st.nearKm)<0) st.nearKm=5;
  drawAll(true);
  // 휴대폰: 목록에서 눌렀으면 지도가 보이게
  if(id&&window.innerWidth<900){ var m=document.querySelector('.rg2-map'); if(m) m.scrollIntoView({behavior:'smooth',block:'center'}); }
}
window._rgCity=function(v){ st.city=v||''; st.sel=null; st.near=false; drawAll(true); };
window._rgTeam=function(v){ st.team=v||''; st.sel=null; st.near=false; drawAll(true); };
window._rgSite=function(id){ select(id===st.sel?null:id); };
window._rgHome=function(){ st.sel=null; st.near=false; st.view='home'; drawAll(true); };
window._rgAll=function(){ st.view='all'; drawAll(true); };
window._rgNear=function(){ st.near=!st.near; drawAll(true); };
window._rgKm=function(km){ st.nearKm=km; drawAll(true); };
