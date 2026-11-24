import { cn } from '../lib/utils';
import type { DeviceWithCalc } from '../types';
import { fmtCost } from '../utils/format';

/**
 * 日均成本排行 TOP 8：前三名带金/银/铜名次标记。
 * 只统计未结束的设备 —— 出售 / 报废 / 赠送的设备日均已冻结在结束日、不再产生新成本，
 * 混进「越靠前每天越贵」的排行会误导。
 */
export function RankList({ list }: { list: DeviceWithCalc[] }) {
  const running = list.filter((x) => !x.calc.finished);
  const top = [...running].sort((a, b) => b.calc.dailyCost - a.calc.dailyCost).slice(0, 8);
  const max = top[0]?.calc.dailyCost || 1;

  return (
    <div className="rounded-xl border border-line bg-white px-6 py-[22px]">
      <div className="mb-[18px] flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">日均成本排行</h3>
        <span className="text-[11.5px] text-ink-4">仅在用设备 · 越靠前每天越贵</span>
      </div>

      <div className="flex flex-col gap-3">
        {!top.length && (
          <div className="py-8 text-center text-[12.5px] text-ink-4">
            {list.length ? '目前没有在用设备，无法排行' : '添加设备后，这里会显示谁每天最烧钱'}
          </div>
        )}
        {top.map(({ device, calc }, i) => (
          <div
            key={device.id}
            className="grid grid-cols-[22px_minmax(0,92px)_1fr_82px] items-center gap-2.5"
          >
            <RankBadge rank={i + 1} />
            <span className="truncate text-[12.5px] font-medium text-ink-2" title={device.name}>
              {device.name}
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-line-2">
              <span
                className="block h-full min-w-[3px] rounded-full bg-ink transition-[width] duration-500"
                style={{ width: `${Math.max(2, (calc.dailyCost / max) * 100)}%` }}
              />
            </span>
            <span className="text-right text-[12.5px] font-semibold tabular-nums">
              {fmtCost(calc.dailyCost)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 名次标记：前三名金/银/铜，其余为灰色数字 */
function RankBadge({ rank }: { rank: number }) {
  const medal = [
    'border-[#e8d9b0] bg-[#f9f1dd] text-[#8a6d1f]', // 金
    'border-[#d8dee6] bg-[#eef1f5] text-[#5f6b7a]', // 银
    'border-[#e6d2c2] bg-[#f7ebdf] text-[#8a5d3b]', // 铜
  ];
  return (
    <span
      className={cn(
        'flex h-[19px] w-[19px] items-center justify-center rounded-full border text-[10.5px] font-semibold tabular-nums',
        rank <= 3 ? medal[rank - 1] : 'border-line bg-white text-ink-4',
      )}
    >
      {rank}
    </span>
  );
}
