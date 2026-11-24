import { Icon } from './Icon';
import { Button } from './ui/button';

interface HeaderProps {
  onAdd: () => void;
  /** 云同步状态 */
  syncStatus: 'off' | 'active';
  syncEmail: string | null;
  syncing: boolean;
  onOpenSync: () => void;
}

export function Header({ onAdd, syncStatus, syncEmail, syncing, onOpenSync }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-7 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-[14px] font-semibold text-white sm:h-[30px] sm:w-[30px] sm:text-[15px]">
            ¥
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] leading-tight font-semibold tracking-[-0.01em]">
              设备摊销
            </h1>
            <p className="mt-0.5 hidden truncate text-[11.5px] text-ink-4 sm:block">
              追踪每台电子设备的每日真实成本
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-10 w-10 px-0 sm:h-9 sm:w-auto sm:px-3"
            title={
              syncStatus === 'active'
                ? `云同步已开启：${syncEmail ?? ''}`
                : '开启云同步：多设备间自动同步数据'
            }
            onClick={onOpenSync}
          >
            {syncing ? (
              <Icon name="refresh" size={16} className="animate-spin" />
            ) : (
              <Icon name="cloud" size={16} />
            )}
            <span className="hidden sm:inline">云同步</span>
            {syncStatus === 'active' && (
              <span className="h-[6px] w-[6px] rounded-full bg-green" />
            )}
          </Button>
          <Button className="h-10 px-3.5 sm:h-9" onClick={onAdd}>
            <Icon name="plus" size={16} />
            <span className="sm:hidden">添加</span>
            <span className="hidden sm:inline">添加设备</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
