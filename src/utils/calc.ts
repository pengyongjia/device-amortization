import type { Device, DeviceCalc, DeviceStatus } from '../types';
import { daysBetween, parseDate, todayStart } from './date';
import { calcLoan } from './loan';
import { calcWarranty } from './warranty';

/** 是否已结束生命周期（天数冻结，不再随时间累加） */
export function isFinished(status: DeviceStatus): boolean {
  return status === 'sold' || status === 'retired' || status === 'gifted';
}

/**
 * 摊销计算核心（纯函数，全部实时推导）
 *
 * - 已使用天数：购买日到今天（含购买当天），每天自动 +1；已结束设备冻结在结束日期
 * - 日均成本：净花费 ÷ 已使用天数，用得越久越便宜
 * - 净花费：已出售时为 购买价 - 回血金额
 */
export function calcDevice(d: Device, today: Date = todayStart()): DeviceCalc {
  const purchase = parseDate(d.purchaseDate);
  const finished = isFinished(d.status);
  const rawRef = finished && d.endDate ? parseDate(d.endDate) : today;
  // 防御：结束日期早于购买日期时以购买当日为基准
  const refDate = rawRef < purchase ? purchase : rawRef;

  const usedDays = Math.max(1, daysBetween(purchase, refDate) + 1);
  const netCost = Math.max(0, d.price - (d.soldPrice ?? 0));
  const dailyCost = netCost / usedDays;
  const plannedDays = d.expectedYears ? Math.round(d.expectedYears * 365) : null;
  const progress = plannedDays ? usedDays / plannedDays : null;
  const targetDaily = plannedDays ? d.price / plannedDays : null;

  return {
    usedDays,
    netCost,
    dailyCost,
    plannedDays,
    progress,
    targetDaily,
    tomorrowCost: netCost / (usedDays + 1),
    monthlyCost: dailyCost * 30,
    finished,
    refDate,
    // 贷款按真实时间推进（即使设备已出售，债务仍在偿还中）
    loan: d.loan ? calcLoan(d.loan, today) : null,
    // 保修同样按真实时间计算（与设备状态无关）
    warranty: d.warrantyMonths ? calcWarranty(d.purchaseDate, d.warrantyMonths, today) : null,
  };
}
