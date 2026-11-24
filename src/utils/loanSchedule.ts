import type {
  LoanRecord,
  LoanSchedule,
  LoansSummary,
  RateUnit,
  RepayInstallment,
  RepayInterval,
} from '../types';
import { DAY_MS, addMonths, parseDate, toDateStr, todayStart } from './date';

/** 每种还款间隔对应的月数（双周付按 14 天 ≈ 0.46 月折算到月供） */
const INTERVAL_MONTHS: Record<RepayInterval, number> = {
  month: 1,
  quarter: 3,
  halfyear: 6,
  year: 12,
  biweek: 14 / 30.4375,
};

/** 从首期日起，第 index 期（0-based）的还款日 */
function installmentDate(first: Date, index: number, interval: RepayInterval): Date {
  if (interval === 'biweek') {
    return new Date(first.getTime() + index * 14 * DAY_MS);
  }
  return addMonths(first, index * INTERVAL_MONTHS[interval]);
}

/**
 * 把用户输入的各种利率口径，统一换算成"月利率"（小数）。
 *
 * - year: 年利率 % → /12/100
 * - month: 月利率 % → /100
 * - day: 日利率 ‰（万分之几）→ 数值/10000 × 30.4375
 * - total: 直接指定总利息，无法换算成利率 → 返回 0（走固定利息分支）
 */
export function toMonthlyRate(rateUnit: RateUnit, rateValue: number): number {
  const v = Number(rateValue) || 0;
  switch (rateUnit) {
    case 'year':
      return v / 12 / 100;
    case 'month':
      return v / 100;
    case 'day':
      return (v / 10000) * 30.4375;
    case 'total':
      return 0;
  }
}

/** 每期利率：月利率 × 每期月数 */
function periodRate(monthlyRate: number, interval: RepayInterval): number {
  return monthlyRate * INTERVAL_MONTHS[interval];
}

/**
 * 生成等额本息每期还款额。
 * 公式：M = P × r × (1+r)^n / ((1+r)^n − 1)
 * r = 0 时退化为 P / n（无息分期）
 */
function annuityPayment(principal: number, rate: number, periods: number): number {
  if (periods <= 0) return 0;
  if (rate <= 0) return principal / periods;
  const pow = Math.pow(1 + rate, periods);
  return (principal * rate * pow) / (pow - 1);
}

/**
 * 计算一笔贷款的完整还款计划（纯函数，随"今天"推进到期状态）。
 *
 * 四种还款方式的摊还逻辑：
 * - equal_installment 等额本息：每期还款额固定，利息按剩余本金计，本金逐期递增
 * - equal_principal 等额本金：每期本金固定，利息按剩余本金递减，总还款逐期递减
 * - interest_first 先息后本：前 n-1 期只付利息，最后一期付 本金+当期利息
 * - bullet 一次性还本付息：仅最后一期，付 本金 + 全程利息（单利：P×r×n）
 *
 * total 利率口径（固定手续费）：把总利息平均摊到每一期，本金按等额本金归还。
 */
export function calcLoanSchedule(loan: LoanRecord, today: Date = todayStart()): LoanSchedule {
  const principal = Math.max(0, Number(loan.principal) || 0);
  const periods = Math.max(1, Math.floor(Number(loan.periods) || 1));
  const interval = loan.interval;
  const monthlyRate = toMonthlyRate(loan.rateUnit, loan.rateValue);
  const r = periodRate(monthlyRate, interval);
  const first = parseDate(loan.firstPaymentDate);
  const monthsPerPeriod = INTERVAL_MONTHS[interval];

  const installments: RepayInstallment[] = [];
  let balance = principal;
  let totalInterest = 0;

  // 固定总利息（total 口径）：每期利息 = 总利息 / 期数
  const fixedTotalInterest =
    loan.rateUnit === 'total' ? Math.max(0, Number(loan.rateValue) || 0) : null;
  const fixedInterestPerPeriod = fixedTotalInterest !== null ? fixedTotalInterest / periods : 0;

  // 等额本息的每期固定还款额
  const annuity = annuityPayment(principal, r, periods);

  for (let i = 0; i < periods; i++) {
    const date = installmentDate(first, i, interval);
    let interest = 0;
    let principalPart = 0;

    if (loan.method === 'equal_installment') {
      interest = fixedTotalInterest !== null ? fixedInterestPerPeriod : balance * r;
      principalPart = annuity - interest;
      // 末期校正浮点误差：本金一次结清
      if (i === periods - 1) principalPart = balance;
    } else if (loan.method === 'equal_principal') {
      principalPart = principal / periods;
      interest = fixedTotalInterest !== null ? fixedInterestPerPeriod : balance * r;
      if (i === periods - 1) principalPart = balance;
    } else if (loan.method === 'interest_first') {
      interest = fixedTotalInterest !== null ? fixedInterestPerPeriod : balance * r;
      principalPart = i === periods - 1 ? balance : 0;
    } else {
      // bullet：一次性还本付息，只有最后一期产生现金流
      if (i === periods - 1) {
        principalPart = balance;
        interest =
          fixedTotalInterest !== null ? fixedTotalInterest : principal * r * periods;
      }
    }

    // 数值清理：避免出现 -0 或极小负数
    if (Math.abs(interest) < 1e-9) interest = 0;
    if (Math.abs(principalPart) < 1e-9) principalPart = 0;
    const payment = Math.max(0, principalPart + interest);
    balance = Math.max(0, balance - principalPart);
    totalInterest += interest;

    installments.push({
      index: i + 1,
      date: toDateStr(date),
      payment: round2(payment),
      principal: round2(principalPart),
      interest: round2(interest),
      balance: round2(balance),
      due: date.getTime() <= today.getTime(),
    });
  }

  const paid = installments.filter((x) => x.due);
  const paidAmount = sum(paid.map((x) => x.payment));
  const paidInterest = sum(paid.map((x) => x.interest));
  const paidPeriods = paid.length;
  const settled = paidPeriods >= periods;
  // 剩余本金 = 还完「截至今天已到期」的最后一期之后的余额。
  // 注意不能用循环结束后的 balance：那是整份计划跑完的余额，恒为 0。
  const remainingPrincipal = round2(
    paidPeriods > 0 ? installments[paidPeriods - 1].balance : principal,
  );
  const remainingAmount = round2(
    sum(installments.filter((x) => !x.due).map((x) => x.payment)),
  );
  const next = installments.find((x) => !x.due);
  const periodPayment = installments[0]?.payment ?? 0;

  // "每月需还"用 本息合计 ÷ 总月数 折算平均值。
  // 不能用首期金额：先息后本末期还大额本金、一次性还本付息前期为 0，首期都不具代表性。
  const totalMonths = monthsPerPeriod * periods;
  const monthlyPayment = totalMonths > 0 ? (principal + totalInterest) / totalMonths : 0;

  return {
    monthlyRate,
    periodPayment,
    monthlyPayment: round2(monthlyPayment),
    totalInterest: round2(totalInterest),
    totalPayment: round2(principal + totalInterest),
    paidPeriods,
    paidAmount: round2(paidAmount),
    paidInterest: round2(paidInterest),
    remainingPrincipal,
    remainingAmount,
    progress: principal > 0 ? clamp01((principal - remainingPrincipal) / principal) : 1,
    nextPaymentDate: next?.date ?? null,
    settled,
    installments,
  };
}

/** 汇总多笔贷款 */
export function summarizeLoans(
  loans: LoanRecord[],
  schedules: LoanSchedule[],
): LoansSummary {
  let monthlyPayment = 0;
  let remainingPrincipal = 0;
  let paidAmount = 0;
  let paidInterest = 0;
  let activeCount = 0;
  let nextUp: LoansSummary['nextUp'] = null;

  schedules.forEach((s, i) => {
    if (!s.settled) {
      monthlyPayment += s.monthlyPayment;
      remainingPrincipal += s.remainingPrincipal;
      activeCount += 1;
    }
    paidAmount += s.paidAmount;
    paidInterest += s.paidInterest;

    if (s.nextPaymentDate) {
      if (!nextUp || s.nextPaymentDate < nextUp.date) {
        nextUp = {
          name: loans[i]?.name ?? '贷款',
          date: s.nextPaymentDate,
          amount: s.installments.find((x) => x.date === s.nextPaymentDate)?.payment ?? s.periodPayment,
        };
      }
    }
  });

  return {
    monthlyPayment: round2(monthlyPayment),
    remainingPrincipal: round2(remainingPrincipal),
    paidAmount: round2(paidAmount),
    paidInterest: round2(paidInterest),
    activeCount,
    nextUp,
  };
}

/** 还款方式的中文标签 */
export const REPAY_METHOD_LABEL: Record<LoanRecord['method'], string> = {
  equal_installment: '等额本息',
  equal_principal: '等额本金',
  interest_first: '先息后本',
  bullet: '到期一次性还本付息',
};

/** 利率口径的中文标签 */
export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  year: '年利率 %',
  month: '月利率 %',
  day: '日利率 ‰',
  total: '总利息/手续费 ¥',
};

/** 还款间隔的中文标签 */
export const INTERVAL_LABEL: Record<RepayInterval, string> = {
  month: '每月',
  quarter: '每季度',
  halfyear: '每半年',
  year: '每年',
  biweek: '每两周',
};

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
