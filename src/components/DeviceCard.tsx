import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { STATUSES, getCategory } from '../constants';
import type { Device, DeviceCalc } from '../types';
import { cn } from '../lib/utils';
import { fmtCost, fmtDays, fmtMoney } from '../utils/format';
import { Button } from './ui/button';
import { CostBars } from './CostBars';
import { Icon } from './Icon';
import { ShareModal } from './ShareModal';

interface DeviceCardProps {
  device: Device;
  calc: DeviceCalc;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
}

/**
 * 设备卡片：实物图片为主视觉
 * - 桌面端（真 hover 设备）：鼠标移入图片显示遮罩，展示完整信息与操作
 * - 触屏设备：不展示遮罩，重要信息与操作直接平铺在卡片上
 */
export function DeviceCard({ device, calc, onEdit, onDelete }: DeviceCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const st = STATUSES[device.status];
  const cat = getCategory(device.category);

  // 成就 / 状态标签（卡片上最多展示 2 个；贷款待还与临期保修最优先）
  const badges: ReactNode[] = [];
  if (calc.loan && !calc.loan.settled) {
    badges.push(
      <Badge key="loan" tone="amber">
        待还 {fmtMoney(calc.loan.remaining)}
      </Badge>,
    );
  }
  if (calc.warranty && calc.warranty.status !== 'expired') {
    badges.push(
      <Badge key="warranty" tone={calc.warranty.status === 'expiring' ? 'amber' : 'blue'}>
        {calc.warranty.status === 'expiring'
          ? `保修仅剩 ${calc.warranty.daysLeft} 天`
          : `保修剩 ${calc.warranty.daysLeft} 天`}
      </Badge>,
    );
  }
  if (calc.plannedDays && calc.usedDays >= calc.plannedDays) {
    badges.push(<Badge key="full" tone="gold">已用满预计年限</Badge>);
  } else if (calc.plannedDays && (calc.progress ?? 0) >= 0.8) {
    badges.push(<Badge key="near" tone="blue">接近预计年限</Badge>);
  }
  if (calc.usedDays >= 1000) {
    badges.push(<Badge key="d1000" tone="green">服役 1000+ 天</Badge>);
  } else if (calc.usedDays >= 365) {
    badges.push(<Badge key="d365" tone="green">服役 1 年以上</Badge>);
  } else if (calc.usedDays >= 100) {
    badges.push(<Badge key="d100" tone="green">服役 100+ 天</Badge>);
  }
  if (device.soldPrice) {
    badges.push(<Badge key="sold" tone="red">已回血 {fmtMoney(device.soldPrice)}</Badge>);
  }
  if (calc.dailyCost <= 1 && calc.usedDays > 30) {
    badges.push(<Badge key="cheap">每天不到 1 元</Badge>);
  }

  /**
   * 主数字下方那行。
   * 已结束生命周期的设备（出售 / 报废 / 赠送）天数与日均都已冻结在结束日，
   * 再显示「明天 ¥X」会误导 —— 那个数字永远不会发生，所以改说结算情况。
   */
  const tailLine = calc.finished
    ? device.endDate
      ? `已结算于 ${device.endDate}`
      : '已结算 · 天数已冻结'
    : `明天 ${fmtCost(calc.tomorrowCost)}`;

  return (
    <article className="group overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-line-hover">
      {/* 手机端横向布局（左缩略图 + 右信息），桌面端恢复纵向大图 */}
      <div className="flex sm:block">
        {/* ============ 图片区（主视觉） ============ */}
        <div className="relative min-h-[96px] w-[100px] shrink-0 overflow-hidden bg-muted sm:aspect-[16/10] sm:min-h-0 sm:w-full">
          {device.image ? (
            <img
              src={device.image}
              alt={device.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-[#e9eef4] text-ink-4">
              <Icon name={cat.icon} size={46} strokeWidth={1.1} className="max-sm:h-7 max-sm:w-7" />
            </div>
          )}

          {/* 状态角标 */}
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11.5px] font-medium text-ink-2 shadow-[0_1px_3px_rgba(10,37,64,.08)] backdrop-blur-sm max-sm:top-1.5 max-sm:left-1.5 max-sm:gap-1 max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[10px]">
            <i className="h-[7px] w-[7px] rounded-full" style={{ background: st.color }} />
            {st.name}
          </span>

        {/* 桌面 hover 遮罩：完整信息 + 操作（仅真 hover 设备显示） */}
        <div className="absolute inset-0 hidden flex-col justify-end bg-ink/70 p-4 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 hover-able:flex">
          <dl className="space-y-1.5 text-xs">
            <InfoRow label="购入价" value={fmtMoney(device.price)} />
            {calc.netCost !== device.price && (
              <InfoRow label="净花费" value={fmtMoney(calc.netCost)} />
            )}
            <InfoRow label="购买日期" value={device.purchaseDate} />
            <InfoRow label="已使用" value={fmtDays(calc.usedDays)} />
            <InfoRow label="折合月均" value={fmtMoney(calc.monthlyCost)} />
            {calc.warranty && (
              <InfoRow
                label="保修至"
                value={
                  calc.warranty.status === 'expired'
                    ? `${calc.warranty.endDate}（已过保）`
                    : `${calc.warranty.endDate}（剩 ${calc.warranty.daysLeft} 天）`
                }
              />
            )}
          </dl>

          {/* 还款信息 */}
          {calc.loan && (
            <div className="mt-2.5 border-t border-white/15 pt-2.5">
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="font-medium text-white/90 tabular-nums">
                  {calc.loan.settled ? '分期已还清' : `待还 ${fmtMoney(calc.loan.remaining)}`}
                </span>
                <span className="text-white/55 tabular-nums">
                  月供 {fmtMoney(calc.loan.monthlyPayment)} · 已还 {calc.loan.paidPeriods}/{calc.loan.months} 期
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white/80"
                  style={{ width: `${Math.min(100, calc.loan.progress * 100).toFixed(1)}%` }}
                />
              </div>
              {!calc.loan.settled && calc.loan.nextPaymentDate && (
                <div className="mt-1.5 text-[11px] text-white/50 tabular-nums">
                  下期还款 {calc.loan.nextPaymentDate}
                </div>
              )}
            </div>
          )}

          {device.note && (
            <p className="mt-2.5 truncate border-t border-white/15 pt-2 text-[11.5px] text-white/65">
              {device.note}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <OverlayButton onClick={() => setDetailsOpen((v) => !v)}>
              <Icon name="chart" size={13} />
              {detailsOpen ? '收起曲线' : '成本曲线'}
            </OverlayButton>
            <OverlayButton onClick={() => setShareOpen(true)}>
              <Icon name="share" size={13} />
              分享
            </OverlayButton>
            <OverlayButton onClick={() => onEdit(device)}>
              <Icon name="edit" size={13} />
              编辑
            </OverlayButton>
            <OverlayButton onClick={() => onDelete(device)} className="ml-auto">
              <Icon name="trash" size={13} />
              删除
            </OverlayButton>
          </div>
        </div>
      </div>

      {/* ============ 底部信息条（两端通用）：名称 + 状态 + 当前日均 ============ */}
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3.5 max-sm:px-3 max-sm:py-2.5 sm:flex-none">
        <div className="min-w-0">
          <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
            {device.name}
          </h3>
          <p className="mt-0.5 text-[11.5px] text-ink-4">{cat.name}</p>
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 max-sm:mt-1">{badges.slice(0, 2)}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums max-sm:text-[18px]">
            {fmtCost(calc.dailyCost)}
            <span className="ml-1 text-[11.5px] font-medium text-ink-3">/天</span>
          </div>
          <div className="mt-1.5 text-[11px] text-ink-4 tabular-nums max-sm:mt-1">{tailLine}</div>
        </div>
      </div>
      </div>

      {/* ============ 触屏设备：重要信息与操作直接平铺（无遮罩可用） ============ */}
      <div className="hidden border-t border-line-2 px-4 pt-3 pb-4 hover-none:block">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span>
            已用 <b className="font-semibold text-ink-2 tabular-nums">{fmtDays(calc.usedDays)}</b>
          </span>
          <span>
            购入 <b className="font-semibold text-ink-2 tabular-nums">{fmtMoney(device.price)}</b>
          </span>
          <span>
            月均 <b className="font-semibold text-ink-2 tabular-nums">{fmtMoney(calc.monthlyCost)}</b>
          </span>
          {calc.loan && !calc.loan.settled && (
            <span>
              待还{' '}
              <b className="font-semibold text-amber tabular-nums">{fmtMoney(calc.loan.remaining)}</b>
              （月供 {fmtMoney(calc.loan.monthlyPayment)}）
            </span>
          )}
          {calc.warranty && calc.warranty.status !== 'expired' && (
            <span>
              保修剩{' '}
              <b className="font-semibold text-ink-2 tabular-nums">{calc.warranty.daysLeft} 天</b>
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDetailsOpen((v) => !v)}>
            <Icon name="chart" size={13} />
            {detailsOpen ? '收起曲线' : '成本曲线'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Icon name="share" size={13} />
            分享
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(device)}>
            <Icon name="edit" size={13} />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto hover:bg-[#fdf5f4] hover:text-red"
            onClick={() => onDelete(device)}
          >
            <Icon name="trash" size={13} />
            删除
          </Button>
        </div>
      </div>

      {/* ============ 成本曲线展开区 ============ */}
      {detailsOpen && (
        <div className="border-t border-line-2 px-4 pt-3.5 pb-4">
          <CostBars device={device} calc={calc} />
          <p className="mt-2 text-center text-[11px] text-ink-4">
            按月度采样的日均成本{calc.plannedDays && !calc.finished ? '，浅色为未来预测' : ''}
          </p>
        </div>
      )}

      {/* 分享卡片预览（关闭时不渲染内容） */}
      <ShareModal
        device={shareOpen ? device : null}
        calc={shareOpen ? calc : null}
        onClose={() => setShareOpen(false)}
      />
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/60">{label}</dt>
      <dd className="font-medium text-white/90 tabular-nums">{value}</dd>
    </div>
  );
}

function OverlayButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/25 px-2.5 py-[5px] text-[11.5px] font-medium text-white/90 transition-colors hover:border-white/50 hover:bg-white/10',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'gold' | 'green' | 'blue' | 'red' | 'amber';
}) {
  return (
    <span
      className={cn(
        'rounded-md border border-line bg-white px-2 py-[3px] text-[11px] font-medium text-ink-2',
        tone === 'gold' && 'border-[#e8ddc0] bg-[#fdfbf4] text-[#8a6d1f]',
        tone === 'green' && 'border-[#c6e5d8] bg-[#f2faf7] text-[#0b7a55]',
        tone === 'blue' && 'border-[#ccd9e6] bg-[#f5f8fb] text-[#2f5d8a]',
        tone === 'red' && 'border-[#ecd2cd] bg-[#fdf6f5] text-[#a13c31]',
        tone === 'amber' && 'border-[#ecd9b8] bg-[#fdfaf3] text-[#8a5d1f]',
      )}
    >
      {children}
    </span>
  );
}
