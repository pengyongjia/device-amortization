import type { Device, DeviceCalc } from '../types';
import { daysBetween, parseDate, todayStart } from '../utils/date';
import { fmtCost } from '../utils/format';

interface Sample {
  days: number;
  cost: number;
  future: boolean;
}

/** 按月采样日均成本：每个自然月末一个点，未来按预计年限延伸 */
function buildSamples(device: Device, calc: DeviceCalc): Sample[] {
  const purchase = parseDate(device.purchaseDate);
  const samples: Sample[] = [];

  // 历史：购买月起，每个自然月末采样一次
  let cursor = new Date(purchase.getFullYear(), purchase.getMonth() + 1, 0);
  let guard = 0;
  while (guard++ < 240) {
    const days = Math.max(1, daysBetween(purchase, cursor) + 1);
    if (days > calc.usedDays) break;
    samples.push({ days, cost: calc.netCost / days, future: false });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0);
  }
  if (!samples.length || samples[samples.length - 1].days !== calc.usedDays) {
    samples.push({ days: calc.usedDays, cost: calc.dailyCost, future: false });
  }

  // 未来预测：仅未结束且设置了预计年限的设备
  if (!calc.finished && calc.plannedDays && calc.plannedDays > calc.usedDays) {
    const today = todayStart();
    let fc = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    let g2 = 0;
    while (g2++ < 120) {
      const days = Math.max(1, daysBetween(purchase, fc) + 1);
      if (days >= calc.plannedDays) break;
      samples.push({ days, cost: calc.netCost / days, future: true });
      fc = new Date(fc.getFullYear(), fc.getMonth() + 2, 0);
    }
    samples.push({ days: calc.plannedDays, cost: calc.netCost / calc.plannedDays, future: true });
  }

  return samples;
}

/** 等距抽样至 n 个点（保留首尾），用于压缩过长的未来预测序列 */
function compressSamples<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  if (n <= 1) return [arr[arr.length - 1]];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  }
  return out;
}

/** 成本曲线：月度采样的日均成本柱状图（浅色柱为未来预测，虚线为目标日均） */
export function CostBars({ device, calc }: { device: Device; calc: DeviceCalc }) {
  const W = 300;
  const H = 110;
  const PAD = 10;
  const BASE = 90;

  // 采样窗口：优先保留最近的历史点，未来预测压缩为至多 4 个点，避免历史被挤出
  const all = buildSamples(device, calc);
  const historic = all.filter((s) => !s.future).slice(-14);
  const future = compressSamples(all.filter((s) => s.future), 4);
  const shown = [...historic, ...future];
  const n = shown.length;
  const maxC = Math.max(...shown.map((s) => s.cost), 0.0001);
  const gap = 3;
  const bw = Math.max(3, (W - PAD * 2 - gap * (n - 1)) / n);

  const bars = shown.map((s, i) => {
    const h = Math.max(2, (s.cost / maxC) * (BASE - 26));
    const x = PAD + i * (bw + gap);
    const y = BASE - h;
    const fill = s.future ? '#cdd6e0' : '#0a2540';
    const op = s.future ? 0.6 : 0.55 + (0.45 * (i + 1)) / n;
    return (
      <rect
        key={i}
        x={x.toFixed(1)}
        y={y.toFixed(1)}
        width={bw.toFixed(1)}
        height={h.toFixed(1)}
        rx="2.5"
        fill={fill}
        opacity={op}
      >
        <title>{`第 ${s.days} 天 · ${fmtCost(s.cost)}/天${s.future ? '（预测）' : ''}`}</title>
      </rect>
    );
  });

  const targetLine =
    calc.targetDaily && calc.targetDaily <= maxC ? (
      <line
        x1={PAD}
        y1={BASE - (calc.targetDaily / maxC) * (BASE - 26)}
        x2={W - PAD}
        y2={BASE - (calc.targetDaily / maxC) * (BASE - 26)}
        stroke="#c47f17"
        strokeWidth="1"
        strokeDasharray="4 3"
      >
        <title>{`目标日均 ${fmtCost(calc.targetDaily)}`}</title>
      </line>
    ) : null;

  return (
    <svg className="dc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {bars}
      {targetLine}
      <line x1={PAD} y1={BASE} x2={W - PAD} y2={BASE} stroke="#e5e9ef" strokeWidth="1" />
      <text x={PAD} y={BASE + 14} fontSize="9" fill="#9aa8ba">
        购买时
      </text>
      <text x={W - PAD} y={BASE + 14} fontSize="9" fill="#9aa8ba" textAnchor="end">
        {calc.finished ? '结束时' : calc.plannedDays ? '预计年限' : '现在'}
      </text>
    </svg>
  );
}
