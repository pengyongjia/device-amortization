import { useMemo } from 'react';
import type { DeviceWithCalc } from '../types';
import { calcDevice } from '../utils/calc';
import { fmtCost, fmtMoney } from '../utils/format';
import { Icon } from './Icon';

interface HeroCardProps {
  list: DeviceWithCalc[];
  today: Date;
}

/** 主卡：当前总日均成本（大数字）+ 月/年折算 + 近 30 天趋势线 + "每天还在变便宜"洞察 */
export function HeroCard({ list, today }: HeroCardProps) {
  const active = list.filter(
    (x) => x.device.status === 'in_use' || x.device.status === 'idle',
  );
  const dailySum = active.reduce((s, x) => s + x.calc.dailyCost, 0);

  // 近 30 天的"总日均成本"趋势（摊销随时间自然下降），并推导省钱洞察
  const { trend, savedPerDay, savedPercent } = useMemo(() => {
    const days = 30;
    const values: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      values.push(active.reduce((s, x) => s + calcDevice(x.device, d).dailyCost, 0));
    }
    const prev = values[0] ?? 0;
    const now = values[values.length - 1] ?? 0;
    return {
      trend: values,
      savedPerDay: Math.max(0, prev - now),
      savedPercent: prev > 0 ? ((prev - now) / prev) * 100 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, today]);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-ink px-5 py-5 text-white sm:px-8 sm:py-7">
      {/* 背景装饰：柔和光晕 */}
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/[0.05] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-40 h-72 w-72 rounded-full bg-[#3d6fa8]/25 blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        {/* 主数字区 */}
        <div className="min-w-0 sm:min-w-[260px]">
          <div className="text-[12.5px] font-medium tracking-[0.01em] text-white/55">
            当前总日均成本
            <span className="ml-2 text-white/35">· {active.length} 台在用设备合计</span>
          </div>

          <div className="mt-2.5 text-[42px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[48px]">
            {dailySum ? fmtCost(dailySum) : '¥0'}
            <span className="ml-2 text-[15px] font-medium tracking-normal text-white/45">/天</span>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-white/55">
            <span>
              折合每月 <b className="font-semibold text-white/85 tabular-nums">{fmtMoney(dailySum * 30)}</b>
            </span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" />
            <span>
              折合每年 <b className="font-semibold text-white/85 tabular-nums">{fmtMoney(dailySum * 365)}</b>
            </span>
          </div>

          {savedPerDay > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/90">
              <Icon name="trending-down" size={13} className="shrink-0 text-[#5ed49a]" />
              相比 30 天前，每天少花 <b className="font-semibold tabular-nums">{fmtCost(savedPerDay)}</b>
              <span className="text-white/50">（-{savedPercent.toFixed(1)}%）</span>
            </div>
          )}
        </div>

        {/* 趋势线（手机上收起，把首屏留给关键数字） */}
        <div className="hidden w-full sm:block sm:w-[250px]">
          <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-white/40">
            <span>近 30 天成本走势</span>
            <span>自动递减</span>
          </div>
          <Sparkline data={trend} />
          <div className="mt-1.5 flex justify-between text-[10.5px] text-white/35">
            <span>30 天前</span>
            <span>今天</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 迷你趋势线（SVG，含渐变填充与终点圆点） */
function Sparkline({ data }: { data: number[] }) {
  const W = 250;
  const H = 62;
  const PAD = 4;

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const area = `${line} L${last[0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[62px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hero-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hero-spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#fff" />
    </svg>
  );
}
