/**
 * 云同步相关的本地存储：
 * - 会话（登录凭证，180 天有效，持久免登录）
 * - 同步元数据（上次同步时间，用于多设备更新检测与冲突基版本）
 */

export const SESSION_KEY = 'device-amortization-session';
const META_KEY = 'device-amortization-sync-meta';

export interface StoredSession {
  token: string;
  email: string;
  userId: string;
  savedAt: number;
}

interface SyncMeta {
  lastSyncedAt: number | null;
  /** 上次成功同步时的数据指纹（用于区分"本地有新修改"和"本地未变"） */
  lastSyncedHash: string | null;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s && typeof s.token === 'string' && s.token ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Omit<StoredSession, 'savedAt'>): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(META_KEY);
}

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { lastSyncedAt: null, lastSyncedHash: null };
    const m = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      lastSyncedAt: typeof m.lastSyncedAt === 'number' ? m.lastSyncedAt : null,
      lastSyncedHash: typeof m.lastSyncedHash === 'string' ? m.lastSyncedHash : null,
    };
  } catch {
    return { lastSyncedAt: null, lastSyncedHash: null };
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}
