export const DAY_MS = 24 * 60 * 60 * 1000;

/** 解析 'YYYY-MM-DD' 为本地日期（避免 UTC 时区偏移，window 与计算口径一致） */
export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 今天零点（本地时区） */
export function todayStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function toDateStr(dt: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** 两日期相差的整天数（end - start），四舍五入到天，避免夏令时误差 */
export function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/** 日期加 n 个月（自动处理月末边界，如 1/31 + 1月 = 2/28 或 2/29） */
export function addMonths(d: Date, n: number): Date {
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const target = new Date(year, month + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay));
}
