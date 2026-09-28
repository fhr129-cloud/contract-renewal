// region.js — 소재지별 탭: 상단 지도(지역 원 → 읍·면 → 사업장) + 하단 지역 카드
import { COORDS } from './coords.js';

var TEAM_COLOR={1:'#185FA5',2:'#3B6D11',3:'#854F0B'};
var CITY_PALETTE=['#185FA5','#6B2FA0','#0B6B5A','#854F0B','#A32D6B','#3B6D11','#6B5B0B','#A32D2D','#2F6F8F','#7A5230','#4E6B3A','#8A3A6B'];
var CENTERS={'평택시':[36.992,127.113],'화성시':[37.199,126.831],'아산시':[36.790,127.002],'천안시':[36.815,127.114],'용인시':[37.241,127.178],'안성시':[37.008,127.280],'오산시':[37.150,127.077],'수원시':[37.263,127.029],'안산시':[37.322,126.831],'시흥시':[37.380,126.803],'이천시':[37.272,127.435],'성남시':[37.420,127.127]};
var TOWN2CITY={'포승읍':'평택시','청북읍':'평택시','진위면':'평택시','서탄면':'평택시','오성면':'평택시','고덕면':'평택시','팽성읍':'평택시','세교동':'평택시','모곡동':'평택시','둔포면':'아산시','음봉면':'아산시','정남면':'화성시','우정읍':'화성시','양감면':'화성시'};

var map=null, layers={sites:null,near:null}, bubbleLayer=null;
var selectedCity=null, selectedTown=null, selectedSiteId=null, nearKm=5;
var cache={contracts:[],regions:null};

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function coordOf(c){ if(c.lat&&c.lng) return {lat:c.lat,lng:c.lng}; return COORDS[c.name]||null; }
function kmBetween(a,b){
  var R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLng=(b.lng-a.lng)*p;
  var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
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
function buildRegions(contracts){
  var byCity={};
  contracts.forEach(function(c){
    var r=regionOf(c); c._region=r;
    if(!byCity[r.city]) byCity[r.city]={name:r.city,items:[],towns:{}};
    byCity[r.city].items.push(c);
    if(!byCity[r.city].towns[r.town]) byCity[r.city].towns[r.town]=[];
    byCity[r.city].towns[r.town].push(c);
  });
  var list=Object.keys(byCity).map(function(k){ return byCity[k]; }).sort(function(a,b){ return b.items.length-a.items.length||a.name.localeCompare(b.name,'ko'); });
  list.forEach(function(r,i){ r.color=r.name==='기타 지역'?'#999':CITY_PALETTE[i%CITY_PALETTE.length]; r.major=r.items.length>=2; r._c=centroid(r.items); });
  return list;
}
function regionByName(n){ return cache.regions.filter(function(r){ return r.name===n; })[0]; }
function teamCount(items){
  var c={}; items.forEach(function(x){ var t=x.team||'?'; c[t]=(c[t]||0)+1; });
  return Object.keys(c).sort().map(function(k){ return k+'팀 '+c[k]; }).join(' · ');
}
function centroid(items){
  var pts=items.map(coordOf).filter(Boolean); if(!pts.length) return null;
  return {lat:pts.reduce(function(s,p){return s+p.lat;},0)/pts.length,lng:pts.reduce(function(s,p){return s+p.lng;},0)/pts.length};
}
function townKeys(r){ return Object.keys(r.towns).sort(function(a,b){ return r.towns[b].length-r.towns[a].length; }); }

// ── 렌더 ──
export function renderRegionTab(el,contracts){
  cache.contracts=contracts; cache.regions=buildRegions(contracts);
  if(selectedCity&&selectedCity!=='__rest'&&!regionByName(selectedCity)) { selectedCity=null; selectedTown=null; }
  el.innerHTML='<div class="rg-map-wrap"><div id="rg-map"></div><div class="rg-map-ov" id="rg-map-ov"></div></div>'+
    '<div class="rg-chips" id="rg-chips"></div><div id="rg-near"></div><div class="rg-cards" id="rg-cards"></div>';
  setTimeout(function(){ initMap(); drawAll(); },50);
}
export function destroyRegionMap(){ if(map){ map.remove(); map=null; bubbleLayer=null; } }

function initMap(){
  if(map){ map.remove(); map=null; }
  var mapEl=document.getElementById('rg-map'); if(!mapEl) return;
  map=L.map('rg-map',{zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,className:'rg-tiles'}).addTo(map);
  map.on('zoomend',function(){ if(isOverview()) placeBubbles(); });
  layers.sites=L.layerGroup().addTo(map); layers.near=L.layerGroup().addTo(map);
}
function isOverview(){ return !selectedCity||selectedCity==='__rest'; }
function drawAll(){ drawMap(); drawChips(); drawNear(); drawCards(); }

function drawMap(){
  if(!map) return;
  layers.sites.clearLayers(); layers.near.clearLayers();
  if(bubbleLayer){ map.removeLayer(bubbleLayer); bubbleLayer=null; }
  var ov=document.getElementById('rg-map-ov');
  if(isOverview()){
    var bounds=cache.regions.filter(function(r){ return r._c; }).map(function(r){ return [r._c.lat,r._c.lng]; });
    if(bounds.length) map.fitBounds(bounds,{padding:[30,30],maxZoom:10});
    placeBubbles();
    if(ov) ov.innerHTML='<span class="rg-hint">지역 원을 누르면 그 지역으로 확대</span>';
    return;
  }
  var r=regionByName(selectedCity); if(!r) return;
  var bounds=[], townBounds=[];
  // 다른 지역 사업장: 회색
  cache.contracts.forEach(function(x){ if(x._region.city===selectedCity) return; var co=coordOf(x); if(!co) return;
    L.circleMarker([co.lat,co.lng],{radius:3.5,fillColor:'#C8C4BC',color:'#fff',weight:1,fillOpacity:1}).bindTooltip(esc(x.name)+' · '+esc(x._region.city),{direction:'top'}).addTo(layers.sites); });
  var selCo=null, sel=null;
  r.items.forEach(function(x){ var co=coordOf(x); if(!co) return; bounds.push([co.lat,co.lng]);
    var isSel=x.id===selectedSiteId; if(isSel){ selCo=co; sel=x; }
    var inTown=!selectedTown||x._region.town===selectedTown; if(inTown&&selectedTown) townBounds.push([co.lat,co.lng]);
    var m=L.circleMarker([co.lat,co.lng],{radius:isSel?11:(inTown?7:5),fillColor:isSel?'#A32D2D':(x.terminated?'#aaa':(TEAM_COLOR[x.team]||'#4A90D9')),color:'#fff',weight:isSel?3:1.5,fillOpacity:inTown?1:0.3});
    m._biz=x; m._co=co;
    m.bindTooltip(esc(x.name),{direction:'top',offset:[0,-6],permanent:isSel,className:isSel?'rg-tip-sel':'rg-tip'});
    m.on('click',function(){ selectSite(x.id); });
    m.addTo(layers.sites);
  });
  // 읍·면 라벨 (클릭 → 읍·면 선택)
  townKeys(r).forEach(function(t){ if(t==='기타'||r.towns[t].length<2) return; var c=centroid(r.towns[t]); if(!c) return;
    var on=t===selectedTown;
    var mk=L.marker([c.lat,c.lng],{icon:L.divIcon({className:'rg-town-wrap',html:'<div class="rg-town'+(on?' on':'')+'" style="'+(on?'background:'+r.color+';':'')+'">'+esc(t)+' '+r.towns[t].length+'</div>',iconAnchor:[0,-14]})});
    mk.on('click',function(){ selectTown(on?null:t); });
    mk.addTo(layers.sites); });
  if(selCo){
    L.circle([selCo.lat,selCo.lng],{radius:nearKm*1000,color:'#185FA5',weight:1,dashArray:'4 4',fillColor:'#185FA5',fillOpacity:0.07}).addTo(layers.near);
    layers.sites.eachLayer(function(m){ if(m._biz&&m._biz.id!==selectedSiteId&&kmBetween(selCo,m._co)>nearKm) m.setStyle({fillOpacity:0.3}); });
    map.fitBounds(L.latLng(selCo.lat,selCo.lng).toBounds(nearKm*2200));
  } else if(selectedTown&&townBounds.length) map.fitBounds(townBounds,{padding:[40,40],maxZoom:14});
  else if(bounds.length) map.fitBounds(bounds,{padding:[28,28]});
  if(ov){
    var crumb='<button class="rg-back" onclick="window._rgBack()">← 전체</button>';
    crumb+='<span class="rg-title" style="color:'+r.color+'" onclick="window._rgTown(null)">'+esc(r.name)+' '+r.items.length+'</span>';
    if(selectedTown) crumb+='<span class="rg-title" style="color:'+r.color+'">› '+esc(selectedTown)+' '+(r.towns[selectedTown]||[]).length+'</span>';
    if(sel) crumb+='<span class="rg-title" style="color:#A32D2D">› '+esc(sel.name)+'</span>';
    ov.innerHTML=crumb;
  }
}
function placeBubbles(){
  if(!map) return;
  if(bubbleLayer){ map.removeLayer(bubbleLayer); }
  bubbleLayer=L.layerGroup().addTo(map);
  var items=cache.regions.filter(function(r){ return r._c; }).map(function(r){
    var size=22+Math.min(r.items.length,40)*0.8, p=map.latLngToContainerPoint([r._c.lat,r._c.lng]);
    return {r:r,size:size,x:p.x,y:p.y,ox:p.x,oy:p.y};
  });
  // 겹치는 원 서로 밀어내기 (픽셀 단위)
  for(var it=0;it<80;it++){
    var moved=false;
    for(var i=0;i<items.length;i++) for(var j=i+1;j<items.length;j++){
      var a=items[i],b=items[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||0.01,min=(a.size+b.size)/2+12;
      if(d<min){ var push=(min-d)/2,ux=dx/d,uy=dy/d; a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push; moved=true; }
    }
    if(!moved) break;
  }
  items.forEach(function(it){
    var r=it.r,size=it.size,ll=map.containerPointToLatLng([it.x,it.y]);
    if(Math.abs(it.x-it.ox)>2||Math.abs(it.y-it.oy)>2) L.polyline([[r._c.lat,r._c.lng],ll],{color:r.color,weight:1,opacity:.5,dashArray:'2 3'}).addTo(bubbleLayer);
    var icon=L.divIcon({className:'rg-bubble-wrap',html:'<div class="rg-bubble'+(r.items.length<2?' sm':'')+'" style="width:'+size+'px;height:'+size+'px;background:'+r.color+';">'+r.items.length+'</div><div class="rg-bubble-lbl">'+esc(shortCity(r.name))+'</div>',iconSize:[size,size+18],iconAnchor:[size/2,size/2]});
    L.marker(ll,{icon:icon}).on('click',function(){ selectCity(r.name); }).addTo(bubbleLayer);
  });
}
function drawChips(){
  var el=document.getElementById('rg-chips'); if(!el) return;
  var html='';
  cache.regions.forEach(function(r){ if(!r.major) return; var on=r.name===selectedCity;
    html+='<span class="rg-chip'+(on?' on':'')+'" style="'+(on?'background:'+r.color+';border-color:'+r.color+';':'')+'" onclick="window._rgCity(\''+esc(r.name)+'\')">'+esc(shortCity(r.name))+' '+r.items.length+'</span>'; });
  var minor=cache.regions.filter(function(r){ return !r.major; });
  var rest=minor.reduce(function(s,r){ return s+r.items.length; },0);
  var restOn=selectedCity==='__rest'||minor.some(function(r){ return r.name===selectedCity; });
  if(rest) html+='<span class="rg-chip'+(restOn?' on':'')+'" style="'+(restOn?'background:#8A867D;border-color:#8A867D;':'')+'" onclick="window._rgCity(\'__rest\')">그 외 '+rest+'</span>';
  el.innerHTML=html;
}
function drawNear(){
  var el=document.getElementById('rg-near'); if(!el) return;
  if(!selectedSiteId){ el.innerHTML=''; return; }
  var center=cache.contracts.filter(function(x){ return x.id===selectedSiteId; })[0]; var co=center?coordOf(center):null;
  if(!co){ el.innerHTML=''; return; }
  var list=cache.contracts.filter(function(x){ return x.id!==selectedSiteId&&coordOf(x); }).map(function(x){ return {c:x,d:kmBetween(co,coordOf(x))}; }).filter(function(x){ return x.d<=nearKm; }).sort(function(a,b){ return a.d-b.d; });
  el.innerHTML='<div class="rg-near"><div class="rg-near-head"><span class="rg-near-name" onclick="goDetail(\''+center.id+'\')">'+esc(center.name)+'</span><span class="rg-near-sub">주변 '+nearKm+'km · '+list.length+'곳 · 직선거리</span><span class="rg-near-tg"><span class="'+(nearKm===5?'on':'')+'" onclick="window._rgKm(5)">5km</span><span class="'+(nearKm===10?'on':'')+'" onclick="window._rgKm(10)">10km</span></span><button class="rg-x" onclick="window._rgSite(null)" aria-label="닫기">✕</button></div>'+
    (list.length?list.map(function(x){ return '<div class="rg-near-row" onclick="goDetail(\''+x.c.id+'\')"><span class="rg-dot" style="background:'+(x.c.terminated?'#aaa':(TEAM_COLOR[x.c.team]||'#4A90D9'))+'"></span><span class="rg-near-n">'+esc(x.c.name)+'</span><span class="rg-near-t">'+(x.c.team?x.c.team+'팀 · ':'')+esc(x.c._region.town!=='기타'?x.c._region.town:x.c._region.city)+'</span><span class="rg-near-d">'+x.d.toFixed(1)+' km</span></div>'; }).join(''):'<div class="rg-near-empty">'+nearKm+'km 안에 다른 사업장이 없어요</div>')+'</div>';
}
function chip(x,cityLabel){
  var on=x.id===selectedSiteId;
  return '<span class="rg-site'+(on?' on':'')+(x.terminated?' term':'')+'" onclick="window._rgSite(\''+x.id+'\')"><span class="rg-dot" style="background:'+(on?'#fff':(x.terminated?'#aaa':(TEAM_COLOR[x.team]||'#4A90D9')))+'"></span>'+esc(x.name)+(cityLabel?'<em class="rg-site-city">'+esc(cityLabel)+'</em>':'')+'</span>';
}
function openCard(r){
  var html='<div class="rg-card open" style="border-color:'+r.color+'"><div class="rg-card-head" onclick="window._rgBack()"><span class="rg-dot lg" style="background:'+r.color+'"></span><span class="rg-card-name">'+esc(r.name)+'</span><span class="rg-card-sub">'+r.items.length+'곳 · '+teamCount(r.items)+'</span><i class="ti ti-chevron-up"></i></div>';
  townKeys(r).forEach(function(t){
    var on=t===selectedTown, dim=selectedTown&&!on;
    html+='<div class="rg-town-sec'+(on?' on':'')+(dim?' dim':'')+'" id="rg-town-'+esc(t)+'"><div class="rg-town-h" onclick="window._rgTown(\''+esc(on?'':t)+'\')" style="'+(on?'color:'+r.color+';':'')+'">'+esc(t)+' <span>'+r.towns[t].length+'</span>'+(r.towns[t].length>=2?'<i class="ti ti-'+(on?'x':'zoom-in')+'"></i>':'')+'</div><div class="rg-chipwrap">'+r.towns[t].map(function(x){ return chip(x); }).join('')+'</div></div>'; });
  return html+'</div>';
}
function closedCard(r){
  return '<div class="rg-card" onclick="window._rgCity(\''+esc(r.name)+'\')"><div class="rg-card-head"><span class="rg-dot lg" style="background:'+r.color+'"></span><span class="rg-card-name">'+esc(r.name)+'</span><span class="rg-card-sub">'+r.items.length+'곳 · '+teamCount(r.items)+'</span><i class="ti ti-chevron-down"></i></div><div class="rg-card-prev">'+esc(r.items.slice(0,4).map(function(x){ return x.name; }).join(' · '))+(r.items.length>4?' …':'')+'</div></div>';
}
function drawCards(){
  var el=document.getElementById('rg-cards'); if(!el) return;
  var html='';
  var selMinor=selectedCity&&selectedCity!=='__rest'&&regionByName(selectedCity)&&!regionByName(selectedCity).major;
  cache.regions.forEach(function(r){ if(!r.major) return; html+=(r.name===selectedCity)?openCard(r):closedCard(r); });
  var minor=cache.regions.filter(function(r){ return !r.major; });
  if(minor.length){
    var open=selectedCity==='__rest'||selMinor, n=minor.reduce(function(s,r){ return s+r.items.length; },0);
    html+='<div class="rg-card'+(open?' open':'')+'" style="'+(open?'border-color:#8A867D':'')+'"><div class="rg-card-head" onclick="window._rgCity(\''+(open?'':'__rest')+'\')"><span class="rg-dot lg" style="background:#B8B4AC"></span><span class="rg-card-name">그 외 지역</span><span class="rg-card-sub">'+n+'곳 · '+minor.length+'개 지역</span><i class="ti ti-chevron-'+(open?'up':'down')+'"></i></div>'+
      (open?'<div class="rg-town-sec"><div class="rg-chipwrap">'+minor.map(function(r){ return r.items.map(function(x){ return chip(x,shortCity(r.name)).replace('class="rg-site',(r.name===selectedCity?'class="rg-site city-on ':'class="rg-site')); }).join(''); }).join('')+'</div></div>':'<div class="rg-card-prev">'+esc(minor.slice(0,5).map(function(r){ return r.items[0].name; }).join(' · '))+' …</div>')+'</div>';
  }
  el.innerHTML=html;
  if(selectedTown){ var sec=document.getElementById('rg-town-'+selectedTown); if(sec) sec.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}

// ── 상태 변경 ──
function selectCity(name){ selectedCity=name||null; selectedTown=null; selectedSiteId=null; drawAll(); }
function selectTown(t){ selectedTown=t||null; selectedSiteId=null; drawAll(); }
function selectSite(id){
  selectedSiteId=id||null;
  if(id){
    var x=cache.contracts.filter(function(c){ return c.id===id; })[0];
    if(x){ selectedCity=x._region.city; if(selectedTown&&x._region.town!==selectedTown) selectedTown=null; }
  }
  drawAll();
  var near=document.getElementById('rg-near'); if(near&&id) near.scrollIntoView({behavior:'smooth',block:'nearest'});
}
window._rgCity=function(name){ selectCity(name); };
window._rgTown=function(t){ selectTown(t); };
window._rgBack=function(){ selectCity(null); };
window._rgSite=function(id){ selectSite(id); };
window._rgKm=function(km){ nearKm=km; drawAll(); };
