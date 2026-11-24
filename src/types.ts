/** 设备分类 ID */
export type CategoryId =
  | 'phone'
  | 'computer'
  | 'tablet'
  | 'wearable'
  | 'audio'
  | 'display'
  | 'peripheral'
  | 'console'
  | 'camera'
  | 'other';

/** 内置 SVG 图标名 */
export type IconName =
  | 'plus'
  | 'download'
  | 'upload'
  | 'edit'
  | 'trash'
  | 'chart'
  | 'search'
  | 'close'
  | 'inbox'
  | 'chevron-down'
  | 'check'
  | 'image'
  | 'calendar'
  | 'file'
  | 'cloud'
  | 'refresh'
  | 'activity'
  | 'wallet'
  | 'trending-down'
  | 'trending-up'
  | 'award'
  | 'share'
  | 'phone'
  | 'laptop'
  | 'tablet'
  | 'watch'
  | 'headphones'
  | 'monitor'
  | 'mouse'
  | 'gamepad'
  | 'camera'
  | 'box'
  | 'mail'
  | 'shield'
  | 'alert';

/** 设备状态：使用中 / 闲置 / 已出售 / 已报废 / 已赠送 */
export type DeviceStatus = 'in_use' | 'idle' | 'sold' | 'retired' | 'gifted';

/** 贷款 / 分期信息 */
export interface LoanInfo {
  /** 首付金额（元） */
  downPayment: number;
  /** 贷款本金（元，不含首付） */
  principal: number;
  /** 分期期数（月） */
  months: number;
  /** 首期还款日 YYYY-MM-DD */
  firstPaymentDate: string;
}

/** 贷款还款的实时计算结果 */
export interface LoanCalc {
  /** 每期月供 */
  monthlyPayment: number;
  /** 分期总期数（回显） */
  months: number;
  /** 已还期数 */
  paidPeriods: number;
  /** 已还金额 */
  paidAmount: number;
  /** 剩余待还金额 */
  remaining: number;
  /** 还款进度 0~1 */
  progress: number;
  /** 下期还款日（已还清时为 null） */
  nextPaymentDate: string | null;
  /** 是否已还清 */
  settled: boolean;
  /** 总支出（首付 + 本金），即含息以外的实际总成本 */
  totalCost: number;
}

/** 保修信息计算结果 */
export interface WarrantyCalc {
  /** 保修到期日 YYYY-MM-DD */
  endDate: string;
  /** 距到期剩余天数（已过保为负数） */
  daysLeft: number;
  /** active=在保 / expiring=30 天内到期 / expired=已过保 */
  status: 'active' | 'expiring' | 'expired';
}

/** 一台设备的完整记录 */
export interface Device {
  id: string;
  name: string;
  category: CategoryId;
  /** 购买价格（元） */
  price: number;
  /** 购买日期 YYYY-MM-DD */
  purchaseDate: string;
  status: DeviceStatus;
  /** 出售 / 报废 / 赠送日期（使用中、闲置时为 null） */
  endDate: string | null;
  /** 出售回血金额（仅已出售时可能有） */
  soldPrice: number | null;
  /** 预计使用年限（年），可选 */
  expectedYears: number | null;
  /** 实物图片（base64 dataURL，已在前端压缩；无图时为 null） */
  image: string | null;
  /** 贷款 / 分期购买信息（现金购买时为 null） */
  loan: LoanInfo | null;
  /** 保修时长（月），可选 */
  warrantyMonths: number | null;
  note: string;
  createdAt: number;
}

/** 单台设备的摊销计算结果（全部实时推导，不落库） */
export interface DeviceCalc {
  /** 已使用天数（含购买当天，随时间自动累加） */
  usedDays: number;
  /** 净花费 = 购买价 - 出售回血 */
  netCost: number;
  /** 日均成本 = 净花费 / 已使用天数 */
  dailyCost: number;
  /** 预计总天数（按年限折算，未设置年限时为 null） */
  plannedDays: number | null;
  /** 回本进度 0~1+（未设置年限时为 null） */
  progress: number | null;
  /** 目标日均成本 = 价格 / 预计总天数 */
  targetDaily: number | null;
  /** 明天的日均成本（用于展示“再降一点”） */
  tomorrowCost: number;
  /** 折合月成本 */
  monthlyCost: number;
  /** 是否已结束生命周期（出售 / 报废 / 赠送） */
  finished: boolean;
  /** 计算基准日期（已结束设备为其结束日） */
  refDate: Date;
  /** 贷款还款实时信息（现金购买时为 null） */
  loan: LoanCalc | null;
  /** 保修状态（未填写保修时长时为 null） */
  warranty: WarrantyCalc | null;
}

/** 设备 + 摊销结果 的组合 */
export interface DeviceWithCalc {
  device: Device;
  calc: DeviceCalc;
}

export interface CategoryMeta {
  id: CategoryId;
  name: string;
  icon: IconName;
}

export interface StatusMeta {
  name: string;
  color: string;
  endLabel: string;
}

export type TabId = 'dashboard' | 'devices' | 'loans';

/* ============================ 贷款管理模块 ============================ */

/** 还款方式 */
export type RepayMethod =
  | 'equal_installment' // 等额本息：每期还款额固定
  | 'equal_principal' // 等额本金：每期本金固定，利息递减
  | 'interest_first' // 先息后本：每期只还息，到期还本
  | 'bullet'; // 一次性还本付息：到期一次结清

/** 利率口径（输入方式，内部统一换算成月利率） */
export type RateUnit =
  | 'year' // 年利率 %
  | 'month' // 月利率 %
  | 'day' // 日利率 ‰（万分之几，如 5 表示日息万分之五）
  | 'total'; // 直接指定总利息 / 手续费（元），常见于购物分期

/** 还款间隔（每多少个月还一次） */
export type RepayInterval =
  | 'month' // 月付（1）
  | 'quarter' // 季付（3）
  | 'halfyear' // 半年付（6）
  | 'year' // 年付（12）
  | 'biweek'; // 双周付（按 0.5 个月折算）

/** 一笔贷款 / 分期记录 */
export interface LoanRecord {
  id: string;
  /** 名称，如「房贷」「特斯拉车贷」「花呗分期」 */
  name: string;
  /** 贷款本金（元） */
  principal: number;
  /** 还款方式 */
  method: RepayMethod;
  /** 利率口径 */
  rateUnit: RateUnit;
  /** 利率数值：随 rateUnit 解释（年%/月%/日‰/总利息元） */
  rateValue: number;
  /** 还款间隔 */
  interval: RepayInterval;
  /** 总期数 */
  periods: number;
  /** 首期还款日 YYYY-MM-DD */
  firstPaymentDate: string;
  /** 备注 */
  note: string;
  createdAt: number;
}

/** 单期还款明细 */
export interface RepayInstallment {
  /** 第几期（从 1 开始） */
  index: number;
  /** 还款日期 YYYY-MM-DD */
  date: string;
  /** 本期应还总额 */
  payment: number;
  /** 本期本金 */
  principal: number;
  /** 本期利息 */
  interest: number;
  /** 还款后剩余本金 */
  balance: number;
  /** 该期是否已到（截至今天） */
  due: boolean;
}

/** 一笔贷款的实时计算结果 */
export interface LoanSchedule {
  /** 换算后的月利率（小数，如 0.0042） */
  monthlyRate: number;
  /** 每期应还（等额本息时固定；其余为首期值） */
  periodPayment: number;
  /** 折算成"每月需还"（按间隔归一，便于多笔汇总） */
  monthlyPayment: number;
  /** 总利息 */
  totalInterest: number;
  /** 本息合计 */
  totalPayment: number;
  /** 已还期数 */
  paidPeriods: number;
  /** 累计已还金额（本息） */
  paidAmount: number;
  /** 累计已还利息 */
  paidInterest: number;
  /** 剩余本金 */
  remainingPrincipal: number;
  /** 剩余待还（本息） */
  remainingAmount: number;
  /** 还款进度 0~1 */
  progress: number;
  /** 下期还款日（已结清为 null） */
  nextPaymentDate: string | null;
  /** 是否已结清 */
  settled: boolean;
  /** 完整还款计划 */
  installments: RepayInstallment[];
}

/** 全部贷款汇总 */
export interface LoansSummary {
  /** 每月需还合计 */
  monthlyPayment: number;
  /** 待还本金合计 */
  remainingPrincipal: number;
  /** 累计已还合计 */
  paidAmount: number;
  /** 累计已付利息 */
  paidInterest: number;
  /** 进行中笔数 */
  activeCount: number;
  /** 下期还款（最近的一笔） */
  nextUp: { name: string; date: string; amount: number } | null;
}

export type ToastType = '' | 'success' | 'error';

export type SortKey =
  | 'purchase_desc'
  | 'purchase_asc'
  | 'daily_desc'
  | 'daily_asc'
  | 'price_desc'
  | 'days_desc';

export type StatusFilter = 'all' | DeviceStatus;

/** 导出 / 导入备份的文件结构 */
export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  devices: Device[];
  /** 贷款记录（可选，兼容旧版备份文件） */
  loans?: LoanRecord[];
}
