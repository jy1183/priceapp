'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { TxRecord } from '@/lib/normalize';
import { ageBucketOverall } from '@/lib/txAnalysis';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** 막대 위쪽에 값(천단위 콤마) 라벨 */
const barLabel = { show: true, position: 'top', fontSize: 11, formatter: (p: any) => Number(p.value).toLocaleString() };

/** 준공연도 구간별 평균 평당가 차트 (단일, 전체 폭)
 *  dealLabel: 선택 거래방식(매매/전세환산/월세환산) — 차트 제목에 표기 */
export default function TxCharts({ rows, dealLabel = '매매' }: { rows: TxRecord[]; dealLabel?: string }) {
  const thisYear = new Date().getFullYear();

  const byBucket = useMemo(() => ageBucketOverall(rows, thisYear), [rows, thisYear]);

  const opt3 = {
    title: { text: `준공연도 구간별 평균 평당가 (${dealLabel}, 천원/평, 기준: 시설별 상이)`, left: 'center', textStyle: { fontSize: 13 } },
    tooltip: { trigger: 'axis' },
    toolbox: { right: 10, feature: { saveAsImage: { title: '이미지' } } },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: byBucket.labels, name: '준공경과' },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: byBucket.avg, itemStyle: { color: '#7c3aed' }, label: barLabel }],
  };

  if (rows.length === 0) return null;
  const hasBucket = byBucket.avg.some((v) => v > 0);
  if (!hasBucket) return null;
  return (
    <div className="mb-4 rounded-lg border bg-white p-2">
      <ReactECharts option={opt3} style={{ height: 300 }} />
    </div>
  );
}
