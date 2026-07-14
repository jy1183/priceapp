/**
 * 평형대(전용면적) 분석 공용 모듈 — 요구 R2·R4
 * 근거: 20260713 분석고도화_실행계획.md §3 T1
 * - 주거 상품만 대상(토지·상업업무용 제외), 전용면적 기준 6구간 분류
 * - 평균 산출에서 ppa가 null·NaN·0 이하인 행 제외(validPpa, R4)
 * - 기존 집계 코드(txAnalysis.ts의 ppaVals 등)는 전역 제약에 따라 수정하지 않고, 이 모듈에서만 강화
 */
import { mean } from '@/lib/calc/aggregate';
import { orderFacilities } from '@/lib/txAnalysis';
import type { TxRecord } from '@/lib/normalize';

/** 평형대(전용면적) 구분 — (min, max] 규약(min 초과 ~ max 이하). 135초과는 a > 135. */
export interface AreaBand { key: string; label: string; min: number; max: number | null }
export const AREA_BANDS: AreaBand[] = [
  { key: 'b40',    label: '40㎡ 이하 (초소형)',      min: -Infinity, max: 40 },
  { key: 'b4055',  label: '40~55㎡ (소형·2룸 이하)', min: 40,  max: 55 },
  { key: 'b5565',  label: '55~65㎡ (소형·3룸 이하)', min: 55,  max: 65 },
  { key: 'b6585',  label: '65~85㎡ (중소형)',        min: 65,  max: 85 },
  { key: 'b85135', label: '85~135㎡ (중대형)',       min: 85,  max: 135 },
  { key: 'b135',   label: '135㎡ 초과 (대형)',       min: 135, max: null },
];

/** 전용면적(㎡) → 평형대. 경계: min 초과 ~ max 이하(40→초소형, 55→2룸소형, 135→중대형). */
export function classifyBand(areaM2: number | null | undefined): AreaBand | null {
  if (areaM2 == null || !Number.isFinite(areaM2) || areaM2 <= 0) return null;
  for (const b of AREA_BANDS) {
    if (areaM2 > b.min && (b.max == null || areaM2 <= b.max)) return b;
  }
  return null;
}

/** 주거 시설 판정 — 실거래(molit Facility 체계) */
export const TX_RESIDENTIAL = ['아파트', '오피스텔', '연립다세대', '단독다가구'];
/** 주거 시설 판정 — 시세(네이버 normFacility 체계, '빌라／연립'의 슬래시는 전각) */
export const SISE_RESIDENTIAL = ['아파트', '오피스텔', '빌라／연립', '단독/다가구', '전원주택'];

/** 평형대 집계 전용 유효값 필터(R4): null·NaN·0 이하 제외. txAnalysis의 ppaVals(0 통과)는 재사용하지 않음. */
export const validPpa = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v) && v > 0;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

/** 실거래 레코드의 평형대 분류용 전용면적. 단독다가구는 전용면적이 없어 연면적(raw.totalFloorAr)으로 분류(D1). */
export function bandAreaOf(r: TxRecord): number | null {
  if (r.facility === '단독다가구') return num(r.raw?.totalFloorAr);
  return r.areaM2;
}

/** 평형대 집계 공통 입력형 — tx·시세 공용 */
export interface BandInput { facility: string; area: number | null; ppa: number | null }
export interface BandCell { avg: number; count: number }
export interface BandByFacilityResult {
  facilities: string[];
  cells: Record<string, Record<string, BandCell>>; // cells[facility][bandKey]
}

/** 코어: {facility, area, ppa}[] → 시설 × 평형대 평균 평당가·건수 (유효 ppa·분류가능 행만) */
export function bandAggregate(inputs: BandInput[]): BandByFacilityResult {
  const valid = inputs
    .map((i) => ({ facility: i.facility, band: classifyBand(i.area), ppa: i.ppa }))
    .filter((i) => i.band != null && validPpa(i.ppa)) as { facility: string; band: AreaBand; ppa: number }[];
  const facilities = orderFacilities(valid.map((i) => i.facility));
  const cells: Record<string, Record<string, BandCell>> = {};
  for (const f of facilities) {
    cells[f] = {};
    for (const b of AREA_BANDS) {
      const vals = valid.filter((i) => i.facility === f && i.band.key === b.key).map((i) => i.ppa);
      cells[f][b.key] = { avg: vals.length ? mean(vals) : NaN, count: vals.length };
    }
  }
  return {
    facilities: facilities.filter((f) => AREA_BANDS.some((b) => cells[f][b.key].count > 0)),
    cells,
  };
}

/** 시설 × 평형대 평균 평당가·건수 (tx용) — 주거 시설만, 전용면적 기준 */
export function bandByFacility(rows: TxRecord[]): BandByFacilityResult {
  const inputs: BandInput[] = rows
    .filter((r) => TX_RESIDENTIAL.includes(r.facility))
    .map((r) => ({ facility: r.facility, area: bandAreaOf(r), ppa: r.ppa }));
  return bandAggregate(inputs);
}

/** 시설 × 평형대 거래 건수 (tx용) — 건수 집계이므로 ppa 유효성과 무관하게 평형대 분류 가능한 행 전부 포함 */
export interface BandCountResult {
  facilities: string[];
  cells: Record<string, Record<string, number>>; // cells[facility][bandKey] = 건수
  totals: Record<string, number>;                // totals[bandKey] = 전체 건수
}
export function bandCountByFacility(rows: TxRecord[]): BandCountResult {
  const classified = rows
    .filter((r) => TX_RESIDENTIAL.includes(r.facility))
    .map((r) => ({ facility: r.facility, band: classifyBand(bandAreaOf(r)) }))
    .filter((i) => i.band != null) as { facility: string; band: AreaBand }[];
  const facilities = orderFacilities(classified.map((i) => i.facility));
  const cells: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  for (const b of AREA_BANDS) totals[b.key] = 0;
  for (const f of facilities) {
    cells[f] = {};
    for (const b of AREA_BANDS) {
      const n = classified.filter((i) => i.facility === f && i.band.key === b.key).length;
      cells[f][b.key] = n;
      totals[b.key] += n;
    }
  }
  return { facilities, cells, totals };
}

export interface RecencyBandRow { key: '5' | '10' | 'all'; label: string; cells: Record<string, BandCell> }
/** 준공최근성(최근5/10/전체) × 평형대 평균 평당가 (tx용) — 준공연도 기준(거래일과 별개) */
export function bandByRecency(rows: TxRecord[], thisYear: number): { rows: RecencyBandRow[] } {
  const res = rows
    .filter((r) => TX_RESIDENTIAL.includes(r.facility))
    .map((r) => ({ buildYear: r.buildYear, band: classifyBand(bandAreaOf(r)), ppa: r.ppa }))
    .filter((r) => r.band != null && validPpa(r.ppa)) as { buildYear: number | null; band: AreaBand; ppa: number }[];
  const within = (buildYear: number | null, n: number) =>
    buildYear != null && buildYear >= thisYear - n && buildYear <= thisYear;
  const defs: { key: '5' | '10' | 'all'; label: string; test: (y: number | null) => boolean }[] = [
    { key: '5', label: '준공 최근5년', test: (y) => within(y, 5) },
    { key: '10', label: '준공 최근10년', test: (y) => within(y, 10) },
    { key: 'all', label: '전체', test: () => true },
  ];
  return {
    rows: defs.map((d) => {
      const sub = res.filter((r) => d.test(r.buildYear));
      const cells: Record<string, BandCell> = {};
      for (const b of AREA_BANDS) {
        const vals = sub.filter((r) => r.band.key === b.key).map((r) => r.ppa);
        cells[b.key] = { avg: vals.length ? mean(vals) : NaN, count: vals.length };
      }
      return { key: d.key, label: d.label, cells };
    }),
  };
}
