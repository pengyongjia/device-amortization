import { useMemo, useEffect, useRef, useState } from 'react';
import { buildDemoDevices } from './data/demo';
import { downloadBackup, fmtBytes } from './data/storage';
import { useDevices } from './hooks/useDevices';
import { useSync } from './hooks/useSync';
import { useToday } from './hooks/useToday';
import { useLoans } from './hooks/useLoans';
import { cn } from './lib/utils';
import type { Device, LoanRecord, TabId } from './types';
import { calcDevice } from './utils/calc';
import { calcLoanSchedule, summarizeLoans } from './utils/loanSchedule';
import { recompressDataUrl } from './utils/image';
import { useToast } from './components/Toast';
import { ConflictDialog } from './components/ConflictDialog';
import { Dashboard } from './components/Dashboard';
import { DeviceList } from './components/DeviceList';
import { DeviceModal } from './components/DeviceModal';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { StorageBanner } from './components/StorageBanner';
import { SyncModal } from './components/SyncModal';
import { LoansDashboard } from './components/LoansDashboard';
import { LoanModal } from './components/LoanModal';


export default function App() {
  const [devices, setDevices, save] = useDevices();
  const [loans, setLoans, loansSaveOk] = useLoans();
  /** 照片压缩进行中（存储告急时的自救动作） */
  const [slimming, setSlimming] = useState(false);
  const today = useToday();
  const toast = useToast();
  const sync = useSync(devices, setDevices);
  const [syncOpen, setSyncOpen] = useState(false);

  // 首次使用（无任何设备）时直接进入带引导的设备列表页
  const [tab, setTab] = useState<TabId>(devices.length ? 'dashboard' : 'devices');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  // 贷款弹窗状态
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);

  // 贷款还款计划（随今天自动推进）
  const loanSchedules = useMemo(() => loans.map((l) => calcLoanSchedule(l, today)), [loans, today]);
  const loansSummary = useMemo(
    () => summarizeLoans(loans, loanSchedules),
    [loans, loanSchedules],
  );

  // 摊销计算：设备列表或"今天"变化时自动重算，每天零点全站自动更新
  const list = useMemo(
    () => devices.map((device) => ({ device, calc: calcDevice(device, today) })),
    [devices, today],
  );

  // 跨日提示
  const prevDayRef = useRef(today.getTime());
  useEffect(() => {
    if (prevDayRef.current !== today.getTime()) {
      prevDayRef.current = today.getTime();
      toast('📅 新的一天，已自动更新所有设备的摊销天数', 'success');
    }
  }, [today, toast]);

  const handleSave = (device: Device) => {
    setDevices((prev) => {
      const idx = prev.findIndex((d) => d.id === device.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = device;
        return next;
      }
      return [...prev, device];
    });
  };

  const handleDelete = (device: Device) => {
    if (!confirm(`确定删除「${device.name}」吗？该操作不可撤销。`)) return;
    setDevices((prev) => prev.filter((d) => d.id !== device.id));
    toast('已删除');
  };

  /** 导出备份。withImages=false 走轻量档，专供存储告急时先抢救文字数据 */
  const exportBackup = (withImages: boolean) => {
    if (!devices.length && !loans.length) return toast('暂无可导出的数据', 'error');
    downloadBackup(devices, withImages, loans);
    toast(withImages ? '已导出完整备份（含照片）' : '已导出轻量备份（不含照片）', 'success');
  };

  /* ---------------- 贷款操作 ---------------- */
  const openAddLoan = () => {
    setEditingLoan(null);
    setLoanModalOpen(true);
  };
  const openEditLoan = (loan: LoanRecord) => {
    setEditingLoan(loan);
    setLoanModalOpen(true);
  };
  const handleSaveLoan = (loan: LoanRecord) => {
    setLoans((prev) => {
      const idx = prev.findIndex((l) => l.id === loan.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = loan;
        return next;
      }
      return [...prev, loan];
    });
    if (!loansSaveOk) toast('贷款已保存，但本地存储写入失败，请检查空间', 'error');
    else toast(editingLoan ? '贷款已更新' : '贷款已添加', 'success');
    setLoanModalOpen(false);
  };
  const handleDeleteLoan = (loan: LoanRecord) => {
    if (!confirm(`确定删除「${loan.name}」吗？该操作不可撤销。`)) return;
    setLoans((prev) => prev.filter((l) => l.id !== loan.id));
    toast('已删除');
  };

  /**
   * 压缩全部设备照片以释放本地存储空间。
   * 只保留确实变小了的结果，压不动的保持原样。
   */
  const handleSlim = async () => {
    const targets = devices.filter((d) => d.image);
    if (!targets.length) return toast('没有可压缩的照片', 'error');
    if (!confirm(`将重新压缩 ${targets.length} 张设备照片以释放空间，画面会略微变小。继续吗？`)) return;

    setSlimming(true);
    try {
      const results = await Promise.all(
        devices.map(async (d) =>
          d.image ? { id: d.id, image: await recompressDataUrl(d.image) } : null,
        ),
      );
      const shrunk = results.filter((r) => r?.image).length;
      if (!shrunk) return toast('照片已经足够小，无需压缩', 'success');

      const map = new Map(results.filter((r) => r?.image).map((r) => [r!.id, r!.image!]));
      setDevices((prev) => prev.map((d) => (map.has(d.id) ? { ...d, image: map.get(d.id)! } : d)));
      toast(`已压缩 ${shrunk} 张照片，空间已释放`, 'success');
    } catch {
      toast('压缩过程中出错，数据未改动', 'error');
    } finally {
      setSlimming(false);
    }
  };

  /** 一键载入示例数据（示例照片需先拉取并压缩成 dataURL，给个即时反馈避免以为没反应） */
  const handleLoadDemo = async () => {
    if (devices.length && !confirm('载入示例数据将覆盖当前记录，确定继续吗？')) return;
    toast('正在准备示例数据…');
    try {
      const demo = await buildDemoDevices();
      setDevices(demo);
      setTab('devices');
      toast(`已载入 ${demo.length} 台示例设备，可直接修改或删除`, 'success');
    } catch {
      toast('示例数据载入失败，请重试', 'error');
    }
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (device: Device) => {
    setEditing(device);
    setModalOpen(true);
  };

  return (
    <>
      <Header
        onAdd={openAdd}
        syncStatus={sync.status}
        syncEmail={sync.email}
        syncing={sync.syncing}
        onOpenSync={() => setSyncOpen(true)}
      />

      <nav className="mx-auto flex w-full max-w-[1120px] gap-0 border-b border-line px-4 sm:gap-7 sm:px-7">
        <button
          className={cn(
            '-mb-px inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 border-transparent py-3.5 text-[13.5px] font-medium text-ink-3 transition-colors hover:text-ink sm:flex-none sm:justify-start sm:py-3',
            tab === 'dashboard' && 'border-ink font-semibold text-ink',
          )}
          onClick={() => setTab('dashboard')}
        >
          <Icon name="chart" size={15} />
          总览
        </button>
        <button
          className={cn(
            '-mb-px inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 border-transparent py-3.5 text-[13.5px] font-medium text-ink-3 transition-colors hover:text-ink sm:flex-none sm:justify-start sm:py-3',
            tab === 'devices' && 'border-ink font-semibold text-ink',
          )}
          onClick={() => setTab('devices')}
        >
          <Icon name="box" size={15} />
          设备列表
        </button>
        <button
          className={cn(
            '-mb-px inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 border-transparent py-3.5 text-[13.5px] font-medium text-ink-3 transition-colors hover:text-ink sm:flex-none sm:justify-start sm:py-3',
            tab === 'loans' && 'border-ink font-semibold text-ink',
          )}
          onClick={() => setTab('loans')}
        >
          <Icon name="wallet" size={15} />
          贷款
          {loansSummary.activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-ink-3">
              {loansSummary.activeCount}
            </span>
          )}
        </button>
      </nav>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-7 py-7">
        <StorageBanner
          save={save}
          devices={devices}
          onExport={exportBackup}
          onSlim={() => void handleSlim()}
          slimming={slimming}
        />
        {tab === 'dashboard' ? (
          <Dashboard list={list} today={today} />
        ) : tab === 'loans' ? (
          <LoansDashboard
            loans={loans}
            schedules={loanSchedules}
            summary={loansSummary}
            onAdd={openAddLoan}
            onEdit={openEditLoan}
            onDelete={handleDeleteLoan}
          />
        ) : (
          <DeviceList
            list={list}
            hasDevices={devices.length > 0}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAdd={openAdd}
            onLoadDemo={handleLoadDemo}
          />
        )}
      </main>

      <footer className="px-5 pt-7 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center text-xs text-ink-4">
        <p>
          数据仅保存在本地浏览器 · 本地占用{' '}
          <span className="tabular-nums">{fmtBytes(save.bytes)}</span> · 建议定期使用「导出」备份
        </p>
      </footer>

      <DeviceModal
        open={modalOpen}
        device={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      />

      <LoanModal
        open={loanModalOpen}
        loan={editingLoan}
        onClose={() => setLoanModalOpen(false)}
        onSubmit={handleSaveLoan}
      />

      <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} sync={sync} />

      <ConflictDialog
        conflict={sync.conflict}
        syncing={sync.syncing}
        onResolve={(choice) => void sync.resolveConflict(choice)}
        onDismiss={sync.dismissConflict}
      />
    </>
  );
}
