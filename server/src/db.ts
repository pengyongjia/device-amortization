import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from './env';

const dbFile = resolve(process.cwd(), env.dbPath);
mkdirSync(dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    created_at    INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL
  );

  -- 登录验证码：一个邮箱同时只有一条有效记录，重新获取即覆盖旧码
  CREATE TABLE IF NOT EXISTS login_codes (
    email       TEXT PRIMARY KEY,
    code_hash   TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    used_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_docs (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    revision   INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_login_codes_expires ON login_codes(expires_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

/* ---------------- 类型 ---------------- */

export interface UserRow {
  id: string;
  email: string;
  created_at: number;
  last_login_at: number;
}

export interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
}

export interface SyncDocRow {
  user_id: string;
  data: string;
  updated_at: number;
  revision: number;
}

/* ---------------- users ---------------- */

const selUserByEmail = db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?');
const selUserById = db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?');
const insUser = db.prepare(
  'INSERT INTO users (id, email, created_at, last_login_at) VALUES (?, ?, ?, ?)',
);
const updUserLogin = db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');

export function upsertUser(email: string, now = Date.now()): UserRow {
  const existing = selUserByEmail.get(email);
  if (existing) {
    updUserLogin.run(now, existing.id);
    return { ...existing, last_login_at: now };
  }
  const id = crypto.randomUUID();
  insUser.run(id, email, now, now);
  return { id, email, created_at: now, last_login_at: now };
}

export function getUserById(id: string): UserRow | undefined {
  return selUserById.get(id);
}

/* ---------------- login_codes（邮箱验证码） ---------------- */

export interface LoginCodeRow {
  email: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  created_at: number;
  used_at: number | null;
}

const upsertCode = db.prepare(`
  INSERT INTO login_codes (email, code_hash, expires_at, attempts, created_at, used_at)
  VALUES (?, ?, ?, 0, ?, NULL)
  ON CONFLICT(email) DO UPDATE SET
    code_hash  = excluded.code_hash,
    expires_at = excluded.expires_at,
    attempts   = 0,
    created_at = excluded.created_at,
    used_at    = NULL
`);
const selCode = db.prepare<[string], LoginCodeRow>('SELECT * FROM login_codes WHERE email = ?');
const bumpCodeAttempts = db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?');
const markCodeUsed = db.prepare('UPDATE login_codes SET used_at = ? WHERE email = ?');
const delStaleCodes = db.prepare(
  'DELETE FROM login_codes WHERE expires_at < ? OR used_at IS NOT NULL',
);

/** 写入 / 覆盖某邮箱的验证码（同邮箱同时只保留最新一条，旧码立即失效） */
export function saveLoginCode(
  email: string,
  codeHash: string,
  expiresAt: number,
  now = Date.now(),
): void {
  // 顺手清理：已过期或已使用过的记录
  delStaleCodes.run(now);
  upsertCode.run(email, codeHash, expiresAt, now);
}

export type CodeStatus = 'ok' | 'invalid' | 'expired' | 'too_many' | 'missing';

export interface CodeVerifyOutcome {
  status: CodeStatus;
  /** 本次校验后还剩几次尝试机会（status = ok 时无意义） */
  attemptsLeft: number;
}

/**
 * 校验验证码。成功即消费（单次有效）。
 * 输错会累加计数，达到 maxAttempts 后该码作废，必须重新获取。
 */
export function verifyLoginCode(
  email: string,
  codeHash: string,
  maxAttempts: number,
  now = Date.now(),
): CodeVerifyOutcome {
  const row = selCode.get(email);
  if (!row || row.used_at !== null) return { status: 'missing', attemptsLeft: 0 };
  if (row.expires_at < now) return { status: 'expired', attemptsLeft: 0 };
  if (row.attempts >= maxAttempts) return { status: 'too_many', attemptsLeft: 0 };

  if (row.code_hash !== codeHash) {
    bumpCodeAttempts.run(email);
    return { status: 'invalid', attemptsLeft: Math.max(0, maxAttempts - row.attempts - 1) };
  }

  markCodeUsed.run(now, email);
  return { status: 'ok', attemptsLeft: 0 };
}

/* ---------------- sessions ---------------- */

const insSession = db.prepare(
  'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
);
const selSession = db.prepare<[string], SessionRow>('SELECT * FROM sessions WHERE token_hash = ?');
const touchSessionStmt = db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?');
const delSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const delExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

export function createSession(
  tokenHash: string,
  userId: string,
  expiresAt: number,
  now = Date.now(),
): void {
  delExpiredSessions.run(now);
  insSession.run(tokenHash, userId, now, expiresAt, now);
}

/** 校验会话；有效时顺带刷新 last_seen_at（保活，滑动过期不启用，仅记录活跃） */
export function getValidSession(tokenHash: string, now = Date.now()): SessionRow | null {
  const row = selSession.get(tokenHash);
  if (!row || row.expires_at < now) return null;
  touchSessionStmt.run(now, tokenHash);
  return row;
}

export function deleteSession(tokenHash: string): void {
  delSession.run(tokenHash);
}

/* ---------------- sync_docs ---------------- */

const selSync = db.prepare<[string], SyncDocRow>('SELECT * FROM sync_docs WHERE user_id = ?');
const insSync = db.prepare(
  'INSERT INTO sync_docs (user_id, data, updated_at, revision) VALUES (?, ?, ?, 1)',
);
const updSync = db.prepare(
  'UPDATE sync_docs SET data = ?, updated_at = ?, revision = revision + 1 WHERE user_id = ?',
);

export function getSyncDoc(userId: string): SyncDocRow | undefined {
  return selSync.get(userId);
}

/** 保存同步文档（覆盖式），返回新的 updatedAt 与 revision */
export function saveSyncDoc(
  userId: string,
  data: string,
  now = Date.now(),
): { updatedAt: number; revision: number } {
  const existing = selSync.get(userId);
  if (existing) {
    updSync.run(data, now, userId);
    return { updatedAt: now, revision: existing.revision + 1 };
  }
  insSync.run(userId, data, now);
  return { updatedAt: now, revision: 1 };
}

/* ---------------- 运维统计（只读，供 /api/admin/stats 使用） ---------------- */

export interface AdminUserRow {
  email: string;
  createdAt: number;
  lastLoginAt: number;
  /** 云端设备条数；从未同步过为 null */
  syncedDevices: number | null;
  /** 云端数据最后更新时间 */
  syncedAt: number | null;
  revision: number | null;
}

export interface AdminStats {
  users: AdminUserRow[];
  totals: {
    users: number;
    sessions: number;
    syncDocs: number;
    loginCodes: number;
  };
}

const selAllUsers = db.prepare(
  'SELECT id, email, created_at, last_login_at FROM users ORDER BY created_at',
);
const cntAllSessions = db.prepare('SELECT COUNT(*) AS n FROM sessions');
const cntAllSyncDocs = db.prepare('SELECT COUNT(*) AS n FROM sync_docs');
const cntAllCodes = db.prepare('SELECT COUNT(*) AS n FROM login_codes');

export function getAdminStats(): AdminStats {
  const rows = selAllUsers.all() as {
    id: string;
    email: string;
    created_at: number;
    last_login_at: number;
  }[];

  const users: AdminUserRow[] = rows.map((u) => {
    const doc = selSync.get(u.id);
    let count: number | null = null;
    if (doc) {
      try {
        const parsed = JSON.parse(doc.data) as unknown;
        count = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        count = -1; // 数据不是合法 JSON，标记异常
      }
    }
    return {
      email: u.email,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      syncedDevices: count,
      syncedAt: doc ? doc.updated_at : null,
      revision: doc ? doc.revision : null,
    };
  });

  return {
    users,
    totals: {
      users: rows.length,
      sessions: (cntAllSessions.get() as { n: number }).n,
      syncDocs: (cntAllSyncDocs.get() as { n: number }).n,
      loginCodes: (cntAllCodes.get() as { n: number }).n,
    },
  };
}
