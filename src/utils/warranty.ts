import type { WarrantyCalc } from '../types';
import { addMonths, daysBetween, parseDate, toDateStr } from './date';

/**
 * 保修状态计算（纯函数，按真实时间推进）。
 * 到期日 = 购买日期 + 保修月数；剩余 30 天内视为"即将到期"。
 */
export function calcWarranty(purchaseDate: string, months: number, today: Date): WarrantyCalc {
  const end = addMonths(parseDate(purchaseDate), months);
  const daysLeft = daysBetween(today, end);
  const status: WarrantyCalc['status'] =
    daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring' : 'active';
  return { endDate: toDateStr(end), daysLeft, status };
}
