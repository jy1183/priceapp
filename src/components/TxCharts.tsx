'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { TxRecord } from '@/lib/normalize';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** 준공연도별 평균 평당가 + 거래연도별 건수 차트 */
export default function TxCharts({ rows }: { rows: TxRecord[] }) {
  const byBuild = useMemo(() => {
    const m = new Map<number, number[]>();
    rows.forEach((r) => {
      if (r.buildYear && r.ppa != null) {
        if (!m.has(r.buildYear)) m.set(r.buildYear, []);
        m.get(r.buildYear)!.push(r.ppa);
      }
    });
    const years = [...m.keys()].sort((a, b) => a - b);
    return {
      years,
      avg: years.map((y) => {
        const a = m.get(y)!; return Math.round(a.reduce((s, v) => s + v, 0) / a.length);
      }),
    };
  }, [rows]);

  const byDealYear = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const y = r.dealDate?.slice(0, 4);
      if (y) m.set(y, (m.get(y) ?? 0) + 1);
    });
    const years = [...m.keys()].sort();
    return { years, counts: years.map((y) => m.get(y)!) };
  }, [rows]);

  const opt1 = {
    title: { text: '준공연도별 평균 평당가(천원/평)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: byBuild.years, name: '준공연도' },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: byBuild.avg, itemStyle: { color: '#2563eb' } }],
  };
  const opt2 = {
    title: { text: '거래연도별 거래건수', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: byDealYear.years, name: '거래연도' },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', data: byDealYear.counts, itemStyle: { color: '#059669' } }],
  };

  if (rows.length === 0) return null;
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-lg border bg-white p-2">
        <ReactECharts option={opt1} style={{ height: 280 }} />
      </div>
      <div className="rounded-lg border bg-white p-2">
        <ReactECharts option={opt2} style={{ height: 280 }} />
      </div>
    </div>
  );
}
