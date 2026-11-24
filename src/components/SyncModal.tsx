import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { SyncController } from '../hooks/useSync';
import { ApiError, api, type CodeRequestResult } from '../lib/api';
import { cn } from '../lib/utils';
import { Icon } from './Icon';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from './Toast';

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
  sync: SyncController;
}

/** 与后端 CODE_LENGTH 保持一致；后端会在请求响应里回传实际值，这里只是首屏默认 */
let CODE_LEN = 6;
/** 重新获取验证码的冷却秒数 */
const RESEND_COOLDOWN = 60;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SyncModal({ open, onClose, sync }: SyncModalProps) {
  const toast = useToast();

  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [emailInput, setEmailInput] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LEN).fill(''));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [mailConfigured, setMailConfigured] = useState(true);
  const [ttlMinutes, setTtlMinutes] = useState(10);
  const [countdown, setCountdown] = useState(0);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // 关闭时整体重置，下次打开是干净状态
  useEffect(() => {
    if (open) return;
    setStage('email');
    setDigits(Array(CODE_LEN).fill(''));
    setDevCode(null);
    setError(null);
    setSending(false);
    setVerifying(false);
    setCountdown(0);
  }, [open]);

  // 重发倒计时
  useEffect(() => {
    if (stage !== 'code' || countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [stage, countdown]);

  /** 记录一次「已发码」响应，统一更新演示模式/有效期等元信息 */
  const applyRequestResult = (r: CodeRequestResult) => {
    CODE_LEN = r.codeLength || CODE_LEN;
    setMailConfigured(r.mailConfigured);
    setTtlMinutes(r.expiresInMinutes || 10);
    setDevCode(r.devCode ?? null);
    setDigits(Array(CODE_LEN).fill(''));
    setCountdown(RESEND_COOLDOWN);
    setError(null);
  };

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.requestLoginCode(email);
      setSentTo(email);
      setStage('code');
      applyRequestResult(r);
      // 只有真的投递成功才报"已发送"：配了邮件通道但发送失败时，必须明确告知
      if (r.sent) toast(`验证码已发送至 ${email}`, 'success');
      else if (r.mailConfigured) setError('验证码邮件发送失败，请稍后重试');
      window.setTimeout(() => inputsRef.current[0]?.focus(), 60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.requestLoginCode(sentTo);
      applyRequestResult(r);
      if (r.sent) toast('验证码已重新发送', 'success');
      else if (r.mailConfigured) setError('验证码邮件发送失败，请稍后重试');
      window.setTimeout(() => inputsRef.current[0]?.focus(), 60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '重新发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  /** 提交验证码；失败时清空输入框并把焦点送回第一格 */
  const handleVerify = async (value: string) => {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await sync.login(sentTo, value);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '验证失败，请重试');
      setDigits(Array(CODE_LEN).fill(''));
      window.setTimeout(() => inputsRef.current[0]?.focus(), 60);
    } finally {
      setVerifying(false);
    }
  };

  // 用 ref 持有最新版本，供「自动提交」的 effect 调用，避免重复触发
  const verifyRef = useRef(handleVerify);
  verifyRef.current = handleVerify;

  // 六位填满即自动提交，省掉一次点击
  useEffect(() => {
    if (stage !== 'code' || verifying) return;
    if (digits.length !== CODE_LEN || digits.some((d) => !d)) return;
    void verifyRef.current(digits.join(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, stage]);

  const setDigitAt = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleDigitInput = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setDigitAt(index, '');
      return;
    }
    const chars = clean.split('');
    setDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < chars.length && index + k < CODE_LEN; k++) {
        next[index + k] = chars[k];
      }
      return next;
    });
    const focusAt = Math.min(index + chars.length, CODE_LEN - 1);
    inputsRef.current[focusAt]?.focus();
  };

  /** 支持整段粘贴（从邮件里复制 6 位数字是最常见的路径） */
  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!text) return;
    e.preventDefault();
    const next = Array(CODE_LEN).fill('');
    text
      .slice(0, CODE_LEN - index)
      .split('')
      .forEach((ch, k) => {
        next[index + k] = ch;
      });
    setDigits(next);
    const focusAt = Math.min(index + text.length, CODE_LEN - 1);
    inputsRef.current[focusAt]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigitAt(index, '');
      } else if (index > 0) {
        setDigitAt(index - 1, '');
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LEN - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const value = digits.join('');
      if (value.length === CODE_LEN && !digits.some((d) => !d)) void handleVerify(value);
    }
  };

  /** 演示模式：把验证码直接填入输入框 */
  const fillDevCode = () => {
    if (!devCode) return;
    const chars = devCode.split('').slice(0, CODE_LEN);
    const next = Array(CODE_LEN).fill('');
    chars.forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
  };

  const codeFilled = digits.length === CODE_LEN && !digits.some((d) => !d);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>云同步</DialogTitle>
          <DialogDescription>
            {sync.status === 'active'
              ? '数据已与云端关联，本设备修改会自动同步'
              : '登录后可在多台设备间同步数据，不登录也能正常使用'}
          </DialogDescription>
        </DialogHeader>

        {sync.status === 'active' ? (
          /* ============ 已登录视图 ============ */
          <>
            <div className="px-6 pt-4">
              <div className="rounded-lg border border-line bg-muted/60 px-4 py-3.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green" />
                  <span className="truncate font-medium text-ink">{sync.email}</span>
                </div>
                <div className="mt-1.5 text-xs text-ink-4">
                  {sync.lastSyncedAt
                    ? `上次同步：${formatTime(sync.lastSyncedAt)}`
                    : '尚未完成首次同步'}
                </div>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
                本设备的修改会在几秒内自动上传；在其他设备上的修改会在下次打开时自动拉取。
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => void sync.logout()}>
                退出登录
              </Button>
              <Button onClick={() => void sync.syncNow()} disabled={sync.syncing}>
                <Icon
                  name="refresh"
                  size={14}
                  className={sync.syncing ? 'animate-spin' : undefined}
                />
                {sync.syncing ? '同步中…' : '立即同步'}
              </Button>
            </DialogFooter>
          </>
        ) : stage === 'email' ? (
          /* ============ 第一步：输入邮箱 ============ */
          <form onSubmit={handleRequest}>
            <div className="flex flex-col gap-1.5 px-6 pt-4">
              <Label htmlFor="sync-email">邮箱地址</Label>
              <Input
                id="sync-email"
                type="email"
                placeholder="you@example.com"
                autoFocus
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">
                我们会向该邮箱发送一组 {CODE_LEN} 位数字验证码，在下一页填入即可完成登录，无需密码。
                当前设备上的数据会自动同步到云端。
              </p>
              {error && <ErrorLine message={error} />}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={sending || !emailInput.trim()}>
                {sending ? '发送中…' : '获取验证码'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* ============ 第二步：输入验证码 ============ */
          <>
            <div className="px-6 pt-4">
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                验证码已发送至 <b className="font-semibold text-ink">{sentTo}</b>
                <button
                  type="button"
                  className="ml-2 cursor-pointer text-[12px] text-ink-3 underline decoration-line-hover underline-offset-2 transition-colors hover:text-ink"
                  onClick={() => {
                    setStage('email');
                    setError(null);
                  }}
                >
                  换个邮箱
                </button>
              </p>

              <div className="mt-3.5 flex justify-between gap-2">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    disabled={verifying}
                    aria-label={`验证码第 ${i + 1} 位`}
                    className={cn(
                      'h-12 w-full min-w-0 rounded-lg border border-line bg-white text-center font-mono text-[19px] font-semibold text-ink outline-none transition-colors',
                      'focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      digit && 'border-line-hover',
                    )}
                    onChange={(e) => handleDigitInput(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={(e) => handlePaste(i, e)}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11.5px]">
                <span className="text-ink-4">{ttlMinutes} 分钟内有效</span>
                {countdown > 0 ? (
                  <span className="text-ink-4">{countdown} 秒后可重新获取</span>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer font-medium text-ink-2 underline decoration-line-hover underline-offset-2 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void handleResend()}
                    disabled={sending}
                  >
                    重新获取验证码
                  </button>
                )}
              </div>

              {/*
                只要服务端把验证码回传了，就必须显示出来 —— 不能只看 mailConfigured。
                否则「已配 SMTP 但发信失败」时，验证码既寄不出去也不显示，用户会被彻底锁在门外。
              */}
              {devCode && (
                <div className="mt-3.5 rounded-lg border border-amber/35 bg-amber/10 px-3.5 py-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber">
                    <Icon name="alert" size={14} />
                    {mailConfigured ? '邮件发送失败 · 已回退到页面直显' : '演示模式 · 未配置邮件服务'}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                    {mailConfigured
                      ? '验证码没能通过邮件寄出，为免你被锁在门外，这里直接显示。请检查服务端 SMTP 配置。'
                      : '服务端没有接上发信通道，验证码不会真的寄出，直接显示在下方。'}
                    <b className="font-semibold text-ink">此时任何人只要知道邮箱就能登录</b>
                    ，请勿在此环境存放重要数据。
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <code className="rounded-md border border-line bg-white px-2.5 py-1 font-mono text-[15px] font-semibold tracking-[0.18em] text-ink">
                      {devCode}
                    </code>
                    <Button type="button" size="sm" variant="outline" onClick={fillDevCode}>
                      一键填入
                    </Button>
                  </div>
                </div>
              )}

              {error && <ErrorLine message={error} />}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStage('email');
                  setError(null);
                }}
              >
                返回
              </Button>
              <Button
                onClick={() => void handleVerify(digits.join(''))}
                disabled={verifying || !codeFilled}
              >
                {verifying ? '验证中…' : '登录'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 行内错误提示（比 toast 更靠近操作点，且不会被弹窗遮挡） */
function ErrorLine({ message }: { message: string }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-red/25 bg-red/6 px-3 py-2 text-[12px] leading-relaxed text-red">
      <Icon name="alert" size={13} className="mt-[1px] shrink-0" />
      <span>{message}</span>
    </p>
  );
}
