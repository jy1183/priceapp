'use client';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** 막대 위쪽 값 라벨 (천단위 콤마, 0/빈값은 숨김) */
const barLabel = {
  show: true, position: 'top', fontSize: 10,
  formatter: (p: any) => (p.value ? Number(p.value).toLocaleString() : ''),
};

export interface BarSeries { name: string; data: (number | null)[]; color?: string }

/** 범용 막대 차트 — 단일/그룹(범례) 공용. 표 다음에 배치하는 용도 */
export default function BarChart({
  title, x, series, xName, height = 300,
}: { title: string; x: (string | number)[]; series: BarSeries[]; xName?: string; height?: number }) {
  const grouped = series.length > 1;
  const option = {
    title: { text: title, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    legend: grouped ? { top: 24, textStyle: { fontSize: 11 } } : undefined,
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 64, right: 20, top: grouped ? 60 : 44, bottom: 44 },
    xAxis: { type: 'category', data: x, name: xName },
    yAxis: { type: 'value' },
    series: series.map((s) => ({
      name: s.name, type: 'bar', data: s.data,
      itemStyle: s.color ? { color: s.color } : undefined,
      label: barLabel,
    })),
  };
  if (x.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border bg-white p-2">
      <ReactECharts option={option} style={{ height }} />
    </div>
  );
}
