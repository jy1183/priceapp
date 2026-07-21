'use client';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** 막대 위쪽에 값(천단위 콤마) 라벨 */
const barLabel = { show: true, position: 'top', fontSize: 11, formatter: (p: any) => Number(p.value).toLocaleString() };

export interface FacilityChartRow { f: string; avg: number; top10: number; top30: number; top50: number }

/** 시설별 전용 평당가(전체 평균·상위10/30/50%) 그룹 막대 차트 (천원/평) */
export function FacilityChart({ rows, title = '시설별 평당가(전용/대지, 천원/평)' }: { rows: FacilityChartRow[]; title?: string }) {
  const data = rows.filter((r) => Number.isFinite(r.avg));
  if (data.length === 0) return null;
  const cats = data.map((r) => r.f);
  const mk = (name: string, key: keyof FacilityChartRow, color: string) => ({
    name, type: 'bar', barMaxWidth: 40, itemStyle: { color }, label: barLabel,
    data: data.map((r) => (Number.isFinite(r[key] as number) ? Math.round(r[key] as number) : null)),
  });
  const opt = {
    title: { text: title, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    legend: { top: 26 },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 70, right: 20, top: 64, bottom: 50 },
    xAxis: { type: 'category', data: cats, axisLabel: { interval: 0, rotate: cats.length > 4 ? 30 : 0 } },
    yAxis: { type: 'value' },
    series: [
      mk('전체 평균', 'avg', '#2563eb'),
      mk('상위10%', 'top10', '#f59e0b'),
      mk('상위30%', 'top30', '#10b981'),
      mk('상위50%', 'top50', '#8b5cf6'),
    ],
  };
  return (
    <div className="rounded-lg border bg-white p-2">
      <ReactECharts option={opt} style={{ height: 340 }} />
    </div>
  );
}

/** 건물명별 평균 평당가 상위 막대 차트 (천원/평) */
export function BuildingChart({ rows, title = '건물별 평균 평당가(전용) 상위(천원/평)', color = '#059669' }: { rows: { name: string; avg: number }[]; title?: string; color?: string }) {
  const data = rows.filter((r) => Number.isFinite(r.avg));
  if (data.length === 0) return null;
  const opt = {
    title: { text: title, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 70, right: 20, top: 44, bottom: 70 },
    xAxis: { type: 'category', data: data.map((r) => r.name), axisLabel: { interval: 0, rotate: 30, width: 90, overflow: 'truncate' } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data.map((r) => Math.round(r.avg)), itemStyle: { color }, barMaxWidth: 48, label: barLabel }],
  };
  return (
    <div className="rounded-lg border bg-white p-2">
      <ReactECharts option={opt} style={{ height: 300 }} />
    </div>
  );
}
