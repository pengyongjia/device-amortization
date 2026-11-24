import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 零依赖的 .env 加载（在读取任何配置前执行）。
 * 已存在的环境变量优先，不被 .env 覆盖。
 */
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    // 去掉包裹引号
    value = value.replace(/^["'](.*)["']$/, '$1');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const rawOrigins = process.env.APP_ORIGIN ?? 'http://localhost:5173';
// 支持逗号分隔多个来源（如开发 5173 + 预览 8080）
const appOrigins = rawOrigins
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 布尔型环境变量：支持 true/1/yes/on（大小写不敏感） */
function boolEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** 监听地址：默认 0.0.0.0，容器/托管环境需要外部可达 */
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: process.env.DB_PATH ?? './data/app.db',
  appOrigin: appOrigins[0],
  appOrigins,
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 180),
  // 登录验证码：有效期与单码最大尝试次数（超出即作废，需重新获取）
  codeTtlMinutes: Number(process.env.CODE_TTL_MINUTES ?? 10),
  maxCodeAttempts: Number(process.env.MAX_CODE_ATTEMPTS ?? 5),
  /**
   * 演示模式：未配置邮件通道时，是否把验证码随接口返回（前端直接显示，免收发邮件）。
   * 默认仅非生产环境开启；生产环境即使漏配邮件也不会泄露验证码。
   */
  devShowCode: boolEnv(process.env.DEV_SHOW_CODE) ?? !isProd,
  /**
   * 前端构建产物目录（相对启动目录）。前端与后端同端口部署时，
   * 由本服务直接托管 dist/ 静态资源，省掉一层反向代理。
   */
  staticDir: process.env.STATIC_DIR ?? '../dist',
  /**
   * 运维统计接口的访问令牌。留空则 /api/admin/stats 直接返回 404（默认关闭）。
   * 想查看用户与云同步概况时设置一个随机串即可。
   */
  adminToken: process.env.ADMIN_TOKEN ?? '',
  // SMTP（QQ 邮箱 / 163 / 企业邮箱等，配置了才启用）
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  // QQ Agent Mail（agently-cli）
  agentMail: process.env.AGENT_MAIL === 'true' || process.env.AGENT_MAIL === '1',
  agentlyCliEntry: process.env.AGENTLY_CLI_ENTRY ?? '',
  // Resend（海外服务）
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  mailFrom: process.env.MAIL_FROM ?? '设备摊销 <noreply@example.com>',
  isProd,
};

/** 是否配置了任意一条真实发信通道（未配置则只能走演示模式） */
export const mailConfigured = Boolean(env.smtpHost || env.agentMail || env.resendApiKey);
