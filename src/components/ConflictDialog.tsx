import type { ConflictState } from '../hooks/useSync';
import { Icon } from './Icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ConflictDialogProps {
  conflict: ConflictState | null;
  syncing: boolean;
  onResolve: (choice: 'local' | 'cloud') => void;
  onDismiss: () => void;
}

/** 同步冲突：云端与本地都发生了变更，让用户选择保留哪一份 */
export function ConflictDialog({ conflict, syncing, onResolve, onDismiss }: ConflictDialogProps) {
  return (
    <Dialog
      open={conflict !== null}
      onOpenChange={(v) => {
        if (!v) onDismiss();
      }}
    >
      <DialogContent className="w-[min(500px,calc(100vw-32px))]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>数据不一致</DialogTitle>
          <DialogDescription>
            云端数据在另一台设备上更新过，而本机也有新改动。请选择保留哪一份，未保留的一份将被覆盖。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 px-6 pt-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => onResolve('local')}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line px-4 py-5 text-center transition-colors outline-none hover:border-ink hover:bg-muted/50 focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7 disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon name="laptop" size={22} className="text-ink-2" />
            <span className="mt-1 text-[13.5px] font-semibold text-ink">保留本地数据</span>
            <span className="text-xs text-ink-4">
              本机 {conflict?.localDevices ?? 0} 台设备 · {conflict?.localLoans ?? 0} 笔贷款
            </span>
            <span className="text-[11px] text-amber">将覆盖云端</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => onResolve('cloud')}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line px-4 py-5 text-center transition-colors outline-none hover:border-ink hover:bg-muted/50 focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/7 disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon name="cloud" size={22} className="text-ink-2" />
            <span className="mt-1 text-[13.5px] font-semibold text-ink">使用云端数据</span>
            <span className="text-xs text-ink-4">
              云端 {conflict?.serverDevices.length ?? 0} 台设备 · {conflict?.serverLoans.length ?? 0}{' '}
              笔贷款
            </span>
            <span className="text-[11px] text-amber">将覆盖本机</span>
          </button>
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-[11px] text-ink-4">
            建议先「导出」备份后再选择
          </span>
          <button
            type="button"
            disabled={syncing}
            onClick={onDismiss}
            className="cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-hover hover:text-ink disabled:opacity-50"
          >
            稍后处理
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
