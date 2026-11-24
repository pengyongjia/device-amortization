import { useEffect, useState } from 'react';
import type { LoanRecord } from '../types';
import { loadLoans, saveLoans } from '../data/loans';

/**
 * 贷款列表状态：初始化时从 localStorage 加载，变更时自动持久化。
 * 保存失败会通过第三个返回值上报，供界面提示（与设备数据同样不静默失败）。
 */
export function useLoans() {
  const [loans, setLoans] = useState<LoanRecord[]>(loadLoans);
  const [saveOk, setSaveOk] = useState(true);

  useEffect(() => {
    setSaveOk(saveLoans(loans));
  }, [loans]);

  return [loans, setLoans, saveOk] as const;
}
