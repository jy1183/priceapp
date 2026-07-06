/**
 * 실거래 분석 집계 헬퍼 — 엑셀 「실거래 데이터 분석」 시트 이식
 * 근거: 20260703 계산로직_명세서.md §2-2, §2-3 / 엑셀 블록 3·4·5·6
 * - 거래방식(매매/전세환산/월세환산) 교차, 준공연도 최근성, 준공연도 구간별
 * - 상위 n% 평균은 aggregate.ts(PERCENTILE.INC) 재사용 — 골든셋 0오차 검증됨
 */
import { aggregate, mean, type AggregateResult } from '@/lib/calc/aggregate';
import type { TxRecord } from '@/lib/normalize';

export type DealType = '매매' | '전세' | '월세';
export const DEAL_TYPES: DealType[] = ['매매', '전세', '월세'];
/** 교차표 열 라벨(전세·월세는 환산 평당가) */
export const DEAL_LABELS: Record<DealType, string> = { 매매: '매매', 전세: '전세환산', 월세: '월세환산' };

/** 시설 표준 순서 (엑셀 가격검토종합 M열) */
export const FACILITY_ORDER = ['아파트', '오피스텔', '연립다세대', '단독다가구', '상업업무용', '토지'];

/** 조회에 등장한 시설을 표준 순서로 정렬(그 외는 뒤에 원순서) */
export function orderFacilities(facs: Iterable<string>): string[] {
  const set = new Set(facs);
  const ordered = FACILITY_ORDER.filter((f) => set.has(f));
  const extra = [...set].filter((f) => !FACILITY_ORDER.includes(f));
  return [...ordered, ...extra];
}

const ppaVals = (rows: TxRecord[]): number[] =>
  rows.filter((r) => r.ppa != null && Number.isFinite(r.ppa)).map((r) => r.ppa!) as number[];

/** 준공연도 필터(전체/최근N년) — 준공연도(buildYear) 기준, 거래일과 별개(명세 결정④) */
export function filterByRecency(rows: TxRecord[], period: string, thisYear: number): TxRecord[] {
  if (period === 'all') return rows;
  const n = +period;
  return rows.filter((r) => r.buildYear != null && r.buildYear >= thisYear - n && r.buildYear <= thisYear);
}

/** A. 시설별 집계 (건수·평균·상위10/30/50) — 이미 필터된 rows 기준 */
export interface FacilityAggRow { facility: string; agg: AggregateResult }
export function facilityAgg(
  rows: TxRecord[],
  pct: { top10: number; top30: number; top50: number },
): FacilityAggRow[] {
  return orderFacilities(rows.map((r) => r.facility))
    .map((f) => ({ facility: f, agg: aggregate(ppaVals(rows.filter((r) => r.facility === f)), pct) }))
    .filter((r) => r.agg.count > 0);
}

/** B. 시설별 × 거래방식 평균 평당가 교차표 (엑셀 블록 3) */
export interface DealCell { avg: number; count: number }
export interface FacilityByDealRow { facility: string; byDeal: Record<DealType, DealCell> }
export function facilityByDeal(rows: TxRecord[]): FacilityByDealRow[] {
  return orderFacilities(rows.map((r) => r.facility))
    .map((f) => {
      const byDeal = {} as Record<DealType, DealCell>;
      for (const dt of DEAL_TYPES) {
        const v = ppaVals(rows.filter((r) => r.facility === f && r.dealType === dt));
        byDeal[dt] = { avg: v.length ? mean(v) : NaN, count: v.length };
      }
      return { facility: f, byDeal };
    })
    .filter((r) => DEAL_TYPES.some((dt) => r.byDeal[dt].count > 0));
}

/** C. 시설별 × 준공 최근성 (최근5년/최근10년/전체) — 선택 거래방식 (엑셀 블록 4·2) */
export interface RecencyRow { facility: string; recent5: number; recent10: number; all: number; count: number }
export function facilityByRecency(rows: TxRecord[], thisYear: number): RecencyRow[] {
  const within = (r: TxRecord, n: number) =>
    r.buildYear != null && r.buildYear >= thisYear - n && r.buildYear <= thisYear;
  return orderFacilities(rows.map((r) => r.facility))
    .map((f) => {
      const fr = rows.filter((r) => r.facility === f);
      const all = ppaVals(fr);
      return {
        facility: f,
        recent5: (() => { const v = ppaVals(fr.filter((r) => within(r, 5))); return v.length ? mean(v) : NaN; })(),
        recent10: (() => { const v = ppaVals(fr.filter((r) => within(r, 10))); return v.length ? mean(v) : NaN; })(),
        all: all.length ? mean(all) : NaN,
        count: all.length,
      };
    })
    .filter((r) => r.count > 0);
}

/** D. 준공연도 구간(age=기준연도−준공연도) 정의 (엑셀 블록 5) */
export const BUILD_BUCKETS: { key: string; label: string; test: (age: number) => boolean }[] = [
  { key: '<5', label: '<5년', test: (a) => a < 5 },
  { key: '5-10', label: '5–10년', test: (a) => a >= 5 && a < 10 },
  { key: '10-20', label: '10–20년', test: (a) => a >= 10 && a < 20 },
  { key: '20-30', label: '20–30년', test: (a) => a >= 20 && a < 30 },
  { key: '30+', label: '30년+', test: (a) => a >= 30 },
];

export interface BucketRow { facility: string; cells: Record<string, DealCell> }
/** 시설별 × 준공연도 구간별 평균 평당가 */
export function facilityByAgeBucket(rows: TxRecord[], thisYear: number): BucketRow[] {
  const withAge = rows.filter((r) => r.buildYear != null);
  return orderFacilities(withAge.map((r) => r.facility))
    .map((f) => {
      const fr = withAge.filter((r) => r.facility === f);
      const cells: Record<string, DealCell> = {};
      for (const b of BUILD_BUCKETS) {
        const v = ppaVals(fr.filter((r) => b.test(thisYear - r.buildYear!)));
        cells[b.key] = { avg: v.length ? mean(v) : NaN, count: v.length };
      }
      return { facility: f, cells };
    })
    .filter((r) => BUILD_BUCKETS.some((b) => r.cells[b.key].count > 0));
}

/** 구간별 전체(시설 합산) 평균 — 차트용 */
export function ageBucketOverall(rows: TxRecord[], thisYear: number): { labels: string[]; avg: number[] } {
  const withAge = rows.filter((r) => r.buildYear != null);
  return {
    labels: BUILD_BUCKETS.map((b) => b.label),
    avg: BUILD_BUCKETS.map((b) => {
      const v = ppaVals(withAge.filter((r) => b.test(thisYear - r.buildYear!)));
      return v.length ? Math.round(mean(v)) : 0;
    }),
  };
}
