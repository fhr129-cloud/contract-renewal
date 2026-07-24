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

/* ─── 여기까지 ─── */
}
