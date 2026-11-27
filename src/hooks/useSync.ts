import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { normalizeLoanRecord } from '../data/loans';
import { normalizeDevice } from '../data/storage';
import { ApiError, api } from '../lib/api';
import {
  SESSION_KEY,
  clearSession,
  loadSession,
  loadSyncMeta,
  saveSession,
  saveSyncMeta,
} from '../lib/session';
import type { Device, LoanRecord } from '../types';

export interface ConflictState {
  /** 本机设备数 */
  localDevices: number;
  /** 本机贷款数 */
  localLoans: number;
  serverDevices: Device[];
  serverLoans: LoanRecord[];
  serverUpdatedAt: number;
}

export interface SyncController {
  /** off = 未开启云同步；active = 已登录 */
  status: 'off' | 'active';
  email: string | null;
  syncing: boolean;
  lastSyncedAt: number | null;
  conflict: ConflictState | null;
  /** 用「邮箱 + 验证码」完成登录（并在成功后执行首次同步） */
  login: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 手动同步 */
  syncNow: () => Promise<void>;
  resolveConflict: (choice: 'local' | 'cloud') => Promise<void>;
  /** 暂时搁置冲突（不改动任何数据，下次同步时会再次提示） */
  dismissConflict: () => void;
}

const UPLOAD_DEBOUNCE_MS = 8000;

/** 归一化设备列表（保持"新建数据"和"存储加载数据"指纹一致） */
function normalizeDevices(list: Device[]): Device[] {
  return list.map((d) => normalizeDevice(d as unknown as Record<string, unknown>));
}

/** 归一化贷款列表，丢弃无效记录 */
function normalizeLoans(list: LoanRecord[]): LoanRecord[] {
  return list
    .map((l) => normalizeLoanRecord(l as unknown as Record<string, unknown>))
    .filter((x): x is LoanRecord => x !== null);
}

/** 同步载荷：设备 + 贷款一起算指纹，任一项变化都能被识别 */
function buildPayload(devices: Device[], loans: LoanRecord[]) {
  return {
    version: 2 as const,
    devices: normalizeDevices(devices),
    loans: normalizeLoans(loans),
  };
}

/** djb2 指纹 */
function hashPayload(devices: Device[], loans: LoanRecord[]): string {
  const s = JSON.stringify(buildPayload(devices, loans));
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/**
 * 兼容云端历史数据：
 * - v2：{ version, devices, loans }
 * - v1（早期版本）：Device[] 数组
 */
function parseRemote(raw: unknown): { devices: Device[]; loans: LoanRecord[] } {
  if (Array.isArray(raw)) return { devices: raw as Device[], loans: [] };
  if (raw && typeof raw === 'object') {
    const obj = raw as { devices?: unknown; loans?: unknown };
    return {
      devices: Array.isArray(obj.devices) ? (obj.devices as Device[]) : [],
      loans: Array.isArray(obj.loans) ? (obj.loans as LoanRecord[]) : [],
    };
  }
  return { devices: [], loans: [] };
}

/**
 * 云同步控制器（本地优先架构）：
 * - 未登录：零感知，数据只在本地
 * - 登录后：启动时比对云端、本地变更防抖自动上传、云端冲突交给用户选择
 * - 同步内容：设备 + 贷款（v2 起）
 */
export function useSync(
  devices: Device[],
  setDevices: (next: Device[]) => void,
  loans: LoanRecord[],
  setLoans: (next: LoanRecord[]) => void,
): SyncController {
  const toast = useToast();
  const initialSession = useRef(loadSession());
  const initialMeta = useRef(loadSyncMeta());

  const [status, setStatus] = useState<'off' | 'active'>(initialSession.current ? 'active' : 'off');
  const [email, setEmail] = useState<string | null>(initialSession.current?.email ?? null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(initialMeta.current.lastSyncedAt);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  // 最新值引用
  const devicesRef = useRef(devices);
  devicesRef.current = devices;
  const loansRef = useRef(loans);
  loansRef.current = loans;
  const lastSyncedRef = useRef<number | null>(initialMeta.current.lastSyncedAt);
  const lastHashRef = useRef<string | null>(initialMeta.current.lastSyncedHash);
  /** 标记"下一次数据变化来自云端拉取"，避免触发自动回传 */
  const suppressRef = useRef(false);
  const firstRenderRef = useRef(true);

  const setSynced = useCallback((at: number | null, hash: string | null) => {
    lastSyncedRef.current = at;
    lastHashRef.current = hash;
    setLastSyncedAt(at);
    saveSyncMeta({ lastSyncedAt: at, lastSyncedHash: hash });
  }, []);

  /** 用云端数据覆盖本地，返回归一化后的结果 */
  const applyRemote = useCallback(
    (remote: { devices: Device[]; loans: LoanRecord[] }) => {
      const nextDevices = normalizeDevices(remote.devices);
      const nextLoans = normalizeLoans(remote.loans);
      suppressRef.current = true;
      setDevices(nextDevices);
      setLoans(nextLoans);
      return { devices: nextDevices, loans: nextLoans };
    },
    [setDevices, setLoans],
  );

  const handleSyncError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.status === 409) {
          const payload = e.payload as {
            server?: { data: unknown; updatedAt: number };
          } | null;
          if (payload?.server) {
            const data = parseRemote(payload.server.data);
            setConflict({
              localDevices: devicesRef.current.length,
              localLoans: loansRef.current.length,
              serverDevices: data.devices,
              serverLoans: data.loans,
              serverUpdatedAt: payload.server.updatedAt,
            });
            return;
          }
        }
        if (e.status === 401) {
          clearSession();
          setStatus('off');
          setEmail(null);
          setSynced(null, null);
          toast('登录已过期，请重新登录', 'error');
          return;
        }
        toast(e.message, 'error');
        return;
      }
      toast('同步失败，请稍后重试', 'error');
    },
    [setSynced, toast],
  );

  /** 核心同步：比对本地/云端状态，自动选择上传、拉取或交给用户处理冲突 */
  const runSync = useCallback(
    async (token: string, opts: { silent?: boolean } = {}) => {
      const localDevices = devicesRef.current;
      const localLoans = loansRef.current;
      const localHash = hashPayload(localDevices, localLoans);
      const lastSynced = lastSyncedRef.current;
      const lastHash = lastHashRef.current;
      const hasLocal = localDevices.length > 0 || localLoans.length > 0;

      const remote = await api.pull(token);
      const remoteData = parseRemote(remote.data);
      const remoteUpdatedAt = remote.updatedAt;
      const hasRemote = remoteData.devices.length > 0 || remoteData.loans.length > 0;

      const cloudHas = remoteUpdatedAt != null;
      // 本地是否有未同步过的改动：从未同步过时以"有数据"为准
      const localDirty = lastHash === null ? hasLocal : localHash !== lastHash;

      // 1) 云端从未有数据
      if (!cloudHas) {
        if (hasLocal) {
          const r = await api.push(
            token,
            { version: 2, devices: localDevices, loans: localLoans },
            null,
          );
          setSynced(r.updatedAt, localHash);
          if (!opts.silent) toast('本地数据已同步到云端', 'success');
        } else if (!opts.silent) {
          toast('暂无数据可同步');
        }
        return;
      }

      const cloudChanged = !lastSynced || remoteUpdatedAt! > lastSynced;

      // 2) 云端有新变化
      if (cloudChanged) {
        if (!localDirty) {
          // 本地无改动 → 静默拉取云端
          const applied = applyRemote(remoteData);
          setSynced(remoteUpdatedAt!, hashPayload(applied.devices, applied.loans));
          if (!opts.silent) {
            toast(
              `已从云端同步 ${applied.devices.length} 台设备、${applied.loans.length} 笔贷款`,
              'success',
            );
          }
          return;
        }
        // 本地与云端都有改动 → 让用户选择
        setConflict({
          localDevices: localDevices.length,
          localLoans: localLoans.length,
          serverDevices: remoteData.devices,
          serverLoans: remoteData.loans,
          serverUpdatedAt: remoteUpdatedAt!,
        });
        return;
      }

      // 3) 云端未变、本地有改动 → 上传
      if (localDirty || (!hasRemote && hasLocal)) {
        const r = await api.push(
          token,
          { version: 2, devices: localDevices, loans: localLoans },
          remoteUpdatedAt,
        );
        setSynced(r.updatedAt, localHash);
        if (!opts.silent) toast('已同步到云端', 'success');
        return;
      }

      // 4) 两边一致
      if (!opts.silent) toast('已是最新状态');
    },
    [applyRemote, setSynced, toast],
  );

  /**
   * 登录（校验邮箱验证码）并执行首次同步。
   * 验证码错误等异常会向上抛出，由登录弹窗就地展示，避免「关掉弹窗才知道错」。
   */
  const login = useCallback(
    async (email: string, code: string) => {
      setSyncing(true);
      try {
        const { token, user } = await api.verify(email, code);
        saveSession({ token, email: user.email, userId: user.id });
        setStatus('active');
        setEmail(user.email);
        toast(`已登录：${user.email}`, 'success');
        // 首次同步失败不影响登录状态，只提示
        try {
          await runSync(token);
        } catch (e) {
          handleSyncError(e);
        }
      } finally {
        setSyncing(false);
      }
    },
    [handleSyncError, runSync, toast],
  );

  const logout = useCallback(async () => {
    const session = loadSession();
    if (session) {
      api.logout(session.token).catch(() => {
        /* 网络失败也允许本地登出 */
      });
    }
    clearSession();
    setStatus('off');
    setEmail(null);
    setSynced(null, null);
    setConflict(null);
    toast('已退出同步（本地数据保留）', 'success');
  }, [setSynced, toast]);

  const syncNow = useCallback(async () => {
    const session = loadSession();
    if (!session) return;
    setSyncing(true);
    try {
      await runSync(session.token);
    } catch (e) {
      handleSyncError(e);
    } finally {
      setSyncing(false);
    }
  }, [handleSyncError, runSync]);

  const resolveConflict = useCallback(
    async (choice: 'local' | 'cloud') => {
      const session = loadSession();
      if (!session || !conflict) return;
      setSyncing(true);
      try {
        if (choice === 'local') {
          const r = await api.push(
            session.token,
            { version: 2, devices: devicesRef.current, loans: loansRef.current },
            null,
          );
          setSynced(r.updatedAt, hashPayload(devicesRef.current, loansRef.current));
          toast('已用本地数据覆盖云端', 'success');
        } else {
          const applied = applyRemote({
            devices: conflict.serverDevices,
            loans: conflict.serverLoans,
          });
          setSynced(conflict.serverUpdatedAt, hashPayload(applied.devices, applied.loans));
          toast('已使用云端数据', 'success');
        }
      } catch (e) {
        handleSyncError(e);
      } finally {
        setConflict(null);
        setSyncing(false);
      }
    },
    [applyRemote, conflict, handleSyncError, setSynced, toast],
  );

  /** 启动时：校验会话 + 比对云端更新（多设备场景自动拉取） */
  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    (async () => {
      try {
        await api.me(session.token);
        await runSync(session.token, { silent: true });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          setStatus('off');
          setEmail(null);
          setSynced(null, null);
        }
        // 网络不可用时静默，不影响本地使用
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 本地数据变更 → 防抖自动上传（跳过云端拉取导致的变化） */
  useEffect(() => {
    if (status !== 'active') return;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      const session = loadSession();
      if (!session) return;
      try {
        const hash = hashPayload(devicesRef.current, loansRef.current);
        const r = await api.push(
          session.token,
          { version: 2, devices: devicesRef.current, loans: loansRef.current },
          lastSyncedRef.current,
        );
        setSynced(r.updatedAt, hash);
      } catch (e) {
        handleSyncError(e);
      }
    }, UPLOAD_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [devices, loans, status, handleSyncError, setSynced]);

  /** 跨标签页：在任意标签页完成登录后，其余标签页自动跟进 */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY || !e.newValue) return;
      const session = loadSession();
      if (!session) return;
      setStatus('active');
      setEmail(session.email);
      setSyncing(true);
      runSync(session.token, { silent: true })
        .catch(() => undefined)
        .finally(() => setSyncing(false));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [runSync]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  return {
    status,
    email,
    syncing,
    lastSyncedAt,
    conflict,
    login,
    logout,
    syncNow,
    resolveConflict,
    dismissConflict,
  };
}
