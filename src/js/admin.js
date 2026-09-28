// admin.js — 관리자 기능 (엑셀/백업/동기화)
import { fetchAllForBackup, updateContract, saveStaff, deleteStaff, importStaff, ensureAllowedUser } from './db.js';
import { DEFAULT_STAFF, COLOR_PALETTE, fullName } from './staff.js';
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
  var editingStaffId=null;
  window.renderStaffAdmin=function(){
    var el=document.getElementById('staff-admin-list'); if(!el) return;
        var all=(window.STAFF_ALL||[]).filter(function(s){ return !!s.id; });
    if(!all.length){
      el.innerHTML='<div class="staff-empty">직원 명단이 아직 앱에 없어요. 코드에 있던 기존 명단('+DEFAULT_STAFF.filter(function(s){ return s.active!==false; }).length+'명)을 가져오면 시작됩니다.</div>'+
        '<button class="btn primary" onclick="importDefaultStaff()"><i class="ti ti-download"></i> 기존 직원 가져오기</button>';
      return;
    }
    var active=all.filter(function(s){ return s.active!==false; }), retired=all.filter(function(s){ return s.active===false; });
    function row(s){
      return '<div class="staff-row'+(s.active===false?' retired':'')+'" onclick="openStaffModal(\''+s.id+'\')">'+
        '<span class="staff-swatch" style="background:'+esc(s.bg||'#f0f0ec')+';border-color:'+esc(s.border||'#ccc')+';color:'+esc(s.color||'#444')+'">'+esc(s.name.slice(0,1))+'</span>'+
        '<span class="staff-name">'+esc(fullName(s))+'</span>'+
        '<span class="staff-meta">'+esc(s.group||'운영')+'팀'+(s.team?' · '+s.team+'팀'+(s.lead?' 팀장':''):'')+(s.phone?' · '+esc(s.phone):'')+'</span>'+
        '<i class="ti ti-chevron-right"></i></div>';
    }
    el.innerHTML='<div class="staff-list">'+active.map(row).join('')+'</div>'+
      (retired.length?'<div class="staff-sub">퇴사 · 비활성 '+retired.length+'명</div><div class="staff-list">'+retired.map(row).join('')+'</div>':'')+
      '<div class="staff-hint">순서 숫자가 작을수록 앞에 표시돼요. 퇴사 처리하면 선택 목록에서 빠지지만 과거 일정의 이름·색은 유지됩니다.</div>';
  };
  window.importDefaultStaff=async function(){
    if(!confirm('코드에 있던 직원 명단을 앱으로 가져올까요? (한 번만 하면 됩니다)')) return;
    try{ await importStaff(DEFAULT_STAFF); showToast('직원 명단을 가져왔어요.'); }
    catch(e){ console.error(e); showToast('가져오기 실패: '+(e.message||'')); }
  };
  window.openStaffModal=function(id){
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
    document.getElementById('sf-order').value=s?(s.order||''):((window.STAFF_ALL||[]).length+1);
    document.getElementById('sf-active').checked=s?s.active!==false:true;
    var pal=document.getElementById('sf-palette');
    var cur=s&&s.color?s.color:COLOR_PALETTE[(window.STAFF_ALL||[]).length%COLOR_PALETTE.length].color;
    pal.innerHTML=COLOR_PALETTE.map(function(c){ return '<span class="sf-sw'+(c.color===cur?' on':'')+'" data-color="'+c.color+'" data-bg="'+c.bg+'" data-border="'+c.border+'" style="background:'+c.bg+';border-color:'+c.border+';color:'+c.color+'" onclick="pickStaffColor(this)">가</span>'; }).join('');
    if(s&&s.color&&!COLOR_PALETTE.some(function(c){ return c.color===s.color; })) pal.innerHTML+='<span class="sf-sw on" data-color="'+esc(s.color)+'" data-bg="'+esc(s.bg||'#f0f0ec')+'" data-border="'+esc(s.border||'#ccc')+'" style="background:'+esc(s.bg||'#f0f0ec')+';border-color:'+esc(s.border||'#ccc')+';color:'+esc(s.color)+'" onclick="pickStaffColor(this)">가</span>';
    document.getElementById('sf-delete').style.display=s?'':'none';
    ov.classList.add('open');
    if(window.pushModalState) window.pushModalState();
  };
  window.pickStaffColor=function(el){ document.querySelectorAll('#sf-palette .sf-sw').forEach(function(x){ x.classList.remove('on'); }); el.classList.add('on'); };
  window.closeStaffModal=function(){ var ov=document.getElementById('staff-modal'); if(ov) ov.classList.remove('open'); };
  window.saveStaffForm=async function(){
    var name=document.getElementById('sf-name').value.trim();
    if(!name){ showToast('이름을 입력해주세요.'); return; }
    var sw=document.querySelector('#sf-palette .sf-sw.on')||document.querySelector('#sf-palette .sf-sw');
    var phone=document.getElementById('sf-phone').value.replace(/[^0-9]/g,'');
    var data={
      name:name, title:document.getElementById('sf-jobtitle').value.trim(),
      group:document.getElementById('sf-group').value, team:parseInt(document.getElementById('sf-team').value)||0,
      lead:document.getElementById('sf-lead').checked, phone:phone,
      order:parseInt(document.getElementById('sf-order').value)||99, active:document.getElementById('sf-active').checked,
      color:sw.getAttribute('data-color'), bg:sw.getAttribute('data-bg'), border:sw.getAttribute('data-border')
    };
    try{
      await saveStaff(editingStaffId,data);
      var msg='저장되었습니다.';
      if(phone&&data.active){ var r=await ensureAllowedUser(phone,name); if(r==='created') msg='저장 + 로그인 번호 등록 완료. 본인이 앱에서 비밀번호를 만들면 돼요.'; }
      showToast(msg); closeStaffModal();
    }catch(e){ console.error(e); showToast('저장 실패: '+(e.message||'')); }
  };
  window.deleteStaffForm=async function(){
    if(!editingStaffId) return;
    if(!confirm('이 직원을 명단에서 완전히 삭제할까요?\n(퇴사자는 삭제보다 "재직 중" 체크를 끄는 걸 권장해요 — 과거 일정의 이름·색이 유지됩니다)')) return;
    try{ await deleteStaff(editingStaffId); showToast('삭제되었습니다.'); closeStaffModal(); }
    catch(e){ console.error(e); showToast('삭제 실패: '+(e.message||'')); }
  };
}
