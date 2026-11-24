import { useEffect, useState } from 'react';
import type { Device } from '../types';
import { loadDevices, saveDevices, type SaveLevel } from '../data/storage';

export interface SaveState {
  /** ok = 正常；warn = 能存但已接近上限；failed = 存不进去了 */
  level: SaveLevel;
  bytes: number;
  reason?: 'quota' | 'unavailable' | 'error';
  message?: string;
  /** 本次保存发生的时间戳，用于让 UI 区分「刚失败」与历史状态 */
  at: number;
}

/**
 * 设备列表状态：初始化时从 localStorage 加载，变更时自动持久化。
 *
 * 持久化结果会被**如实上报**（第三个返回值）——这是关键：
 * localStorage 超限时整份数据都写不进去，必须让界面能提示用户，
 * 否则用户以为存上了、刷新即丢。
 * 首次挂载也会写一次，用于在打开应用时就把「空间已满」的问题暴露出来。
 */
export function useDevices() {
  const [devices, setDevices] = useState<Device[]>(loadDevices);
  const [save, setSave] = useState<SaveState>({ level: 'ok', bytes: 0, at: 0 });

  useEffect(() => {
    const r = saveDevices(devices);
    setSave({
      level: r.level,
      bytes: r.bytes,
      reason: r.level === 'failed' ? r.reason : undefined,
      message: r.level === 'failed' ? r.message : undefined,
      at: Date.now(),
    });
  }, [devices]);

  return [devices, setDevices, save] as const;
}
