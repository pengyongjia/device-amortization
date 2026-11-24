import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CATEGORIES, STATUSES } from '../constants';
import { uid } from '../data/storage';
import { cn } from '../lib/utils';
import type { CategoryId, Device, DeviceStatus, LoanInfo } from '../types';
import { parseDate, todayStart, todayStr } from '../utils/date';
import { compressImage } from '../utils/image';
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
import { Switch } from './ui/switch';
import { useToast } from './Toast';

interface DeviceModalProps {
  open: boolean;
  /** null 表示新增 */
  device: Device | null;
  onClose: () => void;
  onSubmit: (device: Device) => void;
}

interface FormState {
  name: string;
  category: CategoryId;
  price: string;
  purchaseDate: string;
  status: DeviceStatus;
  endDate: string;
  soldPrice: string;
  expectedYears: string;
  warrantyMonths: string;
  note: string;
  image: string | null;
  loanEnabled: boolean;
  downPayment: string;
  months: string;
  firstPaymentDate: string;
}

const emptyForm = (): FormState => ({
  name: '',
  category: 'phone',
  price: '',
  purchaseDate: todayStr(),
  status: 'in_use',
  endDate: '',
  soldPrice: '',
  expectedYears: '',
  warrantyMonths: '',
  note: '',
  image: null,
  loanEnabled: false,
  downPayment: '',
  months: '',
  firstPaymentDate: '',
});

const formFromDevice = (d: Device): FormState => ({
  name: d.name,
  category: d.category,
  price: String(d.price),
  purchaseDate: d.purchaseDate,
  status: d.status,
  endDate: d.endDate ?? '',
  soldPrice: d.soldPrice != null ? String(d.soldPrice) : '',
  expectedYears: d.expectedYears != null ? String(d.expectedYears) : '',
  warrantyMonths: d.warrantyMonths != null ? String(d.warrantyMonths) : '',
  note: d.note,
  image: d.image,
  loanEnabled: d.loan != null,
  downPayment: d.loan ? String(d.loan.downPayment) : '',
  months: d.loan ? String(d.loan.months) : '',
  firstPaymentDate: d.loan ? d.loan.firstPaymentDate : '',
});

/** 添加 / 编辑设备弹窗（Radix Dialog + 组件库表单 + 图片上传 + 贷款） */
export function DeviceModal({ open, device, onClose, onSubmit }: DeviceModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  // 打开时初始化表单
  useEffect(() => {
    if (open) setForm(device ? formFromDevice(device) : emptyForm());
  }, [open, device]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const showEnd = form.status !== 'in_use' && form.status !== 'idle';

  // 贷款联动计算：本金 = 购买价格 - 首付；月供 = 本金 ÷ 期数
  const priceNum = parseFloat(form.price);
  const downNum = form.downPayment === '' ? 0 : parseFloat(form.downPayment);
  const autoPrincipal =
    Number.isFinite(priceNum) && priceNum > 0 && Number.isFinite(downNum) && downNum >= 0
      ? Math.max(0, priceNum - downNum)
      : null;
  const monthsNum = parseFloat(form.months);
  const autoMonthly =
    autoPrincipal != null && autoPrincipal > 0 && Number.isFinite(monthsNum) && monthsNum > 0
      ? autoPrincipal / monthsNum
      : null;

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await compressImage(file);
      set('image', data);
    } catch {
      toast('图片处理失败，请换一张试试', 'error');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = parseFloat(form.price);
    const years = parseFloat(form.expectedYears);
    const warrantyNum = Math.round(parseFloat(form.warrantyMonths));

    // 校验
    if (!name) return toast('请填写设备名称', 'error');
    if (!Number.isFinite(price) || price < 0) return toast('请填写有效的购买价格', 'error');
    if (!form.purchaseDate) return toast('请选择购买日期', 'error');
    if (parseDate(form.purchaseDate) > todayStart()) return toast('购买日期不能晚于今天', 'error');
    if (showEnd && form.endDate && parseDate(form.endDate) < parseDate(form.purchaseDate)) {
      return toast('结束日期不能早于购买日期', 'error');
    }
    const soldPrice =
      form.status === 'sold' && form.soldPrice !== '' ? parseFloat(form.soldPrice) : null;
    if (soldPrice != null && soldPrice > price) return toast('出售价格不应高于购买价格', 'error');

    // 贷款校验：首付 + 本金 = 购买价格（本金自动推导）
    let loan: LoanInfo | null = null;
    if (form.loanEnabled) {
      const downPayment = form.downPayment === '' ? 0 : parseFloat(form.downPayment);
      const months = Math.round(parseFloat(form.months));
      if (price <= 0) return toast('分期购买需填写大于 0 的购买价格', 'error');
      if (!Number.isFinite(downPayment) || downPayment < 0) return toast('首付金额无效', 'error');
      if (downPayment >= price) return toast('首付需小于购买价格，否则无需分期', 'error');
      if (!Number.isFinite(months) || months < 1 || months > 120) {
        return toast('分期期数应为 1~120 个月', 'error');
      }
      if (!form.firstPaymentDate) return toast('请选择首期还款日', 'error');
      loan = {
        downPayment,
        principal: price - downPayment,
        months,
        firstPaymentDate: form.firstPaymentDate,
      };
    }

    const data: Device = {
      id: device?.id ?? uid(),
      name,
      category: form.category,
      price,
      purchaseDate: form.purchaseDate,
      status: form.status,
      endDate: showEnd && form.endDate ? form.endDate : null,
      soldPrice,
      expectedYears: Number.isFinite(years) && years > 0 ? years : null,
      image: form.image,
      loan,
      warrantyMonths:
        Number.isFinite(warrantyNum) && warrantyNum > 0 && warrantyNum <= 120 ? warrantyNum : null,
      note: form.note.trim(),
      createdAt: device?.createdAt ?? Date.now(),
    };

    onSubmit(data);
    toast(device ? '已保存修改' : `已添加「${name}」`, 'success');
    onClose();
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
          <DialogTitle>{device ? '编辑设备' : '添加设备'}</DialogTitle>
          <DialogDescription>记录购买信息，自动追踪每日摊销成本</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-3.5 overflow-y-auto overscroll-contain px-6 pt-4 pb-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="f-name">设备名称 <b className="font-normal text-red">*</b></Label>
              <Input
                id="f-name"
                maxLength={40}
                placeholder="如：小米手环 8"
                autoFocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            {/* 实物图片：点击区域任意位置均可上传 */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>实物图片</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title={form.image ? '点击更换图片' : '点击上传图片'}
                  className={cn(
                    'group relative h-[72px] w-[104px] shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line bg-muted outline-none transition-colors',
                    'hover:border-line-hover focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7',
                  )}
                >
                  {form.image ? (
                    <>
                      <img src={form.image} alt="设备图片预览" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        点击更换
                      </span>
                    </>
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-4 transition-colors group-hover:text-ink-3">
                      <Icon name="image" size={20} />
                      <span className="text-[10.5px]">点击上传</span>
                    </span>
                  )}
                </button>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Icon name="upload" size={13} />
                      {form.image ? '更换图片' : '上传图片'}
                    </Button>
                    {form.image && (
                      <Button type="button" variant="danger" size="sm" onClick={() => set('image', null)}>
                        <Icon name="trash" size={13} />
                        移除
                      </Button>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-4">自动压缩后仅保存在本地浏览器</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageChange}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>分类</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v as CategoryId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as DeviceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUSES) as DeviceStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUSES[s].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-price">购买价格 (¥) <b className="font-normal text-red">*</b></Label>
              <Input
                id="f-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="180"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>购买日期 <b className="font-normal text-red">*</b></Label>
              <DatePicker
                value={form.purchaseDate}
                max={todayStr()}
                onChange={(v) => set('purchaseDate', v)}
              />
            </div>

            {showEnd && (
              <div className="flex flex-col gap-1.5">
                <Label>{STATUSES[form.status].endLabel}</Label>
                <DatePicker
                  value={form.endDate}
                  max={todayStr()}
                  onChange={(v) => set('endDate', v)}
                />
              </div>
            )}

            {form.status === 'sold' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-sold-price">出售价格 (¥)</Label>
                <Input
                  id="f-sold-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="回血金额，可不填"
                  value={form.soldPrice}
                  onChange={(e) => set('soldPrice', e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-years">预计使用年限（年）</Label>
              <Input
                id="f-years"
                type="number"
                min="0"
                max="20"
                step="0.5"
                placeholder="可选，如 2"
                value={form.expectedYears}
                onChange={(e) => set('expectedYears', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-warranty">保修时长（月）</Label>
              <Input
                id="f-warranty"
                type="number"
                min="0"
                max="120"
                step="1"
                placeholder="可选，如 12"
                value={form.warrantyMonths}
                onChange={(e) => set('warrantyMonths', e.target.value)}
              />
            </div>

            {/* 分期 / 贷款 */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3.5 py-3 sm:col-span-2">
              <div>
                <div className="text-[12.5px] font-medium text-ink-2">分期 / 贷款购买</div>
                <div className="mt-0.5 text-[11.5px] text-ink-4">开启后可追踪月供与剩余待还金额</div>
              </div>
              <Switch
                checked={form.loanEnabled}
                onCheckedChange={(v) => set('loanEnabled', v)}
                aria-label="分期或贷款购买"
              />
            </div>

            {form.loanEnabled && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-down">首付金额 (¥)</Label>
                  <Input
                    id="f-down"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0（无首付可不填）"
                    value={form.downPayment}
                    onChange={(e) => set('downPayment', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>贷款本金（自动计算）</Label>
                  <div className="flex h-9 items-center rounded-lg border border-line bg-muted/60 px-3 text-[13.5px] tabular-nums">
                    <span className={autoPrincipal != null && autoPrincipal > 0 ? 'font-medium text-ink' : 'text-ink-4'}>
                      {autoPrincipal != null && autoPrincipal > 0
                        ? `¥${autoPrincipal.toLocaleString('zh-CN')}`
                        : '填写价格与首付后自动得出'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-months">分期期数（月） <b className="font-normal text-red">*</b></Label>
                  <Input
                    id="f-months"
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    placeholder="如 12"
                    value={form.months}
                    onChange={(e) => set('months', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>首期还款日 <b className="font-normal text-red">*</b></Label>
                  <DatePicker
                    value={form.firstPaymentDate}
                    onChange={(v) => set('firstPaymentDate', v)}
                    placeholder="选择首期还款日"
                  />
                </div>
                <p className="text-[11.5px] leading-relaxed text-ink-4 sm:col-span-2">
                  贷款本金 = 购买价格 − 首付，无需单独填写；首付必须小于购买价格。
                  {autoMonthly != null && autoMonthly > 0 && (
                    <span className="text-ink-3">
                      {' '}按此计算，月供约 <b className="font-medium tabular-nums">¥{autoMonthly.toFixed(2)}</b>，共 {Math.round(monthsNum)} 期。
                    </span>
                  )}
                </p>
              </>
            )}

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="f-note">备注</Label>
              <Textarea
                id="f-note"
                rows={2}
                maxLength={200}
                placeholder="可选，如购买渠道、序列号等"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </div>

            <p className="rounded-lg bg-muted px-3.5 py-2.5 text-xs leading-relaxed text-ink-3 sm:col-span-2">
              日均成本 = 净花费 ÷ 已使用天数，每天自动累加；分期设备的剩余待还金额会随时间自动递减
            </p>
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
