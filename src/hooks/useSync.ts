import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
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
import type { Device } from '../types';

export interface ConflictState {
  localCount: number;
  serverDevices: Device[];
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

/**
 * 设备列表数据指纹（djb2），用于区分"本地有新修改"与"本地未变"。
 * 先归一化再计算：保证"新建的数据"与"刷新后从存储加载的数据"指纹一致，
 * 避免每次刷新误判为有修改而触发冗余上传。
 */
function hashDevices(list: Device[]): string {
  const normalized = list.map((d) => normalizeDevice(d as unknown as Record<string, unknown>));
  const s = JSON.stringify(normalized);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/**
 * 云同步控制器（本地优先架构）：
 * - 未登录：零感知，数据只在本地
 * - 登录后：启动时比对云端、本地变更防抖自动上传、云端冲突交给用户选择
 */
export function useSync(devices: Device[], setDevices: (next: Device[]) => void): SyncController {
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
  const lastSyncedRef = useRef<number | null>(initialMeta.current.lastSyncedAt);
  const lastHashRef = useRef<string | null>(initialMeta.current.lastSyncedHash);
  /** 标记"下一次 devices 变化来自云端拉取"，避免触发自动回传 */
  const suppressRef = useRef(false);
  const firstRenderRef = useRef(true);

  const setSynced = useCallback((at: number | null, hash: string | null) => {
    lastSyncedRef.current = at;
    lastHashRef.current = hash;
    setLastSyncedAt(at);
    saveSyncMeta({ lastSyncedAt: at, lastSyncedHash: hash });
  }, []);

  /** 用云端数据覆盖本地，返回归一化后的数组 */
  const applyRemote = useCallback(
    (raw: Device[]): Device[] => {
      const normalized = raw.map((d) => normalizeDevice(d as unknown as Record<string, unknown>));
      suppressRef.current = true;
      setDevices(normalized);
      return normalized;
    },
    [setDevices],
  );

  const handleSyncError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.status === 409) {
          const payload = e.payload as { server?: { data: Device[]; updatedAt: number } } | null;
          if (payload?.server) {
            setConflict({
              localCount: devicesRef.current.length,
              serverDevices: payload.server.data,
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
      const local = devicesRef.current;
      const localHash = hashDevices(local);
      const lastSynced = lastSyncedRef.current;
      const lastHash = lastHashRef.current;

      const remote = await api.pull(token);
      const remoteDevices = Array.isArray(remote.data) ? remote.data : [];
      const remoteUpdatedAt = remote.updatedAt;

      const cloudHas = remoteUpdatedAt != null;
      // 本地是否有未同步过的改动：从未同步过时以"有数据"为准
      const localDirty = lastHash === null ? local.length > 0 : localHash !== lastHash;

      // 1) 云端从未有数据
      if (!cloudHas) {
        if (local.length > 0) {
          const r = await api.push(token, local, null);
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
          const normalized = applyRemote(remoteDevices);
          setSynced(remoteUpdatedAt!, hashDevices(normalized));
          if (!opts.silent) toast(`已从云端同步 ${normalized.length} 台设备`, 'success');
          return;
        }
        // 本地与云端都有改动 → 让用户选择
        setConflict({
          localCount: local.length,
          serverDevices: remoteDevices,
          serverUpdatedAt: remoteUpdatedAt!,
        });
        return;
      }

      // 3) 云端未变、本地有改动 → 上传
      if (localDirty) {
        const r = await api.push(token, local, remoteUpdatedAt);
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
          const r = await api.push(session.token, devicesRef.current, null);
          setSynced(r.updatedAt, hashDevices(devicesRef.current));
          toast('已用本地数据覆盖云端', 'success');
        } else {
          const normalized = applyRemote(conflict.serverDevices);
          setSynced(conflict.serverUpdatedAt, hashDevices(normalized));
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
        const hash = hashDevices(devicesRef.current);
        const r = await api.push(session.token, devicesRef.current, lastSyncedRef.current);
        setSynced(r.updatedAt, hash);
      } catch (e) {
        handleSyncError(e);
      }
    }, UPLOAD_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [devices, status, handleSyncError, setSynced]);

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
