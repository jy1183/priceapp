// 매매·전세·월세 실거래를 기준보증금 2,000만원 기준 월임대료로 환산해 평당 월임대료를 분석하는 모듈
/**
 * 월임대료 분석 — 요구: 기준보증금 20,000천원(2,000만원)으로 통일한 월임대료로 매매·전세·월세를 비교 집계
 * 근거: 월임대료분석_context-notes.md (2026-08-06)
 * - 매매 월임대료(만원) = (매매가 − 2,000) × 자본환원율 ÷ 12
 * - 전세 월임대료(만원) = (전세보증금 − 2,000) × 자본환원율 ÷ 12
 * - 월세 월임대료(만원) = (보증금 − 2,000) × 자본환원율 ÷ 12 + 기존월세   (세 식이 동일 계열: 전세=월세0, 매매=자산가치 대입)
 * - 평당월임대료(천원/평) = 월임대료 × 10 ÷ (전용㎡ × 0.3025)  — 기존 평당가와 동일 단위 체계(월 단위)
 * - 각 거래유형 레코드의 ppa를 평당월임대료로 치환한 파생 레코드를 만들어 기존 집계 함수 재사용(회귀 최소)
 */
import { mean } from '@/lib/calc/aggregate';
import { PYEONG } from '@/lib/calc/constants';
import { orderFacilities } from '@/lib/txAnalysis';
import {
  AREA_BANDS, TX_RESIDENTIAL, classifyBand, validPpa, bandAreaOf,
  type AreaBand, type BandCell,
} from '@/lib/areaBands';
import type { TxRecord } from '@/lib/normalize';

/** 기준보증금 (만원) — 20,000천원 = 2,000만원 */
export const STD_DEPOSIT_MANWON = 2000;

/** 거래유형별 월임대료(만원) — 자산가치(매매가/전세보증금/월세보증금)를 기준보증금(2,000만원)으로
 *  통일했을 때의 환산 월임대료. 자산가치>기준이면 임대료 증가, 자산가치<기준이면 (자산가치−2,000)<0 으로
 *  감소(단일 수식 양방향). 월세만 실제 월세를 더함. */
export function impliedMonthlyRent(r: TxRecord, capRate: number): number | null {
  if (r.dealType === '매매') {
    if (r.amountManwon == null) return null;
    return (r.amountManwon - STD_DEPOSIT_MANWON) * (capRate / 12);
  }
  if (r.dealType === '전세') {
    if (r.depositManwon == null) return null;
    return (r.depositManwon - STD_DEPOSIT_MANWON) * (capRate / 12);
  }
  // 월세
  if (r.depositManwon == null || r.monthlyRentManwon == null) return null;
  return (r.depositManwon - STD_DEPOSIT_MANWON) * (capRate / 12) + r.monthlyRentManwon;
}
/** @deprecated impliedMonthlyRent 사용 — 하위호환용 별칭(월세 전용) */
export const adjustedMonthlyRent = impliedMonthlyRent;

/** 평당 월임대료(천원/평) — 월임대료(만원) × 10 ÷ (전용㎡ × 0.3025). 유효하지 않으면 null. */
export function impliedMonthlyPpa(r: TxRecord, capRate: number): number | null {
  const rent = impliedMonthlyRent(r, capRate);
  if (rent == null || !(rent > 0) || !(r.areaM2 != null && r.areaM2 > 0)) return null;
  return (rent * 10) / (r.areaM2 * PYEONG);
}
/** @deprecated impliedMonthlyPpa 사용 */
export const monthlyPpa = impliedMonthlyPpa;

/** 지정 거래유형(매매/전세/월세) 레코드의 ppa를 평당 월임대료로 치환한 파생 TxRecord[] —
 *  기존 집계 함수에 그대로 투입. 월임대료 ≤ 0·결측 행은 ppa=null 로 두어 하위 집계에서 자동 제외. */
export function toImpliedRentRecords(rows: TxRecord[], capRate: number, dealType: TxRecord['dealType']): TxRecord[] {
  return rows
    .filter((r) => r.dealType === dealType)
    .map((r) => {
      const ppa = impliedMonthlyPpa(r, capRate);
      return { ...r, ppa: ppa != null ? Math.round(ppa * 100) / 100 : null };
    });
}
/** @deprecated toImpliedRentRecords(rows, capRate, '월세') 사용 */
export function toMonthlyPpaRecords(rows: TxRecord[], capRate: number): TxRecord[] {
  return toImpliedRentRecords(rows, capRate, '월세');
}

/** 4번 3차원 표 — 준공연도 최근성(최근5/10/전체) × 시설 × 평형대 평균 평당월세.
 *  기존 5-b(준공연도×평형대)에 시설 축을 추가. 행 = 준공연도구간 × 시설, 열 = 평형대. */
export interface RecencyFacilityBandRow {
  recencyKey: '5' | '10' | 'all';
  recencyLabel: string;
  facility: string;
  cells: Record<string, BandCell>;
}
export function bandByRecencyFacility(rows: TxRecord[], thisYear: number): RecencyFacilityBandRow[] {
  const base = rows
    .filter((r) => TX_RESIDENTIAL.includes(r.facility))
    .map((r) => ({ facility: r.facility, buildYear: r.buildYear, band: classifyBand(bandAreaOf(r)), ppa: r.ppa }))
    .filter((r) => r.band != null && validPpa(r.ppa)) as
      { facility: string; buildYear: number | null; band: AreaBand; ppa: number }[];

  const within = (y: number | null, n: number) => y != null && y >= thisYear - n && y <= thisYear;
  const defs: { key: '5' | '10' | 'all'; label: string; test: (y: number | null) => boolean }[] = [
    { key: '5', label: '준공 최근5년', test: (y) => within(y, 5) },
    { key: '10', label: '준공 최근10년', test: (y) => within(y, 10) },
    { key: 'all', label: '전체', test: () => true },
  ];

  // 시설 우선 그룹핑(시설 셀 병합용) → 시설 내에서 준공연도 최근성 순
  const out: RecencyFacilityBandRow[] = [];
  for (const f of orderFacilities(base.map((r) => r.facility))) {
    for (const d of defs) {
      const sub = base.filter((r) => r.facility === f && d.test(r.buildYear));
      const cells: Record<string, BandCell> = {};
      for (const b of AREA_BANDS) {
        const vals = sub.filter((r) => r.band.key === b.key).map((r) => r.ppa);
        cells[b.key] = { avg: vals.length ? mean(vals) : NaN, count: vals.length };
      }
      if (AREA_BANDS.some((b) => cells[b.key].count > 0)) {
        out.push({ recencyKey: d.key, recencyLabel: d.label, facility: f, cells });
      }
    }
  }
  return out;
}
