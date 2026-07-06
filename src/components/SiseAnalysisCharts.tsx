'use client';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** 시설별 전용 평균 평당가 막대 차트 (천원/평) */
export function FacilityChart({ rows }: { rows: { f: string; avg: number }[] }) {
  const data = rows.filter((r) => Number.isFinite(r.avg));
  if (data.length === 0) return null;
  const opt = {
    title: { text: '시설별 전용 평균 평당가(천원/평)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 70, right: 20, top: 44, bottom: 60 },
    xAxis: { type: 'category', data: data.map((r) => r.f), axisLabel: { interval: 0, rotate: data.length > 4 ? 30 : 0 } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data.map((r) => Math.round(r.avg)), itemStyle: { color: '#2563eb' }, barMaxWidth: 48 }],
  };
  return (
    <div className="rounded-lg border bg-white p-2">
      <ReactECharts option={opt} style={{ height: 300 }} />
    </div>
  );
}

/** 건물명별 평균 평당가 상위 막대 차트 (천원/평) */
export function BuildingChart({ rows }: { rows: { name: string; avg: number }[] }) {
  const data = rows.filter((r) => Number.isFinite(r.avg));
  if (data.length === 0) return null;
  const opt = {
    title: { text: '건물별 평균 평당가 상위(천원/평)', left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 70, right: 20, top: 44, bottom: 70 },
    xAxis: { type: 'category', data: data.map((r) => r.name), axisLabel: { interval: 0, rotate: 30, width: 90, overflow: 'truncate' } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data.map((r) => Math.round(r.avg)), itemStyle: { color: '#059669' }, barMaxWidth: 48 }],
  };
  return (
    <div className="rounded-lg border bg-white p-2">
      <ReactECharts option={opt} style={{ height: 300 }} />
    </div>
  );
}
