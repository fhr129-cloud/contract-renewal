// admin.js — 관리자 기능 (엑셀/백업/동기화)
import { fetchAllForBackup, updateContract } from './db.js';
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
  window.cleanupDupSeed=async function(){
    var contracts=ctx.getContracts();
    // 2026-09-02 18:40~18:50 사이 생성된 문서 찾기
    var targetStart=new Date('2026-09-02T18:40:00+09:00').getTime();
    var targetEnd=new Date('2026-09-02T18:50:00+09:00').getTime();
    var targets=contracts.filter(function(c){
      if(!c.createdAt) return false;
      var t=c.createdAt.seconds?c.createdAt.seconds*1000:new Date(c.createdAt).getTime();
      return t>=targetStart&&t<=targetEnd;
    });
    if(!targets.length){ showToast('해당 시간대 문서가 없어요.'); return; }
    if(!confirm(targets.length+'개 문서를 삭제할까요? (9/2 18:44 생성분)\n\n삭제 전 백업 버튼을 먼저 눌러주세요!')) return;
    var deleted=0;
    for(var i=0;i<targets.length;i++){
      await ctx.deleteContract(targets[i].id);
      deleted++;
    }
    showToast(deleted+'개 삭제 완료!');
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
}
