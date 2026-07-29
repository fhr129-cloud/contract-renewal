// dashboard.js — 대시보드 렌더링
import { calcStatus, STATUS_META, fmtDate, dDiff, dDayLabel } from './utils.js';
import { STAFF_MAP, getStaffColor } from './staff.js';

export function initDashboard(ctx){
  // ctx: { getContracts, getHistory, getSupports, priceHistLabel, localDateStr, pushModalState }
  var priceHistLabel=ctx.priceHistLabel;
  var localDateStr=ctx.localDateStr;
  var pushModalState=ctx.pushModalState;

  window.supStatTab='quarter';

/* ─── 여기부터 app.js에서 잘라낸 코드 붙여넣기 ─── */
  var contracts,historyData,supports;
  window.syncDashData=function(c,h,s){ contracts=c;historyData=h;supports=s; };
function expireList(year,month){
  return contracts.filter(function(c){
    if(c.terminated) return false;
    if(!c.endDate) return false;
    var d=new Date(c.endDate);
    return d.getFullYear()===year&&d.getMonth()===month;
  }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
}
  function expireHtml(list){
  var now=new Date(),todayStr=localDateStr(now);
  if(!list.length) return '<div style="color:#aaa;font-size:12px;padding:12px 0;">없음</div>';
  var threeMonthsAgo=new Date(now); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth()-3);
  var threeStr=localDateStr(threeMonthsAgo);
  return list.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='near'?'#854F0B':'#185FA5';
    var recentCount=supports.filter(function(sp){ return sp.bizName===c.name&&sp.date&&sp.date>=threeStr&&sp.date<=todayStr; }).length;
    return '<div class="dash-mini-item" onclick="goDetail(\''+c.id+'\')">'+
      '<span class="dash-mini-name">'+c.name+'</span>'+
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">'+
        '<span style="font-size:11px;color:#aaa;">최근3달 '+recentCount+'회</span>'+
        '<span class="dash-mini-right" style="color:'+col+';font-weight:600;">'+dDayLabel(d)+'</span>'+
      '</div>'+
      '</div>';
  }).join('');
}
function renderDashboard() {
  var now=new Date();
  var days=['일','월','화','수','목','금','토'];
  var todayEl=document.getElementById('dash-today');
  if(todayEl) todayEl.textContent=now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 ('+days[now.getDay()]+')';
  var counts={total:contracts.length,urgent:0,near:0,ok:0,auto:0};
  contracts.forEach(function(c){ if(c.terminated) return; var s=calcStatus(c); if(s==='urgent') counts.urgent++; else if(s==='near') counts.near++; else if(s==='auto') counts.auto++; else counts.ok++; });
  function mk(id,cls,icon,label,count) {
    var el=document.getElementById(id); if(!el) return;
    el.innerHTML='<div class="stat-icon '+cls+'"><i class="ti '+icon+'"></i></div><div class="stat-info"><div class="stat-label">'+label+'</div><div class="stat-val '+cls+'">'+count+'</div></div>';
  }
  mk('card-total','blue','ti-building','전체 사업장',counts.total);
  mk('card-urgent','red','ti-alert-circle','긴급 (D-30)',counts.urgent);
  mk('card-near','amber','ti-clock','임박 (D-90)',counts.near);
  mk('card-auto','blue2','ti-refresh','자동연장',counts.auto);
  mk('card-ok','green','ti-check','여유',counts.ok);

  var todayStr=localDateStr(now);
  var todayItems=supports.filter(function(s){
    if(!s.date) return false;
    var start=s.date.slice(0,10);
    var end=s.dateEnd?s.dateEnd.slice(0,10):start;
    return todayStr>=start&&todayStr<=end;
  });
  var schedEl=document.getElementById('dash-today-schedule');
  if(schedEl){
    var staffOrderDash=Object.keys(STAFF_MAP);
    var mealOrderDash=['조식','오전','중식','오후','석식','야식'];
    var sortedItems=todayItems.slice().sort(function(a,b){
      var an=a.staffNames&&a.staffNames.length?a.staffNames[0]:(a.staffName||'');
      var bn=b.staffNames&&b.staffNames.length?b.staffNames[0]:(b.staffName||'');
      var ai=staffOrderDash.findIndex(function(n){ return an.includes(n); });
      var bi=staffOrderDash.findIndex(function(n){ return bn.includes(n); });
      if(ai===-1) ai=99; if(bi===-1) bi=99;
      if(ai!==bi) return ai-bi;
      var am=a.meals&&a.meals.length?mealOrderDash.indexOf(a.meals[0]):-1;
      var bm=b.meals&&b.meals.length?mealOrderDash.indexOf(b.meals[0]):-1;
      if(am===-1) am=99; if(bm===-1) bm=99;
      return am-bm;
    });
    if(!sortedItems.length){
      schedEl.innerHTML='<div class="today-schedule-empty">오늘 등록된 일정이 없어요</div>';
    } else {
      var teamItems=sortedItems.filter(function(s){ return s.type==='team'; });
      var supportItems=sortedItems.filter(function(s){ return !s.type||s.type==='support'; });
      var personalItems=sortedItems.filter(function(s){ return s.type==='personal'; });
      var html='';
      if(teamItems.length){
        html+='<div style="margin-bottom:8px;">'+
          '<div style="font-size:11px;font-weight:600;color:#854F0B;margin-bottom:4px;">📢 팀 공지</div>'+
          teamItems.map(function(s){
            return '<div onclick="openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid #FAE8B0;font-size:13px;" class="today-item-inner">'+
              '<span style="font-weight:600;flex:1;">'+s.bizName+'</span>'+
              '<span style="font-size:12px;color:#888;white-space:nowrap;">'+(s.content||'')+'</span>'+
            '</div>';
          }).join('')+
        '</div>';
      }
      if(supportItems.length){
        html+='<div style="margin-bottom:8px;">'+
          '<div style="font-size:11px;font-weight:600;color:#185FA5;margin-bottom:4px;">📋 업장 지원</div>'+
          supportItems.map(function(s){
            var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
            return '<div onclick="openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid #C8DEFA;font-size:13px;">'+
              '<span class="badge-cat '+(getStaffColor(staffStr)||'')+'">'+staffStr.split(',').map(function(n){ return n.trim().split(' ')[0]; }).join(', ')+'</span>'+
              '<span style="font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+s.bizName+'</span>'+
              '<span style="font-size:12px;color:#888;white-space:nowrap;flex-shrink:0;">'+(s.category||'')+'</span>'+
            '</div>';
          }).join('')+
        '</div>';
      }
      if(personalItems.length){
        html+='<div style="margin-bottom:8px;">'+
          '<div style="font-size:11px;font-weight:600;color:#555;margin-bottom:4px;">👤 개인 일정</div>'+
          personalItems.map(function(s){
            var staffStr=s.staffNames&&s.staffNames.length?s.staffNames.join(', '):(s.staffName||'');
            var isLeave=s.personalType==='연차'||s.personalType==='반차(오전)'||s.personalType==='반차(오후)';
            return '<div onclick="openCalPopupSingle(\''+s.id+'\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid #e0e0dc;font-size:13px;">'+
              '<span class="badge-cat" style="'+(isLeave?'background:#FFCDD2;color:#A32D2D;':'')+'">'+staffStr.split(',').map(function(n){ return n.trim().split(' ')[0]; }).join(', ')+'</span>'+
              '<span style="font-weight:600;flex:1;">'+s.bizName+'</span>'+
              '<span style="font-size:12px;color:#888;white-space:nowrap;">'+(s.content||'')+'</span>'+
            '</div>';
          }).join('')+
        '</div>';
      }
      schedEl.innerHTML=html;
    }
  }

  var thisY=now.getFullYear(),thisM=now.getMonth();
  var nextY=thisM===11?thisY+1:thisY,nextM=thisM===11?0:thisM+1;
  var thisList=expireList(thisY,thisM),nextList=expireList(nextY,nextM);
  var tmEl=document.getElementById('dash-thismonth'); if(tmEl) tmEl.innerHTML=expireHtml(thisList);
  var nmEl=document.getElementById('dash-nextmonth'); if(nmEl) nmEl.innerHTML=expireHtml(nextList);
  var tmC=document.getElementById('dash-thismonth-count'); if(tmC) tmC.textContent=thisList.length+'건';
  var nmC=document.getElementById('dash-nextmonth-count'); if(nmC) nmC.textContent=nextList.length+'건';

  // 최근 계약 업데이트
  
  var recentUpdates=[];
  historyData.forEach(function(h){
    if(!h.records||!h.records.length) return;
    var c=contracts.find(function(x){ return x.id===h.contractId; }); if(!c) return;
    h.records.forEach(function(r,i){
      if(r.addType==='edit'&&i!==h.records.length-1) return;
      var baseDate=r.addType==='terminate'?r.endDate:r.startDate;
      if(!baseDate) return;
      var bd=new Date(baseDate);
      var diffDays=Math.floor((now-bd)/(1000*60*60*24));
      if(Math.abs(diffDays)>90) return;
      var prev=i>0?h.records[i-1]:null;
      recentUpdates.push({c:c,latest:r,prev:prev,diffDays:diffDays,updDate:bd});
    });
  });
recentUpdates.sort(function(a,b){ return b.updDate-a.updDate; });
  var recentEl=document.getElementById('recent-update-list');
  
 var news=recentUpdates.filter(function(x){ return x.latest.addType==='new'; });
  var renewals=recentUpdates.filter(function(x){ return x.latest.addType!=='terminate'&&x.latest.addType!=='new'; });
  var terminations=recentUpdates.filter(function(x){ return x.latest.addType==='terminate'; });
  var sortedList=[].concat(news,renewals,terminations);
  if(recentEl){
    if(!sortedList.length){
      recentEl.innerHTML='<div style="color:#aaa;font-size:12px;padding:12px 0;">최근 30일 계약 변경 내역이 없어요</div>';
    } else {
    
    recentEl.innerHTML=sortedList.slice(0,20).map(function(item){
        var s=calcStatus(item.c),d=dDiff(item.c.endDate),col=s==='urgent'?'#A32D2D':s==='near'?'#854F0B':'#185FA5';
        var isNew=item.prev===null;
        var priceChanged=item.prev&&(item.prev.price!==item.latest.price||item.prev.priceType!==item.latest.priceType);
        var priceHtml='';
        var isTerminate=item.latest.addType==='terminate';
        if(isTerminate){
          priceHtml='';
        } else if(isNew){
          priceHtml='<span style="font-size:11px;color:#888;margin-left:4px;">'+priceHistLabel(item.latest)+'</span>'+(item.latest.note?'<span style="font-size:11px;color:#aaa;margin-left:6px;">'+item.latest.note+'</span>':'');
       } else if(priceChanged){
          priceHtml='<span style="font-size:11px;color:#888;margin-left:4px;">'+priceHistLabel(item.prev)+'</span>'+
            '<span style="font-size:11px;color:#888;margin:0 3px;">→</span>'+
            '<span style="font-size:11px;color:#185FA5;font-weight:600;">'+priceHistLabel(item.latest)+'</span>';
        } else {
          priceHtml='<span style="font-size:11px;color:#888;margin-left:4px;">'+priceHistLabel(item.latest)+'</span>';
        }
       
        var diffStr=item.diffDays===0?'오늘':item.diffDays===1?'1일 전':item.diffDays+'일 전';
        return '<div class="dash-mini-item" onclick="goDetail(\''+item.c.id+'\')">'+
          '<div style="min-width:0;flex:1;">'+
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
              '<span class="dash-mini-name" style="flex:none;">'+item.c.name+'</span>'+
              
            '</div>'+
            '<div style="display:flex;align-items:center;flex-wrap:wrap;margin-top:2px;">'+
             (isTerminate?'<span style="font-size:11px;color:#A32D2D;background:#FCEBEB;padding:1px 6px;border-radius:99px;">'+(item.latest.endDate&&dDiff(item.latest.endDate)>=0?'해지 예정':'해지')+'</span>'+priceHtml:isNew?'<span style="font-size:11px;color:#185FA5;background:#E6F1FB;padding:1px 6px;border-radius:99px;">신규</span>'+priceHtml:'<span style="font-size:11px;color:#3B6D11;background:#EAF3DE;padding:1px 6px;border-radius:99px;">갱신</span>'+priceHtml)+
            '</div>'+
          '</div>'+
         '<div style="flex-shrink:0;text-align:right;">'+
            (isTerminate?'<div style="font-size:11px;color:#A32D2D;white-space:nowrap;">'+(item.latest.endDate?fmtDate(item.latest.endDate)+(dDiff(item.latest.endDate)>=0?' 해지 예정':' 해지'):'')+'</div>':'<div style="font-size:11px;color:#888;white-space:nowrap;">'+(item.latest.startDate?fmtDate(item.latest.startDate):'')+'</div><div style="font-size:11px;color:#888;white-space:nowrap;">~ '+(item.latest.endDate?fmtDate(item.latest.endDate):'')+'</div>')+
          '</div>'+
        '</div>';
     }).join('');
    }
  }
  renderSupStat('month');
}


window.toggleSupStat=function(){
  var card=document.getElementById('sup-stat-card');
  var icon=document.getElementById('sup-stat-icon');
  var body=card?card.querySelector('.card-body'):null;
  if(!body) return;
  var isHidden=body.style.display==='none';
  body.style.display=isHidden?'':'none';
  if(icon) icon.style.transform=isHidden?'rotate(180deg)':'';
  if(isHidden&&!document.getElementById('dash-sup-stat').innerHTML) renderSupStat(window.supStatTab);
};
window.setSupStatTab=function(tab){
  window.supStatTab=tab;
  ['quarter','year'].forEach(function(t){
    var btn=document.getElementById('sup-tab-'+t);
    if(btn) btn.classList.toggle('active-filter',t===tab);
  });
  renderSupStat(tab);
};

function buildStaffSubHtml(cat,items){
  var staffMap={};
  items.forEach(function(s){
    var names=s.staffNames&&s.staffNames.length?s.staffNames:(s.staffName?[s.staffName]:[]);
    names.forEach(function(n){
      var short=n.split(' ')[0];
      if(!staffMap[short]) staffMap[short]={count:0,items:[],color:getStaffColor(n)};
      staffMap[short].count++;
      staffMap[short].items.push(s);
    });
  });
  return Object.keys(staffMap).map(function(name){
    var sd=staffMap[name];
    var subId='cat-'+cat.replace(/\s/g,'')+'-'+name;
    return '<div style="border-bottom:.5px solid #f0f0ec;">'+
      '<div onclick="toggleCatGroup(\''+subId+'\')" style="display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;background:#fafaf8;">'+
        '<span class="badge-cat '+sd.color+'">'+name+'</span>'+
        '<span style="font-size:13px;font-weight:600;flex:1;">'+sd.count+'회</span>'+
        '<i class="ti ti-chevron-down" id="ico-'+subId+'" style="font-size:12px;color:#aaa;transition:transform .2s;"></i>'+
      '</div>'+
      '<div id="'+subId+'" style="display:none;">'+
        sd.items.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).map(function(s){
          var c=contracts.find(function(x){ return x.name===s.bizName; }),cid=c?c.id:'';
          var dateStr=s.date||''; if(s.dateEnd&&s.dateEnd!==s.date) dateStr+='~'+s.dateEnd.slice(5);
          var menuStr=(cat.indexOf('특식지원')!==-1||cat.indexOf('이벤트')!==-1)&&s.content?s.content.split(' / ')[0]:'';
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 14px 7px 28px;border-top:.5px solid #f0f0ec;gap:8px;'+(cid?'cursor:pointer;':'')+'"'+(cid?' onclick="goDetail(\''+cid+'\')"':'')+'>'+
            '<div style="flex:1;min-width:0;">'+
              '<span style="font-size:12px;font-weight:500;'+(cid?'color:#185FA5;':'')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">'+s.bizName+'</span>'+
              (menuStr?'<span style="font-size:11px;color:#854F0B;">'+menuStr+'</span>':'')+
            '</div>'+
            '<span style="font-size:11px;color:#aaa;flex-shrink:0;">'+dateStr+'</span>'+
          '</div>';
        }).join('')+
      '</div>'+
    '</div>';
  }).join('');
}

function renderCatStat(list,prefix){
  prefix=prefix||'';
  var filtered=list.filter(function(s){ return !s.type||s.type==='support'; });
  if(!filtered.length) return '<div style="color:#aaa;font-size:12px;padding:8px 0;">내역이 없어요</div>';
  var CATS=['운영점검','위생점검','환경개선','특식지원','이벤트','배식지원','고객미팅','기타지원'];
  var catMap={};
  filtered.forEach(function(s){
    var cat=s.category||'기타지원';
    if(!catMap[cat]) catMap[cat]={count:0,items:[]};
    catMap[cat].count++;
    catMap[cat].items.push(s);
  });
  var cats=CATS.filter(function(c){ return catMap[c]; });
  Object.keys(catMap).forEach(function(c){ if(CATS.indexOf(c)===-1) cats.push(c); });
  cats.sort(function(a,b){ return catMap[b].count-catMap[a].count; });
  if(!cats.length) return '<div style="color:#aaa;font-size:12px;padding:8px 0;">내역이 없어요</div>';
  var maxCat=Math.max.apply(null,cats.map(function(c){ return catMap[c].count; }));
  return '<div style="display:flex;flex-direction:column;gap:4px;">'+
    cats.map(function(cat){
      var data=catMap[cat],barW=Math.round((data.count/maxCat)*100);
      var id='cat-'+prefix+'-'+cat.replace(/\s/g,'');
      return '<div style="border:.5px solid #e8e8e4;border-radius:8px;overflow:hidden;">'+
        '<div onclick="toggleCatGroup(\''+id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:#fafaf8;">'+
          '<span style="font-size:13px;font-weight:600;min-width:60px;">'+cat+'</span>'+
          '<div style="flex:1;background:#e8e8e4;border-radius:4px;height:8px;">'+
            '<div style="width:'+barW+'%;background:#185FA5;height:8px;border-radius:4px;transition:width .3s;"></div>'+
          '</div>'+
          '<span style="font-size:13px;font-weight:600;color:#185FA5;min-width:32px;text-align:right;">'+data.count+'건</span>'+
          '<i class="ti ti-chevron-down" id="ico-'+id+'" style="font-size:13px;color:#aaa;transition:transform .2s;"></i>'+
        '</div>'+
        '<div id="'+id+'" style="display:none;border-top:.5px solid #f0f0ec;">'+
          buildStaffSubHtml(prefix+'-'+cat,data.items)+
        '</div>'+
      '</div>';
    }).join('')+
  '</div>';
}

window.toggleCatGroup=function(id){
  var el=document.getElementById(id),ico=document.getElementById('ico-'+id);
  if(!el) return;
  var open=el.style.display==='none';
  el.style.display=open?'block':'none';
  if(ico) ico.style.transform=open?'rotate(180deg)':'';
};

function renderNoVisit(startM,endM,year,label){
  var todayStr=localDateStr();
  var noVisit=contracts.filter(function(c){
    var s=calcStatus(c);
    if(s!=='urgent'&&s!=='near') return false;
    return !supports.some(function(sp){
      if(sp.bizName!==c.name||!sp.date) return false;
      var d=new Date(sp.date),m=d.getMonth();
      return d.getFullYear()===year&&m>=startM&&m<=endM&&sp.date<=todayStr;
    });
  }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  if(!noVisit.length) return '<div style="margin-top:12px;padding:8px 12px;background:#EAF3DE;border-radius:8px;font-size:12px;color:#3B6D11;">✅ '+label+' 긴급/임박 사업장 모두 방문 완료!</div>';
  return '<div style="margin-top:12px;">'+
    '<div style="font-size:12px;font-weight:600;color:#A32D2D;margin-bottom:6px;">🔴 긴급/임박 미방문 ('+label+') '+noVisit.length+'곳</div>'+
    noVisit.map(function(c){
      var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':'#854F0B';
      return '<div class="dash-mini-item" onclick="goDetail(\''+c.id+'\')">'+
        '<span class="dash-mini-name">'+c.name+'</span>'+
        '<span style="font-size:12px;font-weight:600;color:'+col+';">'+dDayLabel(d)+'</span>'+
        '</div>';
    }).join('')+
  '</div>';
}

function renderSupStat(tab){
  var now=new Date(),thisY=now.getFullYear(),thisM=now.getMonth();
  var statEl=document.getElementById('dash-sup-stat'); if(!statEl) return;
  var todayStr=localDateStr(now);
  var curQ=Math.floor(thisM/3);



  if(tab==='quarter'){
    var quarters=['1분기','2분기','3분기','4분기'];
    var qSubs=['1~3월','4~6월','7~9월','10~12월'];
    var qData=quarters.map(function(_,qi){
      var qStartM=qi*3,qEndM=qi*3+2;
      var items=supports.filter(function(s){
        if(!s.date) return false;
        var d=new Date(s.date),m=d.getMonth();
        return d.getFullYear()===thisY&&m>=qStartM&&m<=qEndM&&s.date<=todayStr;
      });
      return {label:quarters[qi],sub:qSubs[qi],items:items,current:qi===curQ};
    });
    var html='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">';
    qData.forEach(function(q,qi){
      var id='q-detail-'+qi;
      html+='<div style="border:.5px solid '+(q.current?'#B5D4F4':'#e8e8e4')+';border-radius:8px;overflow:hidden;">'+
        '<div onclick="toggleCatGroup(\''+id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;background:'+(q.current?'#E6F1FB':'#fafaf8')+';">'+
          '<div>'+
            '<div style="font-size:12px;font-weight:600;color:'+(q.current?'#185FA5':'#555')+';">'+q.label+'</div>'+
            '<div style="font-size:10px;color:#aaa;">'+q.sub+'</div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span style="font-size:16px;font-weight:700;color:'+(q.current?'#185FA5':'#1a1a18')+';">'+q.items.length+'건</span>'+
            '<i class="ti ti-chevron-down" id="ico-q-detail-'+qi+'" style="font-size:13px;color:#aaa;transition:transform .2s;"></i>'+
          '</div>'+
        '</div>'+
        '<div id="'+id+'" style="display:'+(q.current?'block':'none')+';">'+
          '<div style="padding:8px;">'+renderCatStat(q.items,'q'+qi)+'</div>'+
        '</div>'+
      '</div>';
      if(q.current){
        setTimeout(function(){
          var ico=document.getElementById('ico-q-detail-'+qi);
          if(ico) ico.style.transform='rotate(180deg)';
        },50);
      }
    });
    html+='</div>';
    statEl.innerHTML=html;

  } else if(tab==='year'){
    var monthLabels=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var totalYear=supports.filter(function(s){ return s.date&&s.date.startsWith(thisY+'')&&s.date<=todayStr&&(!s.type||s.type==='support'); }).length;
    var bizYear={};
    supports.forEach(function(s){ if(s.date&&s.date.startsWith(thisY+'')&&s.date<=todayStr&&(!s.type||s.type==='support')) bizYear[s.bizName]=true; });
    var html='<div style="display:flex;gap:8px;margin-bottom:12px;">'+
      '<div style="background:#E6F1FB;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">'+
        '<div style="font-size:11px;color:#185FA5;font-weight:600;">올해 총 지원</div>'+
        '<div style="font-size:22px;font-weight:700;color:#185FA5;">'+totalYear+'<span style="font-size:12px;font-weight:400;">회</span></div>'+
      '</div>'+
      '<div style="background:#f5f5f3;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">'+
        '<div style="font-size:11px;color:#555;font-weight:600;">방문 업장수</div>'+
        '<div style="font-size:22px;font-weight:700;color:#1a1a18;">'+Object.keys(bizYear).length+'<span style="font-size:12px;font-weight:400;">개소</span></div>'+
      '</div>'+
    '</div>';
    html+='<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">';
    monthLabels.forEach(function(mLabel,mi){
      var mStr=thisY+'-'+String(mi+1).padStart(2,'0');
      var mItems=supports.filter(function(s){ return s.date&&s.date.startsWith(mStr)&&s.date<=todayStr; });
      var isCur=mi===thisM;
      var id='m-detail-'+mi;
      html+='<div style="border:.5px solid '+(isCur?'#B5D4F4':'#e8e8e4')+';border-radius:8px;overflow:hidden;">'+
        '<div onclick="toggleCatGroup(\''+id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;cursor:pointer;background:'+(isCur?'#E6F1FB':'#fafaf8')+';">'+
          '<span style="font-size:13px;font-weight:600;color:'+(isCur?'#185FA5':'#555')+';">'+mLabel+(isCur?' ● 이번달':mItems.length===0?' <span style="font-size:10px;color:#ccc;">없음</span>':'')+'</span>'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            (mItems.length?'<span style="font-size:14px;font-weight:700;color:'+(isCur?'#185FA5':'#1a1a18')+';">'+mItems.length+'건</span>':'')+
            (mItems.length?'<i class="ti ti-chevron-down" id="ico-'+id+'" style="font-size:13px;color:#aaa;transition:transform .2s;"></i>':'')+
          '</div>'+
        '</div>'+
        (mItems.length?'<div id="'+id+'" style="display:'+(isCur?'block':'none')+';">'+
          '<div style="padding:8px;">'+renderCatStat(mItems,'m'+mi)+'</div>'+
        '</div>':'')+
      '</div>';
    });
    html+='</div>';
    statEl.innerHTML=html;
    setTimeout(function(){
      var ico=document.getElementById('ico-m-detail-'+thisM);
      if(ico) ico.style.transform='rotate(180deg)';
    },50);
  }
}

window.toggleDashCard=function(el,filter) {
  document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); });
  el.classList.add('active-card');
  var labels={all:'전체 사업장',urgent:'긴급 (D-30)',near:'임박 (D-90)',auto:'자동연장',ok:'여유'};
  var list=contracts.filter(function(c){ if(c.terminated) return false; var s=calcStatus(c); return filter==='all'?true:s===filter; }).sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); });
  var now2=new Date(),todayStr2=localDateStr(now2);
  var threeMonthsAgo=new Date(now2); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth()-3);
  var threeStr=localDateStr(threeMonthsAgo);
  var html=list.length?list.map(function(c){
    var s=calcStatus(c),d=dDiff(c.endDate),col=s==='urgent'?'#A32D2D':s==='auto'?'#185FA5':s==='near'?'#854F0B':'#3B6D11';
    var nutriStr=c.nutritionists&&c.nutritionists.length?c.nutritionists[0].name:'';
    var recentCount=supports.filter(function(sp){ return sp.bizName===c.name&&sp.date&&sp.date>=threeStr&&sp.date<=todayStr2; }).length;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:.5px solid #f0f0ec;cursor:pointer;gap:8px;" onclick="closeDashModal();goDetail(\''+c.id+'\')">' +
      '<div style="min-width:0;flex:1;"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+c.name+'</div>'+
      '<div style="font-size:11px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(nutriStr?nutriStr+' · ':'')+(c.resp||'')+'</div></div>'+
      '<div style="text-align:right;flex-shrink:0;">'+
        '<span class="badge '+s+'">'+STATUS_META[s].label+'</span>'+
        '<div style="font-size:11px;color:#aaa;margin-top:2px;">최근3달 '+recentCount+'회</div>'+
        '<div style="font-size:11px;font-weight:500;color:'+col+'">'+dDayLabel(d)+'</div>'+
      '</div></div>';
  }).join(''):'<div class="empty-state"><i class="ti ti-check"></i>해당 없음</div>';

  var existing=document.getElementById('dash-modal'); if(existing) existing.remove();
  var modal=document.createElement('div');
  modal.id='dash-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding-top:80px;';
  modal.innerHTML='<div style="background:#fff;border-radius:14px;width:480px;max-width:95vw;max-height:75vh;display:flex;flex-direction:column;">'+
    '<div style="padding:14px 18px;border-bottom:.5px solid #e8e8e4;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'+
      '<span style="font-size:14px;font-weight:600;">'+labels[filter]+' · '+list.length+'개소</span>'+
      '<button class="btn sm" onclick="closeDashModal()"><i class="ti ti-x"></i></button>'+
    '</div>'+
    '<div style="overflow-y:auto;">'+html+'</div>'+
  '</div>';
  modal.addEventListener('click',function(e){ if(e.target===modal) closeDashModal(); });
  document.body.appendChild(modal);
  
  pushModalState();
};
window.closeDashModal=function(){
  var m=document.getElementById('dash-modal'); if(m) m.remove();
  document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); });
};
window._closeDashModalFromPop=function(){
  var m=document.getElementById('dash-modal'); if(m) m.remove();
  document.querySelectorAll('.stat-card').forEach(function(c){ c.classList.remove('active-card'); });
};
  window.renderDashboard=renderDashboard;
window.renderSupStat=renderSupStat;
/* ─── 여기까지 ─── */
}
