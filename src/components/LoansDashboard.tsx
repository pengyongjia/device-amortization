import type { LoanRecord, LoanSchedule, LoansSummary } from '../types';
import { fmtMoney } from '../utils/format';
import { Icon } from './Icon';
import { LoanCard } from './LoanCard';

interface LoansDashboardProps {
  loans: LoanRecord[];
  schedules: LoanSchedule[];
  summary: LoansSummary;
  onAdd: () => void;
  onEdit: (loan: LoanRecord) => void;
  onDelete: (loan: LoanRecord) => void;
}

/** 贷款管理页：汇总主卡 + 关键指标 + 贷款列表 */
export function LoansDashboard({
  loans,
  schedules,
  summary,
  onAdd,
  onEdit,
  onDelete,
}: LoansDashboardProps) {
  return (
    <section className="flex animate-[fadeIn_.2s_ease] flex-col gap-4">
      {/* 汇总主卡 */}
      <div className="relative overflow-hidden rounded-2xl bg-ink px-5 py-5 text-white sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 right-40 h-72 w-72 rounded-full bg-[#3d6fa8]/25 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-[240px]">
            <div className="text-[12.5px] font-medium text-white/55">
              每月需还（本期）
              <span className="ml-2 text-white/35">· {summary.activeCount} 笔进行中</span>
            </div>
            <div className="mt-2.5 text-[42px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[48px]">
              {fmtMoney(summary.monthlyPayment)}
              <span className="ml-2 text-[15px] font-medium tracking-normal text-white/45">/月</span>
            </div>
            {summary.nextUp && (
              <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white/85">
                <Icon name="calendar" size={13} className="text-[#7fb8f0]" />
                下期 {summary.nextUp.date} · <b className="font-semibold">{summary.nextUp.name}</b>{' '}
                {fmtMoney(summary.nextUp.amount)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:gap-x-12">
            <SummaryStat label="待还本金" value={fmtMoney(summary.remainingPrincipal)} />
            <SummaryStat label="累计已还" value={fmtMoney(summary.paidAmount)} />
            <SummaryStat label="已付利息" value={fmtMoney(summary.paidInterest)} />
            <SummaryStat label="贷款笔数" value={`${loans.length} 笔`} />
          </div>
        </div>
      </div>

      {/* 列表标题 + 添加按钮 */}
      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-[13px] font-semibold text-ink-3">我的贷款</h2>
        <button
          onClick={onAdd}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 sm:h-9"
        >
          <Icon name="plus" size={14} />
          新增贷款
        </button>
      </div>

      {loans.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] items-start gap-4">
          {loans.map((loan, i) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              schedule={schedules[i]}
              onEdit={() => onEdit(loan)}
              onDelete={() => onDelete(loan)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onAdd={onAdd} />
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-white/50">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tracking-[-0.01em] tabular-nums">{value}</div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-5 py-16 text-center">
      <div className="mb-4 flex justify-center text-[#c6d0da]">
        <Icon name="wallet" size={44} strokeWidth={1.2} />
      </div>
      <h3 className="text-[15px] font-semibold">还没有贷款记录</h3>
      <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-ink-3">
        房贷、车贷、购物分期都能记。自定义还款方式、利率和间隔，自动算出每月要还多少、总共要付多少利息。
      </p>
      <button
        onClick={onAdd}
        className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <Icon name="plus" size={14} />
        添加第一笔贷款
      </button>
    </div>
  );
}
