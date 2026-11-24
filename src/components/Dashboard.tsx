import type { DeviceWithCalc } from '../types';
import { DonutChart } from './DonutChart';
import { HeroCard } from './HeroCard';
import { Highlights } from './Highlights';
import { RankList } from './RankList';
import { StatsGrid } from './StatsGrid';

/** 总览页：主数据卡 + 关键指标 + 图表 + 设备之最 */
export function Dashboard({ list, today }: { list: DeviceWithCalc[]; today: Date }) {
  return (
    <section className="flex animate-[fadeIn_.2s_ease] flex-col gap-4">
      <HeroCard list={list} today={today} />
      <StatsGrid list={list} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <DonutChart list={list} />
        <RankList list={list} />
      </div>
      <Highlights list={list} />
    </section>
  );
}
