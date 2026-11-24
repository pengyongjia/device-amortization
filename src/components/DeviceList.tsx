import { useMemo, useState } from 'react';
import { getCategory } from '../constants';
import type { Device, DeviceWithCalc, SortKey, StatusFilter } from '../types';
import { DeviceCard } from './DeviceCard';
import { Icon } from './Icon';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface DeviceListProps {
  list: DeviceWithCalc[];
  hasDevices: boolean;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onAdd: () => void;
  onLoadDemo: () => void;
}

const SORTERS: Record<SortKey, (a: DeviceWithCalc, b: DeviceWithCalc) => number> = {
  purchase_desc: (a, b) =>
    b.device.purchaseDate.localeCompare(a.device.purchaseDate) || b.device.createdAt - a.device.createdAt,
  purchase_asc: (a, b) => a.device.purchaseDate.localeCompare(b.device.purchaseDate),
  daily_desc: (a, b) => b.calc.dailyCost - a.calc.dailyCost,
  daily_asc: (a, b) => a.calc.dailyCost - b.calc.dailyCost,
  price_desc: (a, b) => b.device.price - a.device.price,
  days_desc: (a, b) => b.calc.usedDays - a.calc.usedDays,
};

/** 设备列表页：搜索、筛选、排序 + 卡片网格 + 空状态引导 */
export function DeviceList({ list, hasDevices, onEdit, onDelete, onAdd, onLoadDemo }: DeviceListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('purchase_desc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = list;
    if (q) {
      arr = arr.filter(
        ({ device }) =>
          device.name.toLowerCase().includes(q) ||
          device.note.toLowerCase().includes(q) ||
          getCategory(device.category).name.includes(q),
      );
    }
    if (filter !== 'all') arr = arr.filter(({ device }) => device.status === filter);
    return [...arr].sort(SORTERS[sort]);
  }, [list, search, filter, sort]);

  const showEmpty = !hasDevices || filtered.length === 0;

  return (
    <section className="animate-[fadeIn_.2s_ease]">
      <div className="mb-4 flex flex-wrap gap-2.5 sm:mb-[18px]">
        {/* 手机上搜索框独占一行，输入区域更宽 */}
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-4"
          />
          <Input
            type="search"
            className="h-10 pl-9 sm:h-9"
            placeholder="搜索名称、备注…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="h-10 flex-1 cursor-pointer rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink outline-none transition-colors focus-visible:border-ink sm:h-9 sm:flex-none"
        >
          <option value="all">全部状态</option>
          <option value="in_use">使用中</option>
          <option value="idle">闲置</option>
          <option value="sold">已出售</option>
          <option value="retired">已报废</option>
          <option value="gifted">已赠送</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 flex-1 cursor-pointer rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink outline-none transition-colors focus-visible:border-ink sm:h-9 sm:flex-none"
        >
          <option value="purchase_desc">购买日期：新 → 旧</option>
          <option value="purchase_asc">购买日期：旧 → 新</option>
          <option value="daily_desc">日均成本：高 → 低</option>
          <option value="daily_asc">日均成本：低 → 高</option>
          <option value="price_desc">购买价格：高 → 低</option>
          <option value="days_desc">已用天数：多 → 少</option>
        </select>
      </div>

      {/* items-start：网格卡片按各自内容高度排布，某张卡展开成本曲线时不牵连同行其他卡片 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] items-start gap-4">
        {filtered.map(({ device, calc }) => (
          <DeviceCard
            key={device.id}
            device={device}
            calc={calc}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {showEmpty && (
        <div className="px-5 py-20 text-center">
          <div className="mb-5 flex justify-center text-[#c6d0da]">
            <Icon name="inbox" size={44} strokeWidth={1.2} />
          </div>
          <h3 className="text-[15px] font-semibold">
            {hasDevices ? '没有匹配的设备' : '还没有设备记录'}
          </h3>
          <p className="mt-1.5 mb-6 text-[13px] text-ink-4">
            {hasDevices
              ? '换个关键词或筛选条件试试'
              : '添加你的第一台设备，开始追踪每日摊销成本吧'}
          </p>
          {!hasDevices && (
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button onClick={onAdd}>
                <Icon name="plus" size={14} />
                添加设备
              </Button>
              <Button variant="outline" onClick={onLoadDemo}>
                载入示例数据
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
