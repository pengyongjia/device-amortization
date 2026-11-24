import { useMemo, useState, type FormEvent } from 'react';
import type { LoanRecord, RateUnit, RepayInterval, RepayMethod } from '../types';
import { uid } from '../data/storage';
import { fmtMoney } from '../utils/format';
import {
  INTERVAL_LABEL,
  RATE_UNIT_LABEL,
  REPAY_METHOD_LABEL,
  calcLoanSchedule,
  toMonthlyRate,
} from '../utils/loanSchedule';
import { addMonths, toDateStr, todayStart } from '../utils/date';
import { Icon } from './Icon';
import { Button } from './ui/button';
import { DatePicker } from './ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input, Textarea } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface LoanModalProps {
  open: boolean;
  loan: LoanRecord | null;
  onClose: () => void;
  onSubmit: (loan: LoanRecord) => void;
}

type FormState = Omit<LoanRecord, 'id' | 'createdAt'>;

const emptyForm = (): FormState => ({
  name: '',
  principal: 0,
  method: 'equal_installment',
  rateUnit: 'year',
  rateValue: 0,
  interval: 'month',
  periods: 12,
  // 默认下个月今天为首期还款日：避免"刚录入就显示已还一期"的错觉
  firstPaymentDate: toDateStr(addMonths(todayStart(), 1)),
  note: '',
});

const METHODS = Object.keys(REPAY_METHOD_LABEL) as RepayMethod[];
const RATE_UNITS = Object.keys(RATE_UNIT_LABEL) as RateUnit[];
const INTERVALS = Object.keys(INTERVAL_LABEL) as RepayInterval[];

/** 利率输入提示（跟随口径变化） */
const RATE_HINT: Record<RateUnit, string> = {
  year: '如 4.2 表示年利率 4.2%',
  month: '如 0.35 表示月利率 0.35%',
  day: '如 5 表示日息万分之五（万 5）',
  total: '整个贷款期总共支付的利息/手续费金额',
};

export function LoanModal({ open, loan, onClose, onSubmit }: LoanModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    loan
      ? {
          name: loan.name,
          principal: loan.principal,
          method: loan.method,
          rateUnit: loan.rateUnit,
          rateValue: loan.rateValue,
          interval: loan.interval,
          periods: loan.periods,
          firstPaymentDate: loan.firstPaymentDate,
          note: loan.note,
        }
      : emptyForm(),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // 实时预览：把当前表单当成一笔贷款算一遍
  const preview = useMemo(() => {
    if (!form.principal || !form.periods || !form.firstPaymentDate) return null;
    const draft: LoanRecord = { ...form, id: 'preview', createdAt: 0 };
    const s = calcLoanSchedule(draft);
    return { monthly: s.monthlyPayment, totalInterest: s.totalInterest, total: s.totalPayment };
  }, [form]);

  const monthlyRatePct = toMonthlyRate(form.rateUnit, form.rateValue) * 100;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.principal || form.principal <= 0) return;
    if (!form.periods || form.periods <= 0) return;
    onSubmit({
      ...form,
      name: form.name.trim(),
      id: loan?.id ?? uid(),
      createdAt: loan?.createdAt ?? Date.now(),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{loan ? '编辑贷款' : '新增贷款'}</DialogTitle>
          <DialogDescription>
            设置还款方式与利息，自动算出每月还款和总利息
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-3.5 overflow-y-auto overscroll-contain px-6 pt-4 pb-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="l-name">名称 <b className="font-normal text-red">*</b></Label>
              <Input
                id="l-name"
                maxLength={40}
                placeholder="如：房贷 / 车贷 / 花呗分期"
                autoFocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-principal">贷款本金 (¥) <b className="font-normal text-red">*</b></Label>
              <Input
                id="l-principal"
                type="number"
                min={0}
                step={100}
                placeholder="如：1000000"
                value={form.principal || ''}
                onChange={(e) => set('principal', Number(e.target.value) || 0)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-periods">总期数 <b className="font-normal text-red">*</b></Label>
              <Input
                id="l-periods"
                type="number"
                min={1}
                max={600}
                step={1}
                placeholder="如：360"
                value={form.periods || ''}
                onChange={(e) => set('periods', Math.floor(Number(e.target.value) || 0))}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>还款方式</Label>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('method', m)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                      form.method === m
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-white text-ink-2 hover:border-line-hover'
                    }`}
                  >
                    {REPAY_METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-ink-4">
                {form.method === 'equal_installment' && '每期还款金额固定，最常见于房贷'}
                {form.method === 'equal_principal' && '每期归还本金相同，月供逐期减少，总利息更低'}
                {form.method === 'interest_first' && '每期只还利息，最后一期一次性归还本金'}
                {form.method === 'bullet' && '期间不用还款，到期一次还清本金和利息'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>利率口径</Label>
              <Select value={form.rateUnit} onValueChange={(v) => set('rateUnit', v as RateUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {RATE_UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-rate">
                {RATE_UNIT_LABEL[form.rateUnit]}
                {form.rateUnit === 'total' ? ' (¥)' : ''}
              </Label>
              <Input
                id="l-rate"
                type="number"
                min={0}
                step={form.rateUnit === 'day' ? 0.1 : 0.01}
                placeholder="无息填 0"
                value={form.rateValue || ''}
                onChange={(e) => set('rateValue', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <p className="-mt-1 text-[11px] text-ink-4">
                <Icon name="activity" size={12} className="mr-1 inline align-[-2px]" />
                {RATE_HINT[form.rateUnit]}
                {form.rateUnit !== 'total' && ` · 折算月利率 ${monthlyRatePct.toFixed(3)}%`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>还款间隔</Label>
              <Select value={form.interval} onValueChange={(v) => set('interval', v as RepayInterval)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {INTERVAL_LABEL[i]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>首期还款日</Label>
              <DatePicker
                value={form.firstPaymentDate}
                onChange={(v) => set('firstPaymentDate', v)}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="l-note">备注（可选）</Label>
              <Textarea
                id="l-note"
                maxLength={200}
                rows={2}
                placeholder="如：等额本息，30 年还清"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </div>

            {/* 实时预览 */}
            {preview && (
              <div className="rounded-lg border border-line bg-muted/60 px-3.5 py-3 sm:col-span-2">
                <div className="mb-2 text-[11.5px] font-medium text-ink-3">预览</div>
                <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                  <div>
                    <div className="text-[10.5px] text-ink-4">折算月供</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-ink">{fmtMoney(preview.monthly)}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-ink-4">总利息</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-ink-2">{fmtMoney(preview.totalInterest)}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-ink-4">本息合计</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-ink-2">{fmtMoney(preview.total)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
