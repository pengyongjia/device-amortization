import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { getAdminStats } from './db';
import { env, mailConfigured } from './env';
import { authRoutes } from './routes/auth';
import { syncRoutes } from './routes/sync';

const app = new Hono();

// 跨域：允许白名单来源，以及「同源部署」时自身 Host 发起的请求
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return '';
      if (env.appOrigins.includes(origin)) return origin;
      // 前后端同端口部署时，浏览器的 POST/PUT 会带上自身 Origin，按 Host 放行
      try {
        const host = c.req.header('host');
        if (host && new URL(origin).host === host) return origin;
      } catch {
        /* Origin 不是合法 URL，按不允许处理 */
      }
      return '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
    maxAge: 86400,
  }),
);

// 同步接口体积限制（设备图片为压缩后的 base64，放宽到 10MB）
app.use(
  '/api/sync',
  bodyLimit({
    maxSize: 10 * 1024 * 1024,
    onError: (c) => c.json({ error: 'payload_too_large', message: '数据过大（上限 10MB）' }, 413),
  }),
);

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'device-amortization-server',
    version: '1.0.0',
    mailConfigured,
  }),
);

app.route('/api/auth', authRoutes);
app.route('/api/sync', syncRoutes);

/* ---------------- 运维统计（默认关闭：需在 .env 配置 ADMIN_TOKEN 才生效）----------------
 * 只读接口，用于查看有哪些用户、各自云同步了多少台设备。
 * 未配置 ADMIN_TOKEN 时直接 404，等于不存在。
 */
app.get('/api/admin/stats', (c) => {
  if (!env.adminToken) return c.json({ error: 'not_found' }, 404);

  const provided = Buffer.from(c.req.header('x-admin-token') ?? '');
  const expected = Buffer.from(env.adminToken);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return c.json({ error: 'unauthorized', message: '运维令牌不正确' }, 401);
  }
  return c.json(getAdminStats());
});

app.notFound((c) =>
  c.req.path.startsWith('/api/')
    ? c.json({ error: 'not_found' }, 404)
    : c.json({ error: 'not_found', message: '页面不存在' }, 404),
);

app.onError((err, c) => {
  console.error('[server] 未捕获异常:', err);
  return c.json({ error: 'internal_error', message: '服务器内部错误' }, 500);
});

/* ---------------- 静态资源（前后端同端口部署） ----------------
 * 前端 `npm run build` 产物默认落在 ../dist。
 * 未命中文件时回落到 index.html，保证前端路由 / 深链不会 404。
 * 单端口部署省掉反向代理，也让 WorkBuddy 沙箱这类「只开一个端口」的环境能直接跑。
 */
app.use('*', serveStatic({ root: env.staticDir }));
app.get('*', (c, next) => {
  if (c.req.path.startsWith('/api/')) return next();
  return serveStatic({ root: env.staticDir, path: 'index.html' })(c, next);
});

serve({ fetch: app.fetch, port: env.port, hostname: env.host }, (info) => {
  console.log(`[server] 设备摊销后端已启动: http://${env.host}:${info.port}`);
  console.log(`[server] 数据库文件: ${env.dbPath}`);
  console.log(`[server] 允许的前端来源: ${env.appOrigins.join(', ')}（+ 同源）`);
  console.log(`[server] 静态资源目录: ${env.staticDir}`);
  const mailMode = env.smtpHost
    ? `SMTP 真实发送（${env.smtpUser}）`
    : env.agentMail
      ? 'QQ Agent Mail 真实发送（agently-cli）'
      : env.resendApiKey
        ? 'Resend 真实发送'
        : `演示模式（验证码打印到控制台${env.devShowCode ? '，并随接口返回供界面直填' : ''}）`;
  console.log(`[server] 登录验证码: 邮件通道 = ${mailMode}`);
  console.log(`[server] 验证码有效期: ${env.codeTtlMinutes} 分钟 / 最多错误 ${env.maxCodeAttempts} 次`);
});
