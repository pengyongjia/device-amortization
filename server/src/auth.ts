import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { getValidSession } from './db';

/** 生成 64 位十六进制随机令牌（会话令牌用） */
export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

/** 令牌散列：数据库中只存 sha256，即使数据泄露也无法直接登录 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 登录验证码位数 */
export const CODE_LENGTH = 6;

/**
 * 生成 6 位数字登录验证码。
 * 从 100000 起，避免出现前导零（用户手抄时容易漏掉）。
 */
export function randomCode(): string {
  return String(randomInt(100000, 1_000_000));
}

/**
 * 验证码散列 = sha256("login-code:" + 邮箱 + ":" + 验证码)。
 *
 * 特意把邮箱拌进散列输入：验证码空间只有 90 万，
 * 若直接存 sha256(code)，拿到库的人用一张预计算表即可瞬间反查。
 * 混入邮箱后预计算失效，每个邮箱都得单独爆破。
 */
export function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`login-code:${email}:${code}`).digest('hex');
}

/** 定长十六进制字符串的恒定时间比较（防时序侧信道） */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export type AuthEnv = {
  Variables: {
    userId: string;
  };
};

/**
 * 会话令牌的请求头名称。
 *
 * 故意不用标准的 `Authorization`：部分托管平台的入口网关会把这个头
 * 替换成平台自己的身份 JWT（实测 WorkBuddy 沙箱即如此，客户端发来的
 * 64 位令牌到服务端会变成 379 字符的 eyJhbGci…）。自定义头不受影响。
 */
export const SESSION_HEADER = 'x-session-token';

/**
 * 从请求中提取会话令牌。取值优先级：
 *  1. `X-Session-Token`（推荐，可穿透会改写 Authorization 的网关）
 *  2. `Authorization: Bearer <token>`（本地开发 / 通用反向代理场景的兼容路径）
 */
export function readSessionToken(getHeader: (name: string) => string | undefined): string {
  const custom = getHeader(SESSION_HEADER);
  if (custom) return custom.trim();

  const auth = getHeader('authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

/** 鉴权中间件：校验会话令牌（见 readSessionToken 的取值优先级） */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = readSessionToken((name) => c.req.header(name));
  if (!token) return c.json({ error: 'unauthorized', message: '缺少登录凭证' }, 401);

  const session = getValidSession(hashToken(token));
  if (!session) return c.json({ error: 'unauthorized', message: '登录已过期，请重新登录' }, 401);

  c.set('userId', session.user_id);
  await next();
});

/* ---------------- 简易内存限流 ---------------- */

const hits = new Map<string, number[]>();

/**
 * 简单滑动窗口限流（进程内，适合单实例部署）。
 * @returns true 表示被限流
 */
export function isRateLimited(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  // 懒清理，防止 Map 无限增长
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
  }
  return false;
}
