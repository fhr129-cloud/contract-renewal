// admin.js — 관리자 기능 (엑셀/백업/동기화)
import { fetchAllForBackup, updateContract, saveStaff, deleteStaff, importStaff, ensureAllowedUser, removeAllowedUser, listAllowedRoles, saveStaffOrder, auth } from './db.js';
import { DEFAULT_STAFF, COLOR_PALETTE, fullName, hasApp } from './staff.js';
import { calcStatus, STATUS_META, fmtDate, dDiff, priceLabel } from './utils.js';

export function initAdmin(ctx){
  // ctx: { getContracts, getHistory, showToast, mealsDisplay }
  var showToast=ctx.showToast;

  window.exportExcel=function(){
    if(!window.XLSX){ showToast('잠시 후 다시 시도해 주세요.'); return; }
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
    } catch(e){ showToast('백업 실패: '+(e.message||'')); }
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
  var editingStaffId=null, roles={}, rolesLoaded=false, sortable=null, orderMode=false;
  function myPhoneNow(){ return auth.currentUser&&auth.currentUser.email?auth.currentUser.email.split('@')[0]:''; }
  function loadRoles(){
    listAllowedRoles().then(function(m){ roles=m; rolesLoaded=true; cleanupRetired(); window.renderStaffAdmin(); })
      .catch(function(e){ console.warn('권한 목록을 못 읽었어요',e); });
  }
  function digits(p){ return String(p||'').replace(/[^0-9]/g,''); }
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
    function row(s,drag){
      var isAdm=s.phone&&roles[String(s.phone).replace(/[^0-9]/g,'')]==='admin';
      return '<div class="staff-row'+(s.active===false?' retired':'')+'" data-id="'+s.id+'">'+
        (drag&&orderMode?'<span class="staff-grip" title="끌어서 순서 바꾸기"><i class="ti ti-grip-vertical"></i></span>':'')+
        '<span class="staff-swatch" style="background:'+esc(s.bg||'#f0f0ec')+';border-color:'+esc(s.border||'#ccc')+';color:'+esc(s.color||'#444')+'">'+esc(s.name.slice(0,1))+'</span>'+
        '<span class="staff-name">'+esc(fullName(s))+(isAdm?' <b class="staff-admin">관리자</b>':'')+'</span>'+
        '<span class="staff-meta">'+(hasApp(s,'fs')
            ? esc(s.group||'운영')+'팀'+(s.team?' · '+s.team+'팀'+(s.lead?' 팀장':''):'')+(hasApp(s,'car')?'':' · FS만')
            : '<b class="staff-caronly">차량만</b>'+(s.dept?' · '+esc(s.dept):''))+(s.phone?' · '+esc(s.phone):'')+'</span>'+
        (orderMode&&drag?'':'<button class="btn sm" onclick="openStaffModal(\''+s.id+'\')"><i class="ti ti-pencil"></i> 수정</button>')+'</div>';
    }
    el.innerHTML='<div class="staff-order-bar'+(orderMode?' on':'')+'">'+(orderMode
        ?'<span><i class="ti ti-arrows-sort"></i> 손잡이(⋮⋮)를 끌어서 순서를 바꾸세요. 바꾸면 바로 저장돼요.</span><button class="btn sm primary" onclick="toggleStaffOrder()">완료</button>'
        :'<span>재직 '+active.length+'명</span><button class="btn sm" onclick="toggleStaffOrder()"><i class="ti ti-arrows-sort"></i> 순서 바꾸기</button>')+'</div>'+
      '<div class="staff-list'+(orderMode?' ordering':'')+'" id="staff-sort">'+active.map(function(s){ return row(s,true); }).join('')+'</div>'+
      (orderMode?'':(retired.length?'<details class="staff-retired"><summary>퇴사 · 비활성 '+retired.length+'명</summary><div class="staff-list">'+retired.map(function(s){ return row(s,false); }).join('')+'</div></details>':'')+
      '<div class="staff-hint">이 순서대로 일정 담당자 목록에 나와요. 퇴사 처리하면 선택 목록에서 빠지지만 과거 일정의 이름·색은 유지됩니다.</div>');
    // 드래그로 순서 바꾸기 (휴대폰 터치도 됨)
    if(sortable){ try{ sortable.destroy(); }catch(e){} sortable=null; }
    var box=document.getElementById('staff-sort');
    if(orderMode&&box&&window.Sortable){
      // 휴대폰에선 손잡이를 0.2초 누르고 있어야 움직임 (스크롤하다 실수로 바뀌지 않게)
      sortable=window.Sortable.create(box,{ handle:'.staff-grip', animation:150, ghostClass:'staff-ghost', delay:200, delayOnTouchOnly:true, touchStartThreshold:6,
        onEnd:function(){
          var ids=[].map.call(box.querySelectorAll('.staff-row'),function(r){ return r.getAttribute('data-id'); });
          // 퇴사자는 재직자 뒤로
          retired.forEach(function(s){ ids.push(s.id); });
          saveStaffOrder(ids).then(function(){ showToast('순서를 저장했어요.'); })
            .catch(function(e){ console.error(e); showToast('순서 저장 실패: '+(e.message||'')); });
        }});
    }
  };
  window.toggleStaffOrder=function(){ orderMode=!orderMode; window.renderStaffAdmin(); };
  window.importDefaultStaff=async function(){
    if(!confirm('코드에 있던 직원 명단을 앱으로 가져올까요? (한 번만 하면 됩니다)')) return;
    try{ await importStaff(DEFAULT_STAFF); showToast('직원 명단을 가져왔어요.'); }
    catch(e){ console.error(e); showToast('가져오기 실패: '+(e.message||'')); }
  };
  window.openStaffModal=async function(id){
    if(!rolesLoaded){ try{ roles=await listAllowedRoles(); rolesLoaded=true; }catch(e){ showToast('권한 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'); return; } }
    var s=id?(window.STAFF_ALL||[]).filter(function(x){ return x.id===id; })[0]:null;
    editingStaffId=s?s.id:null;
    var ov=document.getElementById('staff-modal'); if(!ov) return;
    document.getElementById('sf-title').textContent=s?'직원 수정':'직원 추가';
    document.getElementById('sf-name').value=s?s.name:'';
    document.getElementById('sf-jobtitle').value=s?s.title||'':'';
    document.getElementById('sf-group').value=s?(s.group||'운영'):'운영';
    document.getElementById('sf-team').value=s?String(s.team||0):'0';
    document.getElementById('sf-lead').checked=!!(s&&s.lead);
    document.getElementById('sf-phone').value=s?(s.phone||''):'';
    document.getElementById('sf-active').checked=s?s.active!==false:true;
    document.getElementById('sf-app-fs').checked=hasApp(s,'fs');
    document.getElementById('sf-app-car').checked=hasApp(s,'car');
    document.getElementById('sf-dept').value=s?(s.dept||''):'';
    var p=s&&s.phone?String(s.phone).replace(/[^0-9]/g,''):'';
    document.getElementById('sf-admin').checked=!!(p&&roles[p]==='admin');
    syncStaffAppUI();
    var pal=document.getElementById('sf-palette');
    var cur=s&&s.color?s.color:COLOR_PALETTE[(window.STAFF_ALL||[]).length%COLOR_PALETTE.length].color;
    pal.innerHTML=COLOR_PALETTE.map(function(c){ return '<span class="sf-sw'+(c.color===cur?' on':'')+'" data-color="'+c.color+'" data-bg="'+c.bg+'" data-border="'+c.border+'" style="background:'+c.bg+';border-color:'+c.border+';color:'+c.color+'" onclick="pickStaffColor(this)">가</span>'; }).join('');
    if(s&&s.color&&!COLOR_PALETTE.some(function(c){ return c.color===s.color; })) pal.innerHTML+='<span class="sf-sw on" data-color="'+esc(s.color)+'" data-bg="'+esc(s.bg||'#f0f0ec')+'" data-border="'+esc(s.border||'#ccc')+'" style="background:'+esc(s.bg||'#f0f0ec')+';border-color:'+esc(s.border||'#ccc')+';color:'+esc(s.color)+'" onclick="pickStaffColor(this)">가</span>';
    document.getElementById('sf-delete').style.display=s?'':'none';
    ov.classList.add('open');
    if(window.pushModalState) window.pushModalState();
  };
  // FS를 안 쓰는 직원이면 팀·팀장 칸 대신 부서 칸을 보여줌
  window.syncStaffAppUI=function(){
    var fs=document.getElementById('sf-app-fs').checked;
    document.querySelectorAll('.sf-fs-only').forEach(function(el){ el.style.display=fs?'':'none'; });
    document.getElementById('sf-dept-wrap').style.display=fs?'none':'';
  };
  window.pickStaffColor=function(el){ document.querySelectorAll('#sf-palette .sf-sw').forEach(function(x){ x.classList.remove('on'); }); el.classList.add('on'); };
  window.closeStaffModal=function(){ var ov=document.getElementById('staff-modal'); if(ov) ov.classList.remove('open'); };
  window.saveStaffForm=async function(){
    var name=document.getElementById('sf-name').value.trim();
    if(!name){ showToast('이름을 입력해주세요.'); return; }
    var sw=document.querySelector('#sf-palette .sf-sw.on')||document.querySelector('#sf-palette .sf-sw');
    var phone=document.getElementById('sf-phone').value.replace(/[^0-9]/g,'');
    var apps=[]; if(document.getElementById('sf-app-fs').checked) apps.push('fs'); if(document.getElementById('sf-app-car').checked) apps.push('car');
    var wantAdmin=document.getElementById('sf-admin').checked;
    if(!apps.length){ showToast('사용 앱을 하나 이상 골라주세요.'); return; }
    var myPhone=myPhoneNow();
    if(phone&&phone===myPhone&&apps.indexOf('fs')<0){ showToast('내 계정의 FS 권한은 끌 수 없어요.'); return; }
    if(phone&&phone===myPhone&&!wantAdmin){ showToast('내 계정의 관리자 권한은 끌 수 없어요.'); return; }
    if(phone&&phone===myPhone&&!document.getElementById('sf-active').checked){ showToast('내 계정은 퇴사 처리할 수 없어요.'); return; }
    if(apps.indexOf('fs')<0&&!phone){ showToast('차량만 쓰는 직원은 휴대폰 번호가 꼭 필요해요 (로그인용).'); return; }
    if(wantAdmin&&!phone){ showToast('관리자 권한을 주려면 휴대폰 번호가 필요해요.'); return; }
    var old=editingStaffId?(window.STAFF_ALL||[]).filter(function(x){ return x.id===editingStaffId; })[0]:null;
    var wasAdmin=!!(phone&&roles[phone]==='admin');
    if(wantAdmin&&!wasAdmin&&!confirm(name+'님에게 관리자 권한을 줄까요?\n계약 수정·삭제, 직원 관리, 모든 일정·차량 예약 수정이 가능해져요.')) return;
    var maxOrder=(window.STAFF_ALL||[]).reduce(function(m,x){ return Math.max(m,x.order||0); },0);
    var data={
      name:name, title:document.getElementById('sf-jobtitle').value.trim(),
      group:document.getElementById('sf-group').value, team:parseInt(document.getElementById('sf-team').value)||0,
      lead:document.getElementById('sf-lead').checked, phone:phone,
      order:old?(old.order||maxOrder+1):maxOrder+1, active:document.getElementById('sf-active').checked,
      color:sw.getAttribute('data-color'), bg:sw.getAttribute('data-bg'), border:sw.getAttribute('data-border'),
      apps:apps, dept:document.getElementById('sf-dept').value.trim()
    };
    try{
      await saveStaff(editingStaffId,data);
      var msg='저장되었습니다.';
      // 번호를 바꿨으면 예전 번호의 로그인은 막음
      var oldPhone=old?digits(old.phone):'';
      if(oldPhone&&oldPhone!==phone&&oldPhone!==myPhone){ await removeAllowedUser(oldPhone); delete roles[oldPhone]; }
      if(phone&&!data.active){
        // 퇴사·비활성 → 로그인 막기 (다시 재직 중으로 켜면 로그인 가능)
        if(roles[phone]||!rolesLoaded){ await removeAllowedUser(phone); delete roles[phone]; msg='저장 + 퇴사 처리: 이제 로그인할 수 없어요.'; }
      }
      if(phone&&data.active){
        var role=wantAdmin?'admin':'staff';
        var r=await ensureAllowedUser(phone,name,apps,role);
        roles[phone]=role;
        if(r==='created') msg='저장 + 로그인 번호 등록 완료. 본인이 앱에서 비밀번호를 만들면 돼요.';
        else if(wantAdmin!==wasAdmin) msg=wantAdmin?'저장 + 관리자 권한을 줬어요.':'저장 + 관리자 권한을 해제했어요.';
      }
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
