import { PALETTE, getCategory } from '../constants';
import type { CategoryId, DeviceWithCalc } from '../types';
import { fmtMoney } from '../utils/format';

/** 分类占比环形图（conic-gradient 实现，无图表库依赖） */
export function DonutChart({ list }: { list: DeviceWithCalc[] }) {
  const byCat = new Map<CategoryId, number>();
  list.forEach(({ device }) => {
    byCat.set(device.category, (byCat.get(device.category) ?? 0) + device.price);
  });

  const items = [...byCat.entries()]
    .map(([cid, amount]) => ({ meta: getCategory(cid), amount }))
    .sort((a, b) => b.amount - a.amount);
  const total = items.reduce((s, it) => s + it.amount, 0);

  let acc = 0;
  const segs = items.map((it, i) => {
    const from = (acc / total) * 360;
    acc += it.amount;
    const to = (acc / total) * 360;
    return `${PALETTE[i % PALETTE.length]} ${from.toFixed(1)}deg ${to.toFixed(1)}deg`;
  });
  const bg = total
    ? `conic-gradient(${segs.join(', ')})`
    : 'conic-gradient(#eef1f5 0deg 360deg)';

  return (
    <div className="rounded-xl border border-line bg-white px-6 py-[22px]">
      <div className="mb-[18px] flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">分类占比</h3>
        <span className="text-[11.5px] text-ink-4">按购买金额统计</span>
      </div>

      <div className="flex flex-wrap items-center gap-7">
        <div
          className="relative h-[148px] w-[148px] shrink-0 rounded-full transition-[background] duration-500"
          style={{ background: bg }}
        >
          <div className="absolute inset-6 grid content-center place-items-center rounded-full bg-white text-center">
            <span className="text-[19px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums">
              {fmtMoney(total)}
            </span>
            <small className="mt-0.5 text-[10.5px] text-ink-4">已投入</small>
          </div>
        </div>

        <ul className="flex min-w-[190px] flex-1 flex-col gap-2.5">
          {!items.length && <li className="py-8 text-center text-[12.5px] text-ink-4">暂无数据</li>}
          {items.map((it, i) => (
            <li key={it.meta.id} className="flex items-center gap-2.5 text-[12.5px]">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 truncate text-ink-2">{it.meta.name}</span>
              <span className="text-xs tabular-nums text-ink-3">
                {fmtMoney(it.amount)} · {((it.amount / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
