import { useState } from 'react';
import type { Device } from '../types';
import { STORAGE_HARD_BYTES, fmtBytes } from '../data/storage';
import type { SaveState } from '../hooks/useDevices';
import { Button } from './ui/button';
import { Icon } from './Icon';

interface StorageBannerProps {
  save: SaveState;
  devices: Device[];
  onExport: (withImages: boolean) => void;
  onSlim: () => void;
  slimming: boolean;
}

/**
 * 本地存储告警条。
 *
 * 存在的意义只有一个：**localStorage 写失败时不能悄无声息**。
 * 图片以 base64 存在本地，是唯一会撑爆配额的量；一旦超限，
 * 整份设备数据都写不进去，用户却在界面上看不出任何异常。
 */
export function StorageBanner({
  save,
  devices,
  onExport,
  onSlim,
  slimming,
}: StorageBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (save.level === 'ok') return null;
  if (save.level === 'warn' && dismissed) return null;

  const failed = save.level === 'failed';
  const noImages = !devices.some((d) => d.image);

  return (
    <div
      className={
        failed
          ? 'mb-4 rounded-xl border border-red/35 bg-[#fdf6f5] px-4 py-3.5'
          : 'mb-4 rounded-xl border border-[#ecd9b8] bg-[#fdfaf3] px-4 py-3.5'
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ' +
            (failed ? 'bg-red/12 text-red' : 'bg-amber/15 text-amber')
          }
        >
          <Icon name="alert" size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <div className={'text-[13px] font-semibold ' + (failed ? 'text-red' : 'text-amber')}>
            {failed
              ? save.reason === 'quota'
                ? '存不进去了：本地存储空间已满'
                : '本地数据保存失败'
              : `本地存储已用 ${fmtBytes(save.bytes)}，接近上限`}
          </div>

          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
            {failed ? (
              <>
                <b className="font-semibold text-ink">
                  {save.reason === 'quota'
                    ? `最新一次改动还没落盘（本次需要 ${fmtBytes(save.bytes)}）`
                    : (save.message ?? '原因未知')}
                </b>
                。请先<b className="font-semibold text-ink">导出备份</b>把数据拿到手，
                再压缩图片腾出空间。设备照片是 base64 存在浏览器里的，也是唯一吃空间的东西。
              </>
            ) : (
              <>
                继续添加带照片的设备，随时可能写不进去。
                建议先导出一份备份，或压缩已有照片释放空间。
              </>
            )}
          </p>

          {failed && (
            <div className="mt-2 text-[11.5px] text-ink-4">
              注意：在保存恢复之前，刷新页面会丢失最新改动。
            </div>
          )}

          {/* 用量进度：以硬线为分母，直观看到离写不进去还有多远 */}
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-black/[0.07]">
              <span
                className={
                  'block h-full rounded-full ' + (failed ? 'bg-red' : 'bg-amber')
                }
                style={{ width: `${Math.min(100, (save.bytes / STORAGE_HARD_BYTES) * 100).toFixed(1)}%` }}
              />
            </span>
            <span className="shrink-0 text-[11px] text-ink-3 tabular-nums">
              {fmtBytes(save.bytes)} / {fmtBytes(STORAGE_HARD_BYTES)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={failed ? 'default' : 'outline'} onClick={() => onExport(true)}>
              <Icon name="download" size={13} />
              导出完整备份
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onExport(false)}>
              导出轻量备份（不含照片）
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={slimming || noImages}
              onClick={onSlim}
            >
              <Icon name="refresh" size={13} className={slimming ? 'animate-spin' : undefined} />
              {slimming ? '压缩中…' : '压缩照片腾空间'}
            </Button>
            {!failed && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                知道了
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
