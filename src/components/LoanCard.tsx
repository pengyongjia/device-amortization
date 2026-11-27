import { useState } from 'react';
import type { LoanRecord, LoanSchedule } from '../types';
import { fmtMoney } from '../utils/format';
import {
  INTERVAL_LABEL,
  RATE_UNIT_LABEL,
  REPAY_METHOD_LABEL,
} from '../utils/loanSchedule';
import { Icon } from './Icon';

interface LoanCardProps {
  loan: LoanRecord;
  schedule: LoanSchedule;
  onEdit: () => void;
  onDelete: () => void;
}

/** 单笔贷款卡片：关键信息 + 进度 + 可展开的还款计划明细 */
export function LoanCard({ loan, schedule, onEdit, onDelete }: LoanCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-line-hover">
      <div className="px-4 py-3.5 sm:px-5 sm:py-4">
        {/* 头部：名称 + 操作 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-white">
              <Icon name="wallet" size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{loan.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-4">
                <span>{REPAY_METHOD_LABEL[loan.method]}</span>
                <span className="h-2.5 w-px bg-line" />
                <span>{INTERVAL_LABEL[loan.interval]}</span>
                <span className="h-2.5 w-px bg-line" />
                <span>
                  {loan.mode === 'existing'
                    ? `剩余 ${Math.max(0, schedule.totalPeriods - schedule.totalPaidPeriods)} 期`
                    : `${loan.periods} 期`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={onEdit}
              title="编辑"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-line text-ink-3 transition-colors hover:border-line-hover hover:text-ink sm:h-8 sm:w-8"
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              onClick={onDelete}
              title="删除"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-line text-ink-3 transition-colors hover:border-red hover:text-red sm:h-8 sm:w-8"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </div>

        {/* 核心数字区：当期应还 / 累计已还 / 剩余本金 */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          <Metric
            label={
              schedule.settled
                ? '已结清'
                : loan.method === 'equal_principal'
                  ? '本期应还'
                  : loan.method === 'bullet'
                    ? '到期应还'
                    : loan.method === 'interest_first'
                      ? '每期利息'
                      : '每期月供'
            }
            value={fmtMoney(schedule.settled ? schedule.lastPayment : schedule.periodPayment)}
            accent
          />
          <Metric
            label={loan.mode === 'existing' ? '已还本金(估算)' : '累计已还'}
            value={fmtMoney(
              loan.mode === 'existing'
                ? (loan.principal / Math.max(1, loan.periods)) * (loan.paidPeriods ?? 0)
                : schedule.paidAmount,
            )}
          />
          <Metric label="剩余本金" value={fmtMoney(schedule.remainingPrincipal)} />
        </div>

        {/* 进度条 */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-ink-3">
            <span>
              已还 {schedule.totalPaidPeriods}/{schedule.totalPeriods} 期
            </span>
            <span className="tabular-nums">
              {schedule.settled
                ? '已结清'
                : `${loan.mode === 'existing' ? '剩余利息' : '总利息'} ${fmtMoney(schedule.totalInterest)}`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${Math.round(schedule.progress * 100)}%` }}
            />
          </div>
        </div>

        {/* 下期还款日 */}
        {!schedule.settled && schedule.nextPaymentDate && (
          <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <Icon name="calendar" size={13} />
            下期还款日 <b className="font-medium text-ink-2">{schedule.nextPaymentDate}</b>
            <span className="text-ink-4">· 应还 {fmtMoney(schedule.periodPayment)}</span>
          </div>
        )}

        {/* 等额本金：明确月供逐月递减的区间，避免被误认为固定月供 */}
        {loan.method === 'equal_principal' && !schedule.settled && (
          <div className="mt-1.5 text-[11px] text-ink-4 tabular-nums">
            等额本金逐月递减：首期 {fmtMoney(schedule.firstPayment)} → 末期{' '}
            {fmtMoney(schedule.lastPayment)}
          </div>
        )}

        {/* 利率口径说明 */}
        <div className="mt-2 text-[11px] text-ink-4">
          {loan.rateUnit === 'total'
            ? `${RATE_UNIT_LABEL[loan.rateUnit]} ${fmtMoney(loan.rateValue)}`
            : `${RATE_UNIT_LABEL[loan.rateUnit]} ${loan.rateValue}`}
          {' · '}名义月利率 {(schedule.monthlyRate * 100).toFixed(3)}%
        </div>
      </div>

      {/* 还款计划明细（展开） */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-line py-2.5 text-[12px] font-medium text-ink-3 transition-colors hover:bg-muted hover:text-ink"
      >
        {expanded ? '收起还款计划' : `查看还款计划（${schedule.installments.length} 期）`}
        <Icon
          name="chevron-down"
          size={14}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="max-h-72 overflow-y-auto border-t border-line-2 bg-muted/40">
          <table className="w-full text-left text-[11.5px] tabular-nums">
            <thead className="sticky top-0 bg-muted text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">期数</th>
                <th className="px-2 py-2 font-medium">日期</th>
                <th className="px-2 py-2 text-right font-medium">本金</th>
                <th className="px-2 py-2 text-right font-medium">利息</th>
                <th className="px-4 py-2 text-right font-medium">应还</th>
              </tr>
            </thead>
            <tbody>
              {schedule.installments.map((it) => (
                <tr
                  key={it.index}
                  className={`border-t border-line-2 ${it.due ? 'text-ink-2' : 'text-ink-4'}`}
                >
                  <td className="px-4 py-1.5">
                    {it.index}
                    {it.due && <span className="ml-1 text-[9px] text-green">已还</span>}
                  </td>
                  <td className="px-2 py-1.5">{it.date.slice(0, 7)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtMoney(it.principal)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtMoney(it.interest)}</td>
                  <td className="px-4 py-1.5 text-right font-medium">{fmtMoney(it.payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-ink-4">{label}</div>
      <div
        className={`mt-1 truncate text-[15px] font-semibold tracking-[-0.01em] tabular-nums sm:text-[17px] ${accent ? 'text-ink' : 'text-ink-2'}`}
      >
        {value}
      </div>
    </div>
  );
}
