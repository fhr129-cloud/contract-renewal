// admin.js — 관리자 기능 (엑셀/백업/동기화)
import { fetchAllForBackup, getBackupInfo, setBackupInfo, updateContract, saveStaff, deleteStaff, importStaff, ensureAllowedUser, removeAllowedUser, listAllowedRoles, saveStaffOrder, auth } from './db.js';
import { DEFAULT_STAFF, COLOR_PALETTE, fullName, hasApp } from './staff.js';
import { calcStatus, STATUS_META, fmtDate, dDiff, priceLabel } from './utils.js';

export function initAdmin(ctx){
  // ctx: { getContracts, getHistory, showToast, mealsDisplay }
  var showToast=ctx.showToast;

   window.exportExcel=async function(){
    // 엑셀 기능(약 1MB)은 처음 누를 때만 불러옴
    if(!window.XLSX){
      showToast('엑셀 준비 중…');
      try{ await window.loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }
      catch(e){ showToast('엑셀 기능을 불러오지 못했어요. 인터넷 연결을 확인해주세요.'); return; }
    }
    var contracts=ctx.getContracts();
    var rows=[['번호','사업장','소재지','팀','책임','담당 영양사','담당자','연락처','시작일','종료일','D-day','단가','평균식수','운영끼니','상태','비고']];
    contracts.slice().sort(function(a,b){ return new Date(a.endDate)-new Date(b.endDate); }).forEach(function(c){
      var s=calcStatus(c);
      var ns=c.nutritionists&&c.nutritionists.length?c.nutritionists.map(function(nt){ return nt.name+(nt.phone?' '+nt.phone:''); }).join(' / '):'';
      var cs=c.contacts&&c.contacts.length?c.contacts.map(function(ct){ return ct.name+(ct.phone?' '+ct.phone:''); }).join(' / '):(c.contactName||'');
      rows.push([c.no||'',c.name,c.addr||'',c.team||'',c.resp||'',ns,cs,c.contactPhone||'',fmtDate(c.startDate),fmtDate(c.endDate),dDiff(c.endDate),priceLabel(c),c.avgMeals||'',ctx.mealsDisplay(c.meals),STATUS_META[s].label,c.note||'']);
    });
    var wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb,ws,'계약현황');
    XLSX.writeFile(wb,'FS사업장현황_'+new Date().toISOString().slice(0,10)+'.xlsx');
    showToast('엑셀 저장되었습니다.');
  };

  window.downloadBackup=async function(){
    showToast('백업 데이터 수집 중...');
    try{
      var data=await fetchAllForBackup();
      data._exportedAt=new Date().toISOString();
      var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      var d=new Date();
      a.href=url;
      a.download='FS백업_'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('백업 파일이 다운로드됐어요!');
      try{ await setBackupInfo(window.currentUserName||''); backupInfo=null; window.renderBackupNote(); }catch(e2){ console.warn(e2); }
    } catch(e){ showToast('백업 실패: '+(e.message||'')); }
  };
  // 관리자 화면 위쪽: 마지막 백업 날짜 표시 (7일 넘으면 노란 경고)
  var backupInfo=null, backupLoading=false;
  window.renderBackupNote=function(){
    var wrap=document.getElementById('admin-contracts'); if(!wrap) return;
    var el=document.getElementById('backup-note');
    if(!el){ el=document.createElement('div'); el.id='backup-note'; wrap.insertBefore(el,wrap.firstChild); }
    if(!backupInfo){
      if(backupLoading) return; backupLoading=true;
      getBackupInfo().then(function(i){ backupInfo=i||{none:true}; backupLoading=false; window.renderBackupNote(); })
        .catch(function(){ backupLoading=false; });
      return;
    }
    var days=backupInfo.at?Math.floor((Date.now()-new Date(backupInfo.at).getTime())/86400000):null;
    var old=days===null||days>=7;
    var when=days===null?'기록 없음':days===0?'오늘':days+'일 전';
    el.className='backup-note'+(old?' warn':'');
    el.innerHTML='<i class="ti ti-database'+(old?'-exclamation':'')+'"></i><span>마지막 백업: <b>'+when+'</b>'+(backupInfo.by?' ('+String(backupInfo.by).replace(/[<>&"]/g,'')+')':'')+
      (old?' · 일주일에 한 번은 백업해 두세요.':'')+'</span>'+(old?'<button class="btn sm" onclick="downloadBackup()">지금 백업</button>':'');
  };
  window.syncContractsFromHistory=async function(){
    if(!confirm('히스토리 마지막 record 기준으로 전체 계약정보를 업데이트할까요?')) return;
    var contracts=ctx.getContracts(),historyData=ctx.getHistory();
    var updated=0;
    for(var i=0;i<contracts.length;i++){
      var c=contracts[i];
      var h=historyData.find(function(x){ return x.contractId===c.id; });
      if(!h||!h.records||!h.records.length) continue;
      var last=h.records[h.records.length-1];
      if(last.addType==='terminate') continue;
      if(!last.endDate||last.endDate.trim()==='') continue;
      await updateContract(c.id,{
        startDate:last.startDate||c.startDate,
        endDate:last.endDate,
        price:last.price||0,
        priceType:last.priceType||'per-meal'
      });
      updated++;
    }
    var skipped=[];
    contracts.forEach(function(c){
      var h=historyData.find(function(x){ return x.contractId===c.id; });
      if(!h||!h.records||!h.records.length){ skipped.push(c.name+' (히스토리없음)'); return; }
      var last=h.records[h.records.length-1];
      if(last.addType==='terminate'){ skipped.push(c.name+' (해지)'); return; }
      if(!last.endDate||last.endDate.trim()==='') skipped.push(c.name+' (종료일없음)');
    });
        console.log('동기화 제외:', skipped);
    showToast(updated+'개 사업장 동기화 완료!');
  };
  window.recalcCoords=async function(){
    if(!window.kakaoReady){ showToast('지도 서비스가 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.'); return; }
    var contracts=ctx.getContracts().filter(function(c){ return c.addr; });
    if(!confirm(contracts.length+'개 사업장의 주소로 좌표를 다시 계산할까요?\n(1~2분 걸려요. 완료 전에 화면을 닫지 마세요)')) return;
    var geocoder=new kakao.maps.services.Geocoder();
    var ok=0,fail=[];
    for(var i=0;i<contracts.length;i++){
      var c=contracts[i];
      showToast('좌표 계산 중… '+(i+1)+'/'+contracts.length);
      var r=await new Promise(function(resolve){
        geocoder.addressSearch(c.addr,function(result,status){
          if(status===kakao.maps.services.Status.OK) resolve({lat:parseFloat(result[0].y),lng:parseFloat(result[0].x)});
          else resolve(null);
        });
      });
      if(r){
        try{ await updateContract(c.id,{lat:r.lat,lng:r.lng}); ok++; }
        catch(e){ console.error(c.name,e); fail.push(c.name); }
      } else fail.push(c.name);
      await new Promise(function(res){ setTimeout(res,150); });
    }
    console.log('좌표 실패:',fail);
    showToast('좌표 갱신 '+ok+'개 완료'+(fail.length?' · 실패 '+fail.length+'개 (콘솔 참고)':''));
  };

  // ── 직원 관리 ──────────────────────────
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  // 소속 5개. 저장값(group)은 예전 데이터와 맞추려고 '운영'(=운영팀 FS), '지원'을 그대로 씀
  var DEPTS=[ {v:'운영',label:'운영팀 (FS)',color:'#185FA5'}, {v:'CS',label:'운영팀 (CS)',color:'#0B6B5A'},
    {v:'지원',label:'지원팀',color:'#444444'}, {v:'관리',label:'관리팀',color:'#6B5B0B'}, {v:'영업',label:'영업팀',color:'#A32D2D'} ];
  window.STAFF_DEPTS=DEPTS;
  function deptOf(s){ return (s&&s.group)||'운영'; }
  function deptLabel(v){ var d=DEPTS.filter(function(x){ return x.v===v; })[0]; return d?d.label:(v||'운영')+'팀'; }
  var editingStaffId=null, roles={}, rolesLoaded=false, sortables=[], orderMode=false, openGroups={};
  var form={ group:'운영', fs:true, car:true, admin:false, color:null };
  function myPhoneNow(){ return auth.currentUser&&auth.currentUser.email?auth.currentUser.email.split('@')[0]:''; }
  function digits(p){ return String(p||'').replace(/[^0-9]/g,''); }
  function loadRoles(){
    listAllowedRoles().then(function(m){ roles=m; rolesLoaded=true; cleanupRetired(); window.renderStaffAdmin(); })
      .catch(function(e){ console.warn('권한 목록을 못 읽었어요',e); });
  }
  // 예전에 퇴사 처리했는데 로그인 허용이 남아 있는 직원 → 로그인 막기 (한 번만 자동 정리)
  function cleanupRetired(){
    var me=myPhoneNow();
    var activeP=(window.STAFF_ALL||[]).filter(function(s){ return s.active!==false; }).map(function(s){ return digits(s.phone); });
    var left=(window.STAFF_ALL||[]).filter(function(s){ var p=digits(s.phone); return s.active===false&&p&&p!==me&&roles[p]&&activeP.indexOf(p)<0; });
    if(!left.length) return;
    Promise.all(left.map(function(s){ var p=digits(s.phone); return removeAllowedUser(p).then(function(){ delete roles[p]; }); }))
      .then(function(){ showToast('퇴사 처리된 '+left.length+'명의 로그인을 막았어요.'); window.renderStaffAdmin(); })
      .catch(function(e){ console.warn('퇴사자 로그인 정리 실패',e); });
  }
  // 관리자 화면 위쪽 탭: 사업장 계약 / 직원 관리
  window.setAdminTab=function(t){
    window._adminTab=t;
    document.querySelectorAll('#admin-tabs .tab-btn').forEach(function(b){ b.classList.toggle('active',b.getAttribute('data-t')===t); });
    var c=document.getElementById('admin-contracts'), s=document.getElementById('admin-staff');
    if(c) c.style.display=t==='staff'?'none':'';
    if(s) s.style.display=t==='staff'?'':'none';
    if(t==='staff'){ if(!rolesLoaded) loadRoles(); window.renderStaffAdmin(); }
  };
  // 색상: 다른 직원과 겹치지 않는 색을 자동으로
  function usedColors(exceptId){ return (window.STAFF_ALL||[]).filter(function(s){ return s.id!==exceptId&&s.active!==false; }).map(function(s){ return String(s.color||'').toLowerCase(); }); }
  function pickColor(exceptId, after){
    var used=usedColors(exceptId), pal=COLOR_PALETTE, start=0;
    if(after){ var i=pal.map(function(c){ return c.color.toLowerCase(); }).indexOf(after.color.toLowerCase()); start=i+1; }
    for(var k=0;k<pal.length;k++){ var c=pal[(start+k)%pal.length]; if(used.indexOf(c.color.toLowerCase())<0&&(!after||c.color!==after.color)) return c; }
    // 팔레트가 다 쓰였으면 새 색을 만듦
    var h=Math.floor(Math.random()*360);
    return { color:'hsl('+h+',55%,32%)', bg:'hsl('+h+',60%,94%)', border:'hsl('+h+',50%,78%)' };
  }
  function permBadges(s){
    var p=digits(s.phone), b='';
    if(hasApp(s,'fs')) b+='<span class="staff-pb" style="background:#E6F1FB;color:#185FA5">FS</span>';
    if(hasApp(s,'car')) b+='<span class="staff-pb" style="background:#EAF3DE;color:#3B6D11">차량</span>';
    if(p&&roles[p]==='admin') b+='<span class="staff-pb" style="background:#FCEBEB;color:#A32D2D">관리자</span>';
    return b;
  }
  window.toggleStaffGroup=function(v){ openGroups[v]=!openGroups[v]; window.renderStaffAdmin(); };
  window.renderStaffAdmin=function(){
    var el=document.getElementById('staff-admin-list'); if(!el) return;
    var all=(window.STAFF_ALL||[]).filter(function(s){ return !!s.id; });
    var cnt=document.getElementById('admin-staff-count'); if(cnt) cnt.textContent=all.filter(function(s){ return s.active!==false; }).length;
    if(!all.length){
      el.innerHTML='<div class="staff-empty">직원 명단이 아직 앱에 없어요. 코드에 있던 기존 명단('+DEFAULT_STAFF.filter(function(s){ return s.active!==false; }).length+'명)을 가져오면 시작됩니다.</div>'+
        '<button class="btn primary" onclick="importDefaultStaff()"><i class="ti ti-download"></i> 기존 직원 가져오기</button>';
      return;
    }
    var active=all.filter(function(s){ return s.active!==false; }), retired=all.filter(function(s){ return s.active===false; });
    // 소속 목록: 5개 + 예전 데이터에 다른 값이 있으면 뒤에
    var groups=DEPTS.map(function(d){ return d.v; });
    active.forEach(function(s){ if(groups.indexOf(deptOf(s))<0) groups.push(deptOf(s)); });
    function row(s,drag){
      return '<div class="staff-row'+(s.active===false?' retired':'')+'" data-id="'+s.id+'">'+
        (drag&&orderMode?'<span class="staff-grip" title="끌어서 순서 바꾸기"><i class="ti ti-grip-vertical"></i></span>':'')+
        '<span class="staff-swatch" style="background:'+esc(s.bg||'#f0f0ec')+';border-color:'+esc(s.border||'#ccc')+';color:'+esc(s.color||'#444')+'">'+esc(s.name.slice(0,1))+'</span>'+
        '<span class="staff-name">'+esc(fullName(s))+'</span>'+
        '<span class="staff-meta">'+permBadges(s)+(hasApp(s,'fs')&&s.team?' · '+s.team+'팀'+(s.lead?' 팀장':''):'')+'</span>'+
        (orderMode&&drag?'':'<button class="btn sm" onclick="openStaffModal(\''+s.id+'\')"><i class="ti ti-pencil"></i> 수정</button>')+'</div>';
    }
    var h='<div class="staff-order-bar'+(orderMode?' on':'')+'">'+(orderMode
        ?'<span><i class="ti ti-arrows-sort"></i> 손잡이(⋮⋮)를 끌어서 순서를 바꾸세요. 같은 소속 안에서 바뀌고, 바로 저장돼요.</span><button class="btn sm primary" onclick="toggleStaffOrder()">완료</button>'
        :'<span>재직 '+active.length+'명</span><button class="btn sm" onclick="toggleStaffOrder()"><i class="ti ti-arrows-sort"></i> 순서 바꾸기</button>')+'</div>';
    groups.forEach(function(g){
      var ppl=active.filter(function(s){ return deptOf(s)===g; }); if(!ppl.length&&DEPTS.every(function(d){ return d.v!==g; })) return;
      var d=DEPTS.filter(function(x){ return x.v===g; })[0];
      var isOpen=orderMode||!!openGroups[g];
      h+='<div class="staff-grp'+(isOpen?' open':'')+'"><button type="button" class="staff-grp-h" onclick="toggleStaffGroup(\''+esc(g)+'\')"><span class="dot" style="background:'+(d?d.color:'#999')+'"></span>'+esc(deptLabel(g))+' <span class="cnt">'+ppl.length+'명</span><i class="ti ti-chevron-down"></i></button>'+
        '<div class="staff-grp-b"><div class="staff-list'+(orderMode?' ordering':'')+'" data-group="'+esc(g)+'">'+(ppl.length?ppl.map(function(s){ return row(s,true); }).join(''):'<div class="staff-sub" style="margin:4px">아직 없어요</div>')+'</div></div></div>';
    });
    if(retired.length&&!orderMode){
      h+='<div class="staff-grp'+(openGroups._retired?' open':'')+'" style="opacity:.8"><button type="button" class="staff-grp-h" onclick="toggleStaffGroup(\'_retired\')"><span class="dot" style="background:#bbb"></span>퇴사 · 비활성 <span class="cnt">'+retired.length+'명</span><i class="ti ti-chevron-down"></i></button>'+
        '<div class="staff-grp-b"><div class="staff-list">'+retired.map(function(s){ return row(s,false); }).join('')+'</div></div></div>';
    }
    h+='<div class="staff-hint">소속을 누르면 펼쳐져요. 이 순서대로 일정 담당자 목록에 나와요.</div>';
    el.innerHTML=h;
    // 드래그로 순서 바꾸기 (순서 바꾸기 모드에서만, 휴대폰은 손잡이를 잠깐 눌러야 움직임)
    sortables.forEach(function(x){ try{ x.destroy(); }catch(e){} }); sortables=[];
    if(orderMode&&window.Sortable){
      el.querySelectorAll('.staff-list[data-group]').forEach(function(box){
        sortables.push(window.Sortable.create(box,{ handle:'.staff-grip', animation:150, ghostClass:'staff-ghost', delay:200, delayOnTouchOnly:true, touchStartThreshold:6,
          onEnd:function(){
            var ids=[];
            el.querySelectorAll('.staff-list[data-group] .staff-row').forEach(function(r){ ids.push(r.getAttribute('data-id')); });
            retired.forEach(function(s){ ids.push(s.id); });
            saveStaffOrder(ids).then(function(){ showToast('순서를 저장했어요.'); })
              .catch(function(e){ console.error(e); showToast('순서 저장 실패: '+(e.message||'')); });
          }}));
      });
    }
  };
  window.toggleStaffOrder=function(){ orderMode=!orderMode; window.renderStaffAdmin(); };
  window.importDefaultStaff=async function(){
    if(!confirm('코드에 있던 직원 명단을 앱으로 가져올까요? (한 번만 하면 됩니다)')) return;
    try{ await importStaff(DEFAULT_STAFF); showToast('직원 명단을 가져왔어요.'); }
    catch(e){ console.error(e); showToast('가져오기 실패: '+(e.message||'')); }
  };
  // ── 직원 추가·수정 창: ① 소속 → ② 권한 → (FS면) FS 앱 설정 → ③ 직원 정보 ──
  window.openStaffModal=async function(id){
    if(!rolesLoaded){ try{ roles=await listAllowedRoles(); rolesLoaded=true; }catch(e){ showToast('권한 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'); return; } }
    var s=id?(window.STAFF_ALL||[]).filter(function(x){ return x.id===id; })[0]:null;
    editingStaffId=s?s.id:null;
    var ov=document.getElementById('staff-modal'); if(!ov) return;
    var p=s?digits(s.phone):'';
    form={ group:s?deptOf(s):'운영', fs:s?hasApp(s,'fs'):true, car:s?hasApp(s,'car'):true, admin:!!(p&&roles[p]==='admin'),
           color:s&&s.color?{color:s.color,bg:s.bg,border:s.border}:pickColor(null) };
    document.getElementById('sf-title').textContent=s?'직원 수정':'직원 추가';
    document.getElementById('sf-name').value=s?s.name:'';
    document.getElementById('sf-jobtitle').value=s?s.title||'':'';
    document.getElementById('sf-team').value=s?String(s.team||0):'0';
    document.getElementById('sf-lead').checked=!!(s&&s.lead);
    document.getElementById('sf-phone').value=s?(s.phone||''):'';
    document.getElementById('sf-active').checked=s?s.active!==false:true;
    document.getElementById('sf-delete').style.display=s?'':'none';
    syncStaffAppUI();
    ov.classList.add('open');
    if(window.pushModalState) window.pushModalState();
  };
  window.pickStaffGroup=function(v){ form.group=v; syncStaffAppUI(); };
    window.toggleStaffPerm=function(k){ var b=document.getElementById(k==='admin'?'sf-admin':'sf-app-'+k); form[k]=b?b.checked:!form[k]; syncStaffAppUI(); };
  window.nextStaffColor=function(){ form.color=pickColor(editingStaffId, form.color); syncStaffAppUI(); };
  window.syncStaffAppUI=function(){
        var sel=document.getElementById('sf-group');
    if(sel){ if(!sel.options.length) sel.innerHTML=DEPTS.map(function(d){ return '<option value="'+d.v+'">'+d.label+'</option>'; }).join(''); sel.value=form.group; }
    ['fs','car','admin'].forEach(function(k){ var b=document.getElementById(k==='admin'?'sf-admin':'sf-app-'+k); if(b) b.checked=!!form[k]; });
    var hint=document.getElementById('sf-perm-hint');
    if(hint) hint.textContent=form.admin?'관리자: 계약 수정·직원 관리·모든 일정과 차량 예약을 고칠 수 있어요.'
      :(!form.fs&&!form.car?'하나 이상 골라주세요.':!form.fs?'FS 사업장·일정 데이터는 볼 수 없어요.':'');
    document.getElementById('sf-fsset').style.display=form.fs?'':'none';
    document.getElementById('sf-lead-wrap').style.visibility=document.getElementById('sf-team').value!=='0'?'visible':'hidden';
    var pv=document.getElementById('sf-color-preview');
    if(pv&&form.color){ pv.style.background=form.color.bg; pv.style.borderColor=form.color.color; }
    var sum=document.getElementById('sf-sum');
    if(sum) sum.textContent=deptLabel(form.group)+' · '+[form.fs?'FS':'',form.car?'차량':'',form.admin?'관리자':''].filter(Boolean).join(' + ');
  };
  window.closeStaffModal=function(){ var ov=document.getElementById('staff-modal'); if(ov) ov.classList.remove('open'); };
  window.saveStaffForm=async function(){
    var name=document.getElementById('sf-name').value.trim();
    if(!name){ showToast('이름을 입력해주세요.'); return; }
    var phone=digits(document.getElementById('sf-phone').value);
    var apps=[]; if(form.fs) apps.push('fs'); if(form.car) apps.push('car');
    var wantAdmin=!!form.admin, active=document.getElementById('sf-active').checked;
    if(!apps.length){ showToast('권한을 하나 이상 골라주세요. (FS 사업장 관리 또는 차량 예약)'); return; }
    if(phone.length<10){ showToast('휴대폰 번호를 넣어주세요. 로그인 아이디로 쓰여요.'); return; }
    var myPhone=myPhoneNow();
    if(phone===myPhone&&apps.indexOf('fs')<0){ showToast('내 계정의 FS 권한은 끌 수 없어요.'); return; }
    if(phone===myPhone&&!wantAdmin){ showToast('내 계정의 관리자 권한은 끌 수 없어요.'); return; }
    if(phone===myPhone&&!active){ showToast('내 계정은 퇴사 처리할 수 없어요.'); return; }
    var dup=(window.STAFF_ALL||[]).filter(function(x){ return x.id!==editingStaffId&&x.active!==false&&digits(x.phone)===phone; })[0];
    if(dup){ showToast('이미 '+dup.name+'님이 쓰는 번호예요.'); return; }
    var old=editingStaffId?(window.STAFF_ALL||[]).filter(function(x){ return x.id===editingStaffId; })[0]:null;
    var wasAdmin=roles[phone]==='admin';
    if(wantAdmin&&!wasAdmin&&!confirm(name+'님에게 관리자 권한을 줄까요?\n계약 수정·삭제, 직원 관리, 모든 일정·차량 예약 수정이 가능해져요.')) return;
    var maxOrder=(window.STAFF_ALL||[]).reduce(function(m,x){ return Math.max(m,x.order||0); },0);
    var team=form.fs?(parseInt(document.getElementById('sf-team').value)||0):0;
    var c=form.color||pickColor(editingStaffId);
    var data={
      name:name, title:document.getElementById('sf-jobtitle').value.trim(),
      group:form.group, team:team, lead:team?document.getElementById('sf-lead').checked:false, phone:phone,
      order:old?(old.order||maxOrder+1):maxOrder+1, active:active,
      color:c.color, bg:c.bg, border:c.border, apps:apps
    };
    try{
      await saveStaff(editingStaffId,data);
      var msg='저장되었습니다.';
      // 번호를 바꿨으면 예전 번호의 로그인은 막음
      var oldPhone=old?digits(old.phone):'';
      if(oldPhone&&oldPhone!==phone&&oldPhone!==myPhone){ await removeAllowedUser(oldPhone); delete roles[oldPhone]; }
      if(!active){
        // 퇴사·비활성 → 로그인 막기 (다시 재직 중으로 켜면 로그인 가능)
        if(roles[phone]){ await removeAllowedUser(phone); delete roles[phone]; msg='저장 + 퇴사 처리: 이제 로그인할 수 없어요.'; }
      } else {
        var role=wantAdmin?'admin':'staff';
        var r=await ensureAllowedUser(phone,name,apps,role);
        roles[phone]=role;
        if(r==='created') msg='저장 + 로그인 번호 등록 완료. 본인이 앱에서 비밀번호를 만들면 돼요.';
        else if(wantAdmin!==wasAdmin) msg=wantAdmin?'저장 + 관리자 권한을 줬어요.':'저장 + 관리자 권한을 해제했어요.';
      }
      openGroups[form.group]=true;
      showToast(msg); closeStaffModal(); window.renderStaffAdmin();
    }catch(e){ console.error(e); showToast('저장 실패: '+(e.message||'')); }
  };
  window.deleteStaffForm=async function(){
    if(!editingStaffId) return;
    var s=(window.STAFF_ALL||[]).filter(function(x){ return x.id===editingStaffId; })[0], p=s?digits(s.phone):'';
    if(p&&p===myPhoneNow()){ showToast('내 계정은 삭제할 수 없어요.'); return; }
    if(!confirm('이 직원을 명단에서 완전히 삭제할까요?\n로그인도 같이 막혀요.\n(퇴사자는 삭제보다 "재직 중" 체크를 끄는 걸 권장해요 — 과거 일정의 이름·색이 유지됩니다)')) return;
    try{ if(p){ await removeAllowedUser(p); delete roles[p]; } await deleteStaff(editingStaffId); showToast('삭제되었습니다. 로그인도 막혔어요.'); closeStaffModal(); }
    catch(e){ console.error(e); showToast('삭제 실패: '+(e.message||'')); }
  };
}
