/** 金额格式化：超过 1 万用「万」单位，否则千分位 */
export function fmtMoney(n: number): string {
  if (n >= 10000) {
    const w = n / 10000;
    const digits = w >= 100 ? 0 : w >= 10 ? 1 : 2;
    return '¥' + w.toFixed(digits) + '万';
  }
  const digits = Number.isInteger(n) ? 0 : 2;
  return (
    '¥' +
    n.toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

/** 日成本格式化：根据量级自动选择精度 */
export function fmtCost(n: number): string {
  if (!n) return '¥0';
  if (n >= 100) return '¥' + n.toFixed(0);
  if (n >= 0.1) return '¥' + n.toFixed(2);
  if (n >= 0.01) return '¥' + n.toFixed(3);
  return '¥' + n.toFixed(4);
}

/** 天数格式化：超过一年按「X 年 Y 天」展示 */
export function fmtDays(n: number): string {
  if (n >= 365) {
    const y = Math.floor(n / 365);
    const rest = n % 365;
    return rest > 0 ? `${y} 年 ${rest} 天` : `${y} 年`;
  }
  return `${n} 天`;
}
