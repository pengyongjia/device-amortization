import { cn } from '../lib/utils';
import type { DeviceWithCalc, IconName } from '../types';
import { fmtCost, fmtDays } from '../utils/format';
import { Icon } from './Icon';

/** 设备之最：最值设备 / 日均最贵 / 服役最久 / 最新入手 */
export function Highlights({ list }: { list: DeviceWithCalc[] }) {
  if (list.length < 2) return null;

  /**
   * 成本类评选（最值 / 日均最贵）只看未结束的设备 ——
   * 出售 / 报废 / 赠送的设备日均已冻结在结束日，不代表它「现在」最贵或最值。
   * 服役最久 / 最新入手 属于历史事实，仍基于全部设备评选。
   */
  const running = list.filter((x) => !x.calc.finished);
  const mature = running.filter((x) => x.calc.usedDays > 30);
  const pool = mature.length >= 2 ? mature : running;
  const cheap = pool.length
    ? [...pool].sort((a, b) => a.calc.dailyCost - b.calc.dailyCost)[0]
    : null;
  const pricey = pool.length
    ? [...pool].sort((a, b) => b.calc.dailyCost - a.calc.dailyCost)[0]
    : null;
  const longest = [...list].sort((a, b) => b.calc.usedDays - a.calc.usedDays)[0];
  const newest = [...list].sort(
    (a, b) => b.device.purchaseDate.localeCompare(a.device.purchaseDate),
  )[0];

  return (
    <div>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">设备之最</h3>
        <span className="text-[11.5px] text-ink-4">成本项仅在用设备</span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cheap && (
          <MiniCard
            tone="green"
            icon="trending-down"
            label="最值设备"
            name={cheap.device.name}
            value={`${fmtCost(cheap.calc.dailyCost)}/天`}
            note={`已用 ${fmtDays(cheap.calc.usedDays)}`}
          />
        )}
        {pricey && (
          <MiniCard
            tone="amber"
            icon="trending-up"
            label="日均最贵"
            name={pricey.device.name}
            value={`${fmtCost(pricey.calc.dailyCost)}/天`}
            note={`已用 ${fmtDays(pricey.calc.usedDays)}`}
          />
        )}
        <MiniCard
          tone="blue"
          icon="award"
          label="服役最久"
          name={longest.device.name}
          value={fmtDays(longest.calc.usedDays)}
          note={`购入于 ${longest.device.purchaseDate}`}
        />
        <MiniCard
          tone="gray"
          icon="calendar"
          label="最新入手"
          name={newest.device.name}
          value={newest.device.purchaseDate}
          note={`已用 ${fmtDays(newest.calc.usedDays)}`}
        />
      </div>
    </div>
  );
}

type Tone = 'green' | 'amber' | 'blue' | 'gray';

function MiniCard({
  tone,
  icon,
  label,
  name,
  value,
  note,
}: {
  tone: Tone;
  icon: IconName;
  label: string;
  name: string;
  value: string;
  note: string;
}) {
  const toneCls: Record<Tone, string> = {
    green: 'border-[#c6e5d8] bg-[#f2faf7] text-[#0b7a55]',
    amber: 'border-[#ecd9b8] bg-[#fdfaf3] text-[#8a5d1f]',
    blue: 'border-[#ccd9e6] bg-[#f5f8fb] text-[#2f5d8a]',
    gray: 'border-line bg-muted text-ink-2',
  };

  return (
    <div className="rounded-xl border border-line bg-white p-4 transition-colors hover:border-line-hover">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] font-medium',
          toneCls[tone],
        )}
      >
        <Icon name={icon} size={12} />
        {label}
      </div>
      <div className="mt-2.5 truncate text-[13.5px] font-semibold tracking-[-0.01em]" title={name}>
        {name}
      </div>
      <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em] tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-4">{note}</div>
    </div>
  );
}
