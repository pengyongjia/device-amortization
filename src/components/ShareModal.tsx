import { useEffect, useRef, useState } from 'react';
import type { Device, DeviceCalc } from '../types';
import { generateShareImage } from '../utils/shareImage';
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
import { useToast } from './Toast';

interface ShareModalProps {
  /** null 表示关闭 */
  device: Device | null;
  calc: DeviceCalc | null;
  onClose: () => void;
}

/** 分享卡片预览：生成图片 → 大图预览 → 确认后保存（移动端支持长按保存） */
export function ShareModal({ device, calc, onClose }: ShareModalProps) {
  const toast = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  const open = device !== null && calc !== null;

  useEffect(() => {
    if (!open || !device || !calc) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setImageUrl(null);

    (async () => {
      try {
        const blob = await generateShareImage(device, calc);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setImageUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // 关闭或切换设备时释放旧的 blob URL
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [open, device, calc]);

  const handleSave = () => {
    if (!imageUrl || !device) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `设备摊销-${device.name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('图片已保存', 'success');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="w-[min(560px,calc(100vw-32px))]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>分享卡片预览</DialogTitle>
          <DialogDescription>确认效果后再保存，可直接发送给朋友</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3">
          {loading && (
            <div className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-line bg-muted/50 text-ink-3">
              <Icon name="refresh" size={22} className="animate-spin" />
              <span className="text-[12.5px]">正在生成图片…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-line bg-muted/50 text-[13px] text-ink-3">
              图片生成失败，请关闭后重试
            </div>
          )}

          {imageUrl && !loading && (
            <img
              src={imageUrl}
              alt="分享卡片预览"
              className="mx-auto block w-full max-w-[420px] rounded-lg border border-line shadow-[0_8px_24px_-12px_rgba(10,37,64,.2)]"
            />
          )}

          <p className="mt-3 text-center text-[11.5px] text-ink-4">
            手机端也可以长按图片保存到相册
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button onClick={handleSave} disabled={!imageUrl || loading}>
            <Icon name="download" size={14} />
            保存图片
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
