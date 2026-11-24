import type { Device } from '../types';

/**
 * 后端 API client。地址解析优先级：
 * 1. VITE_API_BASE 环境变量（构建时显式指定）
 * 2. 开发模式（vite dev）：固定 http://localhost:8787
 * 3. 生产构建但运行在本机（端口非 8787）：自动指向本地后端，方便本地预览联调
 * 4. 真实部署：空串 = 同域相对路径（配合反向代理 /api → 后端）
 */
function resolveApiBase(): string {
  const explicit = import.meta.env.VITE_API_BASE as string | undefined;
  if (explicit) return explicit;
  if (import.meta.env.DEV) return 'http://localhost:8787';
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '8787') {
      return 'http://localhost:8787';
    }
  }
  return '';
}

const API_BASE = resolveApiBase();

/**
 * 会话令牌的请求头名称，须与服务端 `SESSION_HEADER` 一致。
 * 不用标准的 Authorization：部分托管平台的入口网关会把该头替换成
 * 平台自己的身份 JWT，导致自己的会话令牌到不了服务端。
 */
export const SESSION_HEADER = 'X-Session-Token';

export class ApiError extends Error {
  status: number;
  code: string;
  payload: unknown;

  constructor(status: number, code: string, message: string, payload: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

interface ErrorBody {
  error?: string;
  message?: string;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { [SESSION_HEADER]: token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network_error', '无法连接同步服务器，请确认后端已启动', null);
  }

  const data = (await res.json().catch(() => null)) as (T & ErrorBody) | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error ?? 'http_error',
      data?.message ?? `请求失败（${res.status}）`,
      data,
    );
  }
  return data as T;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface SyncDoc {
  data: Device[] | null;
  updatedAt: number | null;
  revision: number;
}

/** 请求验证码的返回体 */
export interface CodeRequestResult {
  ok: boolean;
  /** 是否真的发出了邮件 */
  sent: boolean;
  /** 服务端是否配置了邮件通道；false 表示处于演示模式 */
  mailConfigured: boolean;
  /** 演示模式专用：验证码明文（生产环境不会有） */
  devCode?: string;
  codeLength: number;
  expiresInMinutes: number;
  maxAttempts: number;
}

export const api = {
  /** 请求登录验证码；演示模式下返回 devCode 供界面直接填入 */
  requestLoginCode: (email: string) =>
    request<CodeRequestResult>('/api/auth/request', {
      method: 'POST',
      body: { email },
    }),

  /** 用「邮箱 + 验证码」换取会话 */
  verify: (email: string, code: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/verify', {
      method: 'POST',
      body: { email, code },
    }),

  /** 校验会话并获取用户信息 */
  me: (token: string) =>
    request<{ user: AuthUser; sync: { updatedAt: number; revision: number } | null }>(
      '/api/auth/me',
      { token },
    ),

  logout: (token: string) => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token }),

  /** 拉取云端数据 */
  pull: (token: string) => request<SyncDoc>('/api/sync', { token }),

  /** 上传数据（baseUpdatedAt 用于冲突检测；传 null 表示强制覆盖） */
  push: (token: string, data: Device[], baseUpdatedAt: number | null) =>
    request<{ ok: boolean; updatedAt: number; revision: number }>('/api/sync', {
      method: 'PUT',
      token,
      body: { data, baseUpdatedAt },
    }),
};
