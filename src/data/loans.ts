import type { LoanMode, LoanRecord, RateUnit, RepayInterval, RepayMethod } from '../types';
import { STORAGE_KEY_LOANS } from '../constants';
import { uid } from './storage';
import { todayStr } from '../utils/date';

const METHODS: RepayMethod[] = [
  'equal_installment',
  'equal_principal',
  'interest_first',
  'bullet',
];
const RATE_UNITS: RateUnit[] = ['year', 'month', 'day', 'total'];
const INTERVALS: RepayInterval[] = ['month', 'quarter', 'halfyear', 'year', 'biweek'];

function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** 校验并归一化外部来源（localStorage / 导入文件）的一笔贷款 */
export function normalizeLoanRecord(raw: Record<string, unknown>): LoanRecord | null {
  const principal = Math.max(0, Number(raw.principal) || 0);
  if (principal <= 0) return null;
  const periods = Math.floor(Number(raw.periods) || 0);
  if (periods <= 0 || periods > 600) return null;

  const method: RepayMethod = METHODS.includes(raw.method as RepayMethod)
    ? (raw.method as RepayMethod)
    : 'equal_installment';
  const rateUnit: RateUnit = RATE_UNITS.includes(raw.rateUnit as RateUnit)
    ? (raw.rateUnit as RateUnit)
    : 'year';
  const interval: RepayInterval = INTERVALS.includes(raw.interval as RepayInterval)
    ? (raw.interval as RepayInterval)
    : 'month';

  // 存量贷款：本金语义为「当前剩余本金」，期数为「剩余期数」，已还期数仅用于进度
  const mode: LoanMode = raw.mode === 'existing' ? 'existing' : 'new';
  const priorPaid =
    mode === 'existing'
      ? Math.min(1200, Math.max(0, Math.floor(Number(raw.paidPeriods) || 0)))
      : 0;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name: String(raw.name ?? '未命名贷款').slice(0, 40),
    principal,
    mode,
    paidPeriods: mode === 'existing' ? priorPaid : undefined,
    method,
    rateUnit,
    rateValue: Math.max(0, Number(raw.rateValue) || 0),
    interval,
    periods,
    firstPaymentDate: isDateStr(raw.firstPaymentDate) ? raw.firstPaymentDate : todayStr(),
    note: String(raw.note ?? '').slice(0, 200),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

/** 从 localStorage 加载贷款列表（容错：任何异常都返回空列表） */
export function loadLoans(): LoanRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOANS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { loans?: unknown } | unknown[];
    const list = Array.isArray(parsed) ? parsed : (parsed as { loans?: unknown })?.loans;
    if (!Array.isArray(list)) return [];
    return list
      .map((x) => normalizeLoanRecord(x as Record<string, unknown>))
      .filter((x): x is LoanRecord => x !== null);
  } catch (e) {
    console.warn('读取贷款数据失败：', e);
    return [];
  }
}

/** 保存贷款列表（失败时返回 false，调用方据此提示） */
export function saveLoans(loans: LoanRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify({ loans }));
    return true;
  } catch (e) {
    console.warn('保存贷款数据失败：', e);
    return false;
  }
}
