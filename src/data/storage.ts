import type { BackupFile, CategoryId, Device, DeviceStatus, LoanInfo, LoanRecord } from '../types';
import { normalizeLoanRecord } from './loans';
import { APP_NAME, CATEGORIES, STATUSES, STORAGE_KEY } from '../constants';
import { todayStr } from '../utils/date';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * 校验并归一化外部来源的贷款信息。
 * 核心约束：购买价格 = 首付 + 贷款本金 —— 本金由「价格 - 首付」自动推导，
 * 不再信任外部传入的 principal 字段（修复早期版本二者可以互相冲突的问题）。
 */
function normalizeLoan(raw: unknown, price: number): LoanInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const months = Math.round(Math.max(0, Number(o.months) || 0));
  if (months <= 0 || months > 120 || !isDateStr(o.firstPaymentDate)) return null;

  // 首付限制在 [0, 价格) 区间；首付覆盖全款时视为非分期
  const rawDown = Math.max(0, Number(o.downPayment) || 0);
  const downPayment = Math.min(rawDown, Math.max(0, price));
  const principal = Math.max(0, price - downPayment);
  if (principal <= 0) return null;

  return { downPayment, principal, months, firstPaymentDate: o.firstPaymentDate };
}

/** 补全 / 修正外部来源（localStorage、导入文件）的数据，保证类型安全 */
export function normalizeDevice(raw: Record<string, unknown>): Device {
  const category: CategoryId = CATEGORIES.some((c) => c.id === raw.category)
    ? (raw.category as CategoryId)
    : 'other';
  const status: DeviceStatus =
    typeof raw.status === 'string' && raw.status in STATUSES
      ? (raw.status as DeviceStatus)
      : 'in_use';

  const price = Math.max(0, Number(raw.price) || 0);
  const soldPriceNum = raw.soldPrice != null && raw.soldPrice !== '' ? Math.max(0, Number(raw.soldPrice) || 0) : null;
  const yearsNum = Number(raw.expectedYears);
  const warrantyNum = Math.round(Number(raw.warrantyMonths));

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name: String(raw.name ?? '未命名设备').slice(0, 40),
    category,
    price,
    purchaseDate: isDateStr(raw.purchaseDate) ? raw.purchaseDate : todayStr(),
    status,
    endDate: isDateStr(raw.endDate) ? raw.endDate : null,
    soldPrice: soldPriceNum,
    expectedYears: Number.isFinite(yearsNum) && yearsNum > 0 ? yearsNum : null,
    image: typeof raw.image === 'string' && raw.image.startsWith('data:image/') ? raw.image : null,
    loan: normalizeLoan(raw.loan, price),
    warrantyMonths: Number.isFinite(warrantyNum) && warrantyNum > 0 && warrantyNum <= 120 ? warrantyNum : null,
    note: String(raw.note ?? '').slice(0, 200),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

/** 从 localStorage 加载设备列表（容错：任何异常都返回空列表） */
export function loadDevices(): Device[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { devices?: unknown };
    if (!parsed || !Array.isArray(parsed.devices)) return [];
    return parsed.devices.map((d) => normalizeDevice(d as Record<string, unknown>));
  } catch (e) {
    console.warn('读取本地数据失败：', e);
    return [];
  }
}

/* ---------------- 容量预算与保存结果 ---------------- */

/**
 * localStorage 各浏览器普遍在 5MB 左右。图片以 base64 存进来，是唯一会撑爆它的东西。
 * 留出足够余量：超过预警线先提示，逼近硬线时保存随时可能失败。
 */
export const STORAGE_WARN_BYTES = 3.2 * 1024 * 1024;
export const STORAGE_HARD_BYTES = 4.2 * 1024 * 1024;

export type SaveLevel = 'ok' | 'warn' | 'failed';

export type SaveResult = {
  level: SaveLevel;
  bytes: number;
  /** 失败原因，仅 level === 'failed' 时有值 */
  reason?: 'quota' | 'unavailable' | 'error';
  message?: string;
};

/** 是否为「存储配额不足」类错误（各浏览器命名不一致，逐一兼容） */
function isQuotaError(e: unknown): boolean {
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    return (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    );
  }
  return e instanceof Error && /quota|exceeded/i.test(e.message);
}

/** 人类可读的体积 */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 持久化设备列表，并把结果如实返回。
 *
 * 关键点：**绝不静默失败**。localStorage 一旦超限，整份数据都写不进去，
 * 调用方必须能拿到失败信号并告知用户，否则用户会以为存上了、刷新即丢。
 */
export function saveDevices(devices: Device[]): SaveResult {
  const payload = JSON.stringify({ version: 1, devices });
  const bytes = payload.length;

  try {
    localStorage.setItem(STORAGE_KEY, payload);
    return { level: bytes >= STORAGE_WARN_BYTES ? 'warn' : 'ok', bytes };
  } catch (e) {
    if (typeof localStorage === 'undefined') {
      return { level: 'failed', bytes, reason: 'unavailable', message: '当前环境不支持本地存储' };
    }
    if (isQuotaError(e)) {
      return {
        level: 'failed',
        bytes,
        reason: 'quota',
        message: `本地存储空间不足（本次需要 ${fmtBytes(bytes)}）`,
      };
    }
    return {
      level: 'failed',
      bytes,
      reason: 'error',
      message: e instanceof Error ? e.message : '未知错误',
    };
  }
}

/** 触发浏览器下载一个 JSON 文件 */
function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 导出 JSON 备份文件并触发下载。
 * @param withImages 是否包含设备照片。照片是 base64 内嵌的，是备份体积的绝对大头；
 *                   存储告急时先导出「轻量备份」把文字数据救出来，照片之后再补。
 */
export function downloadBackup(devices: Device[], withImages = true, loans: LoanRecord[] = []): void {
  const payload: BackupFile & { _说明?: string } = {
    app: APP_NAME,
    version: 1,
    exportedAt: new Date().toISOString(),
    devices: withImages ? devices : devices.map((d) => ({ ...d, image: null })),
    loans,
  };
  if (!withImages) {
    payload._说明 =
      '轻量备份：仅含设备文字数据，不含照片。导入后照片需自行重新添加，其余字段完整。';
  }
  downloadJson(payload, `设备摊销数据${withImages ? '' : '-轻量'}-${todayStr()}.json`);
}

/**
 * 下载导入模板：含字段说明与两台示例设备（现金购买 / 分期购买），
 * 用户照格式填写后通过「导入」载入
 */
export function downloadTemplate(): void {
  const now = Date.now();
  const template = {
    app: APP_NAME,
    version: 1,
    exportedAt: new Date().toISOString(),
    _说明:
      '按 devices 数组中的格式填写你的设备后，通过页面顶部「导入」即可载入；填完请删除示例行。' +
      'category 可选：phone/computer/tablet/wearable/audio/display/peripheral/console/camera/other；' +
      'status 可选：in_use(使用中)/idle(闲置)/sold(已出售)/retired(已报废)/gifted(已赠送)；' +
      'warrantyMonths 为保修月数（可选，如 12 表示一年保修）；loan 的分期本金由「价格 - 首付」自动推导。' +
      'loans 数组为贷款记录：method 可选 equal_installment(等额本息)/equal_principal(等额本金)/interest_first(先息后本)/bullet(到期一次)；' +
      'rateUnit 可选 year(年利率%)/month(月利率%)/day(日利率‰)/total(总利息元)；' +
      'interval 可选 month/quarter/halfyear/year/biweek。',
    devices: [
      {
        name: '示例：小米手环 8（可删除本行）',
        category: 'wearable',
        price: 180,
        purchaseDate: '2024-09-16',
        status: 'in_use',
        endDate: null,
        soldPrice: null,
        expectedYears: 2,
        image: null,
        loan: null,
        warrantyMonths: 12,
        note: '现金购买，预计用 2 年',
      },
      {
        name: '示例：分期购买的 iPhone 15（可删除本行）',
        category: 'phone',
        price: 5999,
        purchaseDate: '2025-10-01',
        status: 'in_use',
        endDate: null,
        soldPrice: null,
        expectedYears: 4,
        image: null,
        loan: {
          downPayment: 2000,
          principal: 3999,
          months: 12,
          firstPaymentDate: '2025-11-01',
        },
        warrantyMonths: 12,
        note: '分期示例：不需要分期时 loan 填 null',
      },
    ],
    loans: [
      {
        name: '示例：房贷（可删除本行）',
        principal: 1000000,
        method: 'equal_installment',
        rateUnit: 'year',
        rateValue: 4.2,
        interval: 'month',
        periods: 360,
        firstPaymentDate: '2025-01-01',
        note: '等额本息示例：100万 年利率4.2% 30年',
      },
    ],
    _生成时间: new Date(now).toISOString(),
  };
  downloadJson(template, '设备摊销-导入模板.json');
}

/** 解析备份文件的结果 */
export interface ParsedBackup {
  devices: Device[];
  loans: LoanRecord[];
}

/** 解析备份文件文本（设备 + 贷款），失败返回 null */
export function parseBackupText(text: string): ParsedBackup | null {
  try {
    const obj = JSON.parse(text) as unknown;
    const root = (Array.isArray(obj) ? { devices: obj } : obj) as {
      devices?: unknown;
      loans?: unknown;
    };
    if (!Array.isArray(root.devices)) return null;
    const devices = root.devices.map((d) => normalizeDevice(d as Record<string, unknown>));
    const loans = Array.isArray(root.loans)
      ? root.loans
          .map((l) => normalizeLoanRecord(l as Record<string, unknown>))
          .filter((l): l is LoanRecord => l !== null)
      : [];
    return { devices, loans };
  } catch {
    return null;
  }
}
