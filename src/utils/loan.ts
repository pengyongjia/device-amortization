import type { LoanCalc, LoanInfo } from '../types';
import { addMonths, parseDate, toDateStr } from './date';

/**
 * 贷款还款计算（纯函数，随"今天"自动推进）
 *
 * - 月供 = 贷款本金 ÷ 期数（等额本金简化模型）
 * - 已还期数：从首期还款日起，数到"今天"为止已经到达的还款日
 * - 剩余待还 = 本金 - 已还金额
 */
export function calcLoan(loan: LoanInfo, today: Date): LoanCalc {
  const first = parseDate(loan.firstPaymentDate);
  const monthlyPayment = loan.months > 0 ? loan.principal / loan.months : 0;

  // 数已到达的还款日（防御性上限 600 期 = 50 年）
  let paidPeriods = 0;
  let guard = 0;
  while (guard++ < 600 && paidPeriods < loan.months) {
    const dueDate = addMonths(first, paidPeriods);
    if (dueDate > today) break;
    paidPeriods++;
  }

  const paidAmount = Math.min(paidPeriods * monthlyPayment, loan.principal);
  const remaining = Math.max(0, loan.principal - paidAmount);
  const settled = paidPeriods >= loan.months;
  const nextDue = settled ? null : addMonths(first, paidPeriods);

  return {
    monthlyPayment,
    months: loan.months,
    paidPeriods,
    paidAmount,
    remaining,
    progress: loan.principal > 0 ? paidAmount / loan.principal : 1,
    nextPaymentDate: nextDue ? toDateStr(nextDue) : null,
    settled,
    totalCost: loan.downPayment + loan.principal,
  };
}
