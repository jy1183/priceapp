// 월세 실거래를 기준보증금 2,000만원 보정월세로 환산해 평당 월임대료를 분석하는 모듈
/**
 * 월임대료 분석 — 요구: 기준보증금 20,000천원(2,000만원)으로 월세 통일 후 평당 월임대료 집계
 * 근거: 월임대료분석_context-notes.md (2026-08-06)
 * - 보정월세(만원) = (기존보증금 − 2,000) × (자본환원율 ÷ 12) + 기존월세
 * - 평당월세(천원/평) = 보정월세 × 10 ÷ (전용㎡ × 0.3025)  — 기존 평당가와 동일 단위 체계(월 단위)
 * - 월세 레코드의 ppa를 평당월세로 치환한 파생 레코드를 만들어 기존 집계 함수 재사용(회귀 최소)
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

/** 보정월세(만원) — 보증금을 기준(2,000만원)으로 통일했을 때의 환산 월세.
 *  보증금>기준이면 월세 증가, 보증금<기준이면 (보증금−2,000)<0 으로 월세 감소(단일 수식 양방향). */
export function adjustedMonthlyRent(r: TxRecord, capRate: number): number | null {
  if (r.depositManwon == null || r.monthlyRentManwon == null) return null;
  return (r.depositManwon - STD_DEPOSIT_MANWON) * (capRate / 12) + r.monthlyRentManwon;
}

/** 평당 보정월세(천원/평) — 보정월세(만원) × 10 ÷ (전용㎡ × 0.3025). 유효하지 않으면 null. */
export function monthlyPpa(r: TxRecord, capRate: number): number | null {
  const adj = adjustedMonthlyRent(r, capRate);
  if (adj == null || !(adj > 0) || !(r.areaM2 != null && r.areaM2 > 0)) return null;
  return (adj * 10) / (r.areaM2 * PYEONG);
}

/** 월세 레코드의 ppa를 평당 보정월세로 치환한 파생 TxRecord[] — 기존 집계 함수에 그대로 투입.
 *  보정월세 ≤ 0·결측 행은 ppa=null 로 두어 하위 집계에서 자동 제외. */
export function toMonthlyPpaRecords(rows: TxRecord[], capRate: number): TxRecord[] {
  return rows
    .filter((r) => r.dealType === '월세')
    .map((r) => {
      const ppa = monthlyPpa(r, capRate);
      return { ...r, ppa: ppa != null ? Math.round(ppa * 100) / 100 : null };
    });
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

  const out: RecencyFacilityBandRow[] = [];
  for (const d of defs) {
    const sub = base.filter((r) => d.test(r.buildYear));
    for (const f of orderFacilities(sub.map((r) => r.facility))) {
      const cells: Record<string, BandCell> = {};
      for (const b of AREA_BANDS) {
        const vals = sub.filter((r) => r.facility === f && r.band.key === b.key).map((r) => r.ppa);
        cells[b.key] = { avg: vals.length ? mean(vals) : NaN, count: vals.length };
      }
      if (AREA_BANDS.some((b) => cells[b.key].count > 0)) {
        out.push({ recencyKey: d.key, recencyLabel: d.label, facility: f, cells });
      }
    }
  }
  return out;
}
