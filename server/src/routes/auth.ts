import { Hono } from 'hono';
import {
  CODE_LENGTH,
  hashCode,
  hashToken,
  isRateLimited,
  randomCode,
  randomToken,
  readSessionToken,
  requireAuth,
  type AuthEnv,
} from '../auth';
import {
  createSession,
  deleteSession,
  getSyncDoc,
  getUserById,
  saveLoginCode,
  upsertUser,
  verifyLoginCode,
} from '../db';
import { env, mailConfigured } from '../env';
import { sendLoginMail } from '../mail';

export const authRoutes = new Hono<AuthEnv>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** 解析并校验请求体里的邮箱 */
function readEmail(raw: unknown): string | null {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** 请求登录验证码（无密码，邮件送达 6 位数字码） */
authRoutes.post('/request', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { email?: unknown } | null;
  const email = readEmail(body?.email);
  if (!email) return c.json({ error: 'bad_email', message: '邮箱格式不正确' }, 400);

  // 限流：同邮箱 1 分钟 1 次、1 小时 10 次；同 IP 1 分钟 10 次
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(`code-email:${email}`, 60_000, 1)) {
    return c.json({ error: 'rate_limited', message: '验证码刚发过，请 1 分钟后再试' }, 429);
  }
  if (isRateLimited(`code-email-hour:${email}`, 3600_000, 10)) {
    return c.json({ error: 'rate_limited', message: '今日获取次数过多，请 1 小时后再试' }, 429);
  }
  if (isRateLimited(`code-ip:${ip}`, 60_000, 10)) {
    return c.json({ error: 'rate_limited', message: '请求太频繁，请稍后再试' }, 429);
  }

  const code = randomCode();
  saveLoginCode(email, hashCode(email, code), Date.now() + env.codeTtlMinutes * 60_000);
  const { sent, devCode } = await sendLoginMail(email, code);

  return c.json({
    ok: true,
    sent,
    // 未配置发信通道时前端会展示演示模式提示
    mailConfigured,
    // 演示模式专用：仅在 devShowCode 开启时才有值
    devCode,
    codeLength: CODE_LENGTH,
    expiresInMinutes: env.codeTtlMinutes,
    maxAttempts: env.maxCodeAttempts,
  });
});

/** 校验邮箱 + 验证码，通过后签发会话（默认 180 天，持久免登录） */
authRoutes.post('/verify', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { email?: unknown; code?: unknown }
    | null;
  const email = readEmail(body?.email);
  if (!email) return c.json({ error: 'bad_email', message: '邮箱格式不正确' }, 400);

  const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
  if (!CODE_RE.test(code)) {
    return c.json({ error: 'bad_code', message: `请输入 ${CODE_LENGTH} 位数字验证码` }, 400);
  }

  // 限流：同邮箱 10 分钟 10 次（防止用脚本穷举）
  if (isRateLimited(`verify-email:${email}`, 600_000, 10)) {
    return c.json({ error: 'rate_limited', message: '尝试次数过多，请稍后再试' }, 429);
  }

  const outcome = verifyLoginCode(email, hashCode(email, code), env.maxCodeAttempts);

  if (outcome.status === 'expired') {
    return c.json({ error: 'code_expired', message: '验证码已过期，请重新获取' }, 400);
  }
  if (outcome.status === 'missing') {
    return c.json({ error: 'code_missing', message: '请先获取验证码' }, 400);
  }
  if (outcome.status === 'too_many') {
    return c.json(
      { error: 'code_too_many', message: '该验证码错误次数过多，请重新获取' },
      400,
    );
  }
  if (outcome.status !== 'ok') {
    return c.json(
      {
        error: 'code_invalid',
        message: `验证码不正确，还可尝试 ${outcome.attemptsLeft} 次`,
        attemptsLeft: outcome.attemptsLeft,
      },
      400,
    );
  }

  const user = upsertUser(email);
  const sessionToken = randomToken();
  createSession(hashToken(sessionToken), user.id, Date.now() + env.sessionTtlDays * 86400_000);

  return c.json({
    token: sessionToken,
    user: { id: user.id, email: user.email },
  });
});

/** 当前用户信息 + 云端同步概要 */
authRoutes.get('/me', requireAuth, (c) => {
  const user = getUserById(c.get('userId'));
  if (!user) return c.json({ error: 'unauthorized', message: '用户不存在' }, 401);
  const doc = getSyncDoc(user.id);
  return c.json({
    user: { id: user.id, email: user.email, createdAt: user.created_at },
    sync: doc ? { updatedAt: doc.updated_at, revision: doc.revision } : null,
  });
});

/** 注销当前会话 */
authRoutes.post('/logout', requireAuth, (c) => {
  deleteSession(hashToken(readSessionToken((name) => c.req.header(name))));
  return c.json({ ok: true });
});
