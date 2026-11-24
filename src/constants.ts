import type { CategoryId, CategoryMeta, DeviceStatus, StatusMeta } from './types';

/** localStorage 存储键 */
export const STORAGE_KEY = 'device-amortization-v1';

/** 贷款模块独立存储键（与设备数据分开，避免破坏现有云同步结构） */
export const STORAGE_KEY_LOANS = 'device-amortization-loans-v1';

export const APP_NAME = '设备摊销';

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'phone', name: '手机', icon: 'phone' },
  { id: 'computer', name: '电脑', icon: 'laptop' },
  { id: 'tablet', name: '平板', icon: 'tablet' },
  { id: 'wearable', name: '穿戴设备', icon: 'watch' },
  { id: 'audio', name: '耳机 / 音频', icon: 'headphones' },
  { id: 'display', name: '显示器', icon: 'monitor' },
  { id: 'peripheral', name: '外设 / 配件', icon: 'mouse' },
  { id: 'console', name: '游戏机', icon: 'gamepad' },
  { id: 'camera', name: '相机 / 影像', icon: 'camera' },
  { id: 'other', name: '其他', icon: 'box' },
];

/** 状态色为低饱和语义色，仅用于小圆点与文字强调 */
export const STATUSES: Record<DeviceStatus, StatusMeta> = {
  in_use: { name: '使用中', color: '#0e9f6e', endLabel: '结束日期' },
  idle: { name: '闲置', color: '#c47f17', endLabel: '结束日期' },
  sold: { name: '已出售', color: '#3d6fa8', endLabel: '出售日期' },
  retired: { name: '已报废', color: '#8a97a6', endLabel: '报废日期' },
  gifted: { name: '已赠送', color: '#7c6ba8', endLabel: '赠送日期' },
};

/** 图表色板：低饱和莫兰迪金融色 */
export const PALETTE = [
  '#0a2540', '#3d6fa8', '#0e9f6e', '#c47f17', '#7c6ba8',
  '#a8526b', '#4d7c6f', '#8c8578', '#5f7285', '#9aa8ba',
];

export function getCategory(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
