// 필터링 데이터 표 아래에 붙이는 차트(실거래가 분석 1~6·5-b 블록)의 제목·축·계열을 만드는 빌더
import {
  DEAL_LABELS, BUILD_BUCKETS, type DealType,
  facilityAgg, facilityByRecency, facilityByAgeBucket, topBuildings,
} from '@/lib/txAnalysis';
import { AREA_BANDS, bandByFacility, bandByRecency, bandCountByFacility } from '@/lib/areaBands';
import { facilityWithBasis, type TxRecord } from '@/lib/normalize';
import type { AnalysisConfig } from '@/lib/calc/constants';
import type { BarSeries } from '@/components/BarChart';
import type { TxChartKind } from '@/lib/store';

/** BarChart에 그대로 넘기는 차트 데이터 */
export interface TxChartData {
  title: string;
  x: (string | number)[];
  series: BarSeries[];
  xName: string;
  wrapX?: boolean;
  rotateX?: number;
  alwaysShowLegend?: boolean;
}

/** 차트 추가 목록 — 실거래가 분석 블록 번호·이름과 같다 */
export const TX_CHART_KINDS: { kind: TxChartKind; label: string }[] = [
  { kind: '1', label: '1. 시설별 평균·상위 평균' },
  { kind: '2', label: '2. 건물(단지)별 상위 10 평균 평당가' },
  { kind: '3', label: '3. 시설별 × 준공연도 기간별 평균 평당가' },
  { kind: '4', label: '4. 준공연도 구간별 평균 평당가' },
  { kind: '5', label: '5. 평형대별 평균 가격' },
  { kind: '5b', label: '5-b. 준공연도 × 평형대별 평균 가격' },
  { kind: '6', label: '6. 평형대별 거래 건수' },
];

/** 시설별 시리즈 색상 팔레트 (/tx-analysis와 동일) */
const FAC_COLORS = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d'];
/** 유한값이면 반올림, 아니면 null(막대 생략) */
const chartVal = (v: number): number | null => (Number.isFinite(v) ? Math.round(v) : null);

/** 표에 들어 있는 거래방식 목록(매매·전세·월세 순) — 2종 이상일 때만 차트 추가 시 거래방식을 고르게 한다 */
export function dealsIn(rows: TxRecord[]): DealType[] {
  const present = new Set(rows.map((r) => r.dealType));
  return (['매매', '전세', '월세'] as DealType[]).filter((d) => present.has(d));
}

/** 차트 데이터 생성 — 거래방식별로 행을 나눈 뒤 /tx-analysis와 같은 집계 함수·제목·색을 쓴다. 데이터가 없으면 null */
export function buildTxChart(
  kind: TxChartKind, allRows: TxRecord[], deal: DealType, config: AnalysisConfig, thisYear: number,
): TxChartData | null {
  const rows = allRows.filter((r) => r.dealType === deal);
  const dl = DEAL_LABELS[deal];

  switch (kind) {
    case '1': {
      const agg = facilityAgg(rows, config.topPercentiles);
      if (agg.length === 0) return null;
      return {
        title: `시설별 평균·상위 평균 (${dl}, 천원/평)`, xName: '시설',
        x: agg.map((r) => facilityWithBasis(r.facility)),
        series: [
          { name: '평균', data: agg.map((r) => chartVal(r.agg.avg)), color: '#93c5fd' },
          { name: '상위50%', data: agg.map((r) => chartVal(r.agg.top50)), color: '#60a5fa' },
          { name: '상위30%', data: agg.map((r) => chartVal(r.agg.top30)), color: '#3b82f6' },
          { name: '상위10%', data: agg.map((r) => chartVal(r.agg.top10)), color: '#1d4ed8' },
        ],
      };
    }
    case '2': {
      const top = topBuildings(rows, 10);
      if (top.length === 0) return null;
      return {
        title: `건물(단지)별 상위 10 평균 평당가 (${dl}, 천원/평)`, xName: '건물', rotateX: 30,
        x: top.map((r) => r.name),
        series: [{ name: '평균 평당가', data: top.map((r) => chartVal(r.avg)), color: '#2563eb' }],
      };
    }
    case '3': {
      const rec = facilityByRecency(rows, thisYear);
      if (rec.length === 0) return null;
      return {
        title: `시설별 × 준공연도 기간별 평균 평당가 (${dl}, 천원/평)`, xName: '시설',
        x: rec.map((r) => facilityWithBasis(r.facility)),
        series: [
          { name: '최근5년', data: rec.map((r) => chartVal(r.recent5)), color: '#1d4ed8' },
          { name: '최근10년', data: rec.map((r) => chartVal(r.recent10)), color: '#60a5fa' },
          { name: '전체', data: rec.map((r) => chartVal(r.all)), color: '#cbd5e1' },
        ],
      };
    }
    case '4': {
      const bucket = facilityByAgeBucket(rows, thisYear);
      if (bucket.length === 0) return null;
      return {
        title: `준공연도 구간별 평균 평당가 (${dl}, 천원/평)`, xName: '준공경과', alwaysShowLegend: true,
        x: BUILD_BUCKETS.map((b) => b.label),
        series: bucket.map((r, i) => ({
          name: facilityWithBasis(r.facility),
          data: BUILD_BUCKETS.map((b) => (r.cells[b.key].count ? chartVal(r.cells[b.key].avg) : null)),
          color: ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626'][i % 5],
        })),
      };
    }
    case '5': {
      const band = bandByFacility(rows);
      if (band.facilities.length === 0) return null;
      return {
        title: `평형대별 평균 평당가 (${dl}, 천원/평)`, xName: '평형대', wrapX: true,
        x: AREA_BANDS.map((b) => b.label),
        series: band.facilities.map((f, i) => ({
          name: facilityWithBasis(f),
          data: AREA_BANDS.map((b) => (band.cells[f][b.key].count ? chartVal(band.cells[f][b.key].avg) : null)),
          color: FAC_COLORS[i % FAC_COLORS.length],
        })),
      };
    }
    case '5b': {
      const rec = bandByRecency(rows, thisYear);
      if (rec.rows.every((row) => AREA_BANDS.every((b) => row.cells[b.key].count === 0))) return null;
      return {
        title: `준공연도 × 평형대별 평균 평당가 (${dl}, 천원/평)`, xName: '평형대', wrapX: true,
        x: AREA_BANDS.map((b) => b.label),
        series: rec.rows.map((row, i) => ({
          name: row.label,
          data: AREA_BANDS.map((b) => (row.cells[b.key].count ? chartVal(row.cells[b.key].avg) : null)),
          color: ['#1d4ed8', '#60a5fa', '#cbd5e1'][i],
        })),
      };
    }
    case '6': {
      const cnt = bandCountByFacility(rows);
      if (cnt.facilities.length === 0) return null;
      return {
        title: `평형대별 거래 건수 (${dl}, 건)`, xName: '평형대', wrapX: true,
        x: AREA_BANDS.map((b) => b.label),
        series: cnt.facilities.map((f, i) => ({
          name: facilityWithBasis(f),
          data: AREA_BANDS.map((b) => (cnt.cells[f][b.key] ? cnt.cells[f][b.key] : null)),
          color: FAC_COLORS[i % FAC_COLORS.length],
        })),
      };
    }
  }
}
