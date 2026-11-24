import { useEffect, useState } from 'react';
import { todayStart } from '../utils/date';

/**
 * 返回"今天零点"的 Date。
 * 每 30 秒检查一次系统日期，跨过零点（或从后台切回页面）时自动更新，
 * 驱动全站重新计算已使用天数与日均成本。
 */
export function useToday(): Date {
  const [today, setToday] = useState<Date>(todayStart);

  useEffect(() => {
    const refresh = () => {
      const now = todayStart();
      setToday((prev) => (now.getTime() !== prev.getTime() ? now : prev));
    };
    const timer = window.setInterval(refresh, 30_000);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
