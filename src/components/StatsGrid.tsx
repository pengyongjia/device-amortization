import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import type { DeviceWithCalc, IconName } from '../types';
import { fmtMoney } from '../utils/format';
import { Icon } from './Icon';

interface StatItem {
  icon: IconName;
  label: string;
  value: ReactNode;
  sub: string;
}

/** 关键指标卡：设备总数 / 在用设备 / 总投入 /（有分期时）剩余待还 */
export function StatsGrid({ list }: { list: DeviceWithCalc[] }) {
  const active = list.filter(
    (x) => x.device.status === 'in_use' || x.device.status === 'idle',
  );
  const inUse = list.filter((x) => x.device.status === 'in_use').length;
  const idle = list.filter((x) => x.device.status === 'idle').length;
  const invested = list.reduce((s, x) => s + x.device.price, 0);

  // 分期未还清的剩余负债
  const unsettled = list.filter((x) => x.calc.loan && !x.calc.loan.settled);
  const loanRemaining = unsettled.reduce((s, x) => s + (x.calc.loan?.remaining ?? 0), 0);

  const items: StatItem[] = [
    {
      icon: 'box',
      label: '设备总数',
      value: (
        <>
          {list.length}
          <Unit>台</Unit>
        </>
      ),
      sub: list.length
        ? `在用 ${active.length} · 已结束 ${list.length - active.length}`
        : '尚未添加设备',
    },
    {
      icon: 'activity',
      label: '在用设备',
      value: (
        <>
          {active.length}
          <Unit>台</Unit>
        </>
      ),
      sub: `使用中 ${inUse} · 闲置 ${idle}`,
    },
    {
      icon: 'wallet',
      label: '总投入',
      value: fmtMoney(invested),
      sub: '所有设备购入价合计',
    },
  ];

  if (loanRemaining > 0) {
    items.push({
      icon: 'calendar',
      label: '剩余待还',
      value: <span className="text-amber">{fmtMoney(loanRemaining)}</span>,
      sub: `${unsettled.length} 台分期中 · 随还款自动递减`,
    });
  }

  // 手机 2 列时，若为奇数个则最后一张跨整行横排，避免右侧留空
  const odd = items.length % 2 === 1;

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4',
        loanRemaining > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
      )}
    >
      {items.map((item, i) => (
        <StatCard key={item.label} {...item} wide={odd && i === items.length - 1} />
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub, wide }: StatItem & { wide?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-white p-3.5 transition-colors hover:border-line-hover sm:p-4.5',
        wide && 'col-span-2 lg:col-span-1',
      )}
    >
      <div className={cn(wide && 'flex items-center justify-between gap-4 lg:block')}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-2">
            <Icon name={icon} size={15} />
          </span>
          <span className="text-[12px] font-medium text-ink-3">{label}</span>
        </div>
        <div
          className={cn(
            'mt-2.5 text-[24px] leading-none font-semibold tracking-[-0.02em] tabular-nums sm:mt-3 sm:text-[28px]',
            wide && 'mt-0 shrink-0 lg:mt-3',
          )}
        >
          {value}
        </div>
      </div>
      <div className="mt-1.5 text-[11.5px] text-ink-4 sm:mt-2">{sub}</div>
    </div>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 text-[13px] font-medium tracking-normal text-ink-3">{children}</span>
  );
}
