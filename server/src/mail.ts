import { execFile } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import nodemailer, { type Transporter } from 'nodemailer';
import { env, mailConfigured } from './env';

const execFileAsync = promisify(execFile);

/** 发信结果：sent 为是否真的投递；未配置通道时走演示模式返回 devCode */
export interface MailResult {
  sent: boolean;
  /** 服务端是否配置了任意真实发信通道 */
  mailConfigured: boolean;
  /** 演示模式专用：验证码明文（生产环境恒为 undefined） */
  devCode?: string;
}

/**
 * 发送登录验证码邮件。通道优先级：
 *  1. SMTP_HOST 已配置 → Nodemailer（QQ 邮箱 / 163 / 企业邮箱等，通用）
 *  2. AGENT_MAIL=true → QQ Agent Mail（agently-cli，专属 Agent 邮箱）
 *  3. RESEND_API_KEY 已配置 → Resend API（海外服务）
 *  4. 都未配置 → 演示模式：验证码打印到控制台；仅在 devShowCode 开启时随接口返回
 */
export async function sendLoginMail(to: string, code: string): Promise<MailResult> {
  const subject = `【设备摊销】登录验证码 ${code}`;
  const html = buildCodeHtml(code, env.codeTtlMinutes);

  let sent = false;
  let channel = '';
  if (env.smtpHost) {
    channel = 'SMTP';
    sent = (await sendViaSMTP(to, subject, html)).sent;
  } else if (env.agentMail) {
    channel = 'QQ Agent Mail';
    sent = (await sendViaAgently(to, subject, html)).sent;
  } else if (env.resendApiKey) {
    channel = 'Resend';
    sent = (await sendViaResend(to, subject, html)).sent;
  }

  if (sent) return { sent: true, mailConfigured };

  // 走到这里只有两种情况：没配通道，或者配了但投递失败
  const reason = mailConfigured ? `${channel} 投递失败` : '未配置任何发信通道';
  console.log('\n========== 验证码未能通过邮件送达 ==========');
  console.log(`  原因    : ${reason}`);
  console.log(`  收件邮箱: ${to}`);
  console.log(`  验证码  : ${code}`);
  console.log(`  有效期  : ${env.codeTtlMinutes} 分钟`);
  console.log(`  页面直显: ${env.devShowCode ? '已开启（防锁死兜底）' : '已关闭'}`);
  console.log('===========================================\n');

  return {
    sent: false,
    mailConfigured,
    /**
     * devShowCode 开启时始终回传验证码。
     * 它有两重作用：本地调试免收发邮件；线上发信故障时避免把管理员彻底锁在门外。
     * 生产环境务必置 false —— 否则等同关闭登录鉴权。
     */
    devCode: env.devShowCode ? code : undefined,
  };
}
/* ---------------- QQ Agent Mail（agently-cli） ---------------- */

/** 定位 agently-cli 的 Node 入口（优先环境变量，其次项目内安装） */
function resolveAgentlyEntry(): string | null {
  if (env.agentlyCliEntry && existsSync(env.agentlyCliEntry)) return env.agentlyCliEntry;
  const local = resolve(
    process.cwd(),
    'node_modules/@tencent-qqmail/agently-cli/scripts/run.js',
  );
  return existsSync(local) ? local : null;
}

async function sendViaAgently(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean }> {
  const entry = resolveAgentlyEntry();
  if (!entry) {
    console.error(
      '[mail] 未找到 agently-cli：请在 server 目录执行 npm install，或通过 AGENTLY_CLI_ENTRY 指定入口路径',
    );
    return { sent: false };
  }

  // HTML 正文写入临时文件（CLI 的 --body-file 要求相对路径），发送后清理
  const tmpName = `.mail-tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`;
  const tmpPath = resolve(process.cwd(), tmpName);
  writeFileSync(tmpPath, html, 'utf8');

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        entry,
        'message',
        '+send',
        '--to',
        to,
        '--subject',
        subject,
        '--body-file',
        `./${tmpName}`,
        '--body-format',
        'html',
        '--confirmed',
      ],
      { timeout: 30_000, cwd: process.cwd() },
    );

    const result = extractJson(stdout) as { ok?: boolean } | null;
    if (result?.ok) {
      console.log('[mail] Agent Mail 已投递队列:', to);
      return { sent: true };
    }
    console.error('[mail] Agent Mail 返回异常:', stdout.slice(0, 300));
    return { sent: false };
  } catch (e) {
    console.error('[mail] Agent Mail 发送失败:', e instanceof Error ? e.message : e);
    return { sent: false };
  } finally {
    rmSync(tmpPath, { force: true });
  }
}

/** 从 CLI 输出中提取 JSON（输出可能混有提示文本） */
function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ---------------- SMTP（nodemailer） ---------------- */

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      // 465 端口为 SSL 直连，587/25 使用 STARTTLS 升级
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

async function sendViaSMTP(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean }> {
  try {
    const info = await getTransporter().sendMail({
      from: env.smtpFrom || `设备摊销 <${env.smtpUser}>`,
      to,
      subject,
      html,
    });
    console.log('[mail] SMTP 发送成功:', info.messageId);
    return { sent: true };
  } catch (e) {
    console.error('[mail] SMTP 发送失败:', e instanceof Error ? e.message : e);
    return { sent: false };
  }
}

/* ---------------- Resend ---------------- */

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.mailFrom, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[mail] Resend 发送失败:', res.status, await res.text().catch(() => ''));
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error('[mail] Resend 发送异常:', e);
    return { sent: false };
  }
}

/* ---------------- 邮件模板 ---------------- */

function buildCodeHtml(code: string, ttlMinutes: number): string {
  // 逐位拆开渲染，字距更舒服，也避免某些客户端把长数字识别成电话号
  const spaced = code.split('').join('&hairsp;');
  return `
    <div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0a2540;">
      <h2 style="font-size:18px;margin:0 0 16px;">登录「设备摊销」</h2>
      <p style="font-size:14px;color:#425466;line-height:1.7;margin:0 0 20px;">
        请在登录页面输入下面的验证码完成登录，无需密码：
      </p>
      <div style="background:#f2f5f8;border:1px solid #e5e9ef;border-radius:12px;padding:22px 16px;text-align:center;">
        <div style="font-size:34px;font-weight:700;letter-spacing:6px;color:#0a2540;font-family:'SF Mono',Consolas,Menlo,monospace;">${spaced}</div>
      </div>
      <p style="font-size:13px;color:#6b7c93;line-height:1.7;margin:18px 0 0;">
        验证码 ${ttlMinutes} 分钟内有效，且只能使用一次。<br/>
        为保护账号安全，请勿将验证码转发给他人。
      </p>
      <p style="font-size:12px;color:#9aa8ba;line-height:1.6;margin:20px 0 0;border-top:1px solid #eef1f5;padding-top:16px;">
        如果不是你本人操作，请忽略本邮件，你的账号不会有任何变动。
      </p>
    </div>`;
}
