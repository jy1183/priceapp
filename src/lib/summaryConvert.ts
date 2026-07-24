// 종합검토 6·7번 — 실거래 매매가 vs 월세 환산가 비교 및 자본환원율 보정 집계
// 근거: transaction.ts(환산식)·constants.ts(기본 자본환원율·보증금운영수익률)
// 전체 통합(주거 시설 TX_RESIDENTIAL) 기준, 준공최근5년 = buildYear ∈ [thisYear−5, thisYear]
import type { TxRecord } from '@/lib/normalize';
import type { AnalysisConfig } from '@/lib/calc/constants';
import { PYEONG } from '@/lib/calc/constants';
import { TX_RESIDENTIAL } from '@/lib/areaBands';

const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const within5 = (r: TxRecord, thisYear: number): boolean =>
  r.buildYear != null && r.buildYear >= thisYear - 5 && r.buildYear <= thisYear;

const residSale = (tx: TxRecord[]): TxRecord[] =>
  tx.filter((r) => r.dealType === '매매' && TX_RESIDENTIAL.includes(r.facility) && r.ppa != null && Number.isFinite(r.ppa));
const residMonthly = (tx: TxRecord[]): TxRecord[] =>
  tx.filter((r) => r.dealType === '월세' && TX_RESIDENTIAL.includes(r.facility) && r.ppa != null && Number.isFinite(r.ppa));

/** 6번 표 — 매매가·환산가의 평균/준공최근5년 평당가와 차이 비율 */
export interface ConvertCompare {
  saleAvg: number; saleAvgCount: number;
  saleRecent5: number; saleRecent5Count: number;
  convAvg: number; convAvgCount: number;
  convRecent5: number; convRecent5Count: number;
  gapAvg: number;      // (환산가−매매가)/매매가 × 100
  gapRecent5: number;
}

export function buildConvertCompare(tx: TxRecord[], thisYear: number): ConvertCompare {
  const sale = residSale(tx);
  const conv = residMonthly(tx);
  const ppas = (rows: TxRecord[]) => rows.map((r) => r.ppa!);
  const saleAll = ppas(sale);
  const saleR5 = ppas(sale.filter((r) => within5(r, thisYear)));
  const convAll = ppas(conv);
  const convR5 = ppas(conv.filter((r) => within5(r, thisYear)));
  const gap = (c: number, s: number) =>
    Number.isFinite(c) && Number.isFinite(s) && s > 0 ? (c / s - 1) * 100 : NaN;
  const saleAvg = mean(saleAll);
  const saleRecent5 = mean(saleR5);
  const convAvg = mean(convAll);
  const convRecent5 = mean(convR5);
  return {
    saleAvg, saleAvgCount: saleAll.length,
    saleRecent5, saleRecent5Count: saleR5.length,
    convAvg, convAvgCount: convAll.length,
    convRecent5, convRecent5Count: convR5.length,
    gapAvg: gap(convAvg, saleAvg),
    gapRecent5: gap(convRecent5, saleRecent5),
  };
}

/** 환산 평당가의 자본환원율 의존성 계수 — mean_ppa(c) = A/c + B */
export interface CapRateAB { A: number; B: number; count: number }

function abOf(rows: TxRecord[], depositYield: number): CapRateAB {
  const valid = rows.filter(
    (r) => r.areaM2 != null && r.areaM2 > 0 && r.depositManwon != null && r.monthlyRentManwon != null,
  );
  if (!valid.length) return { A: NaN, B: NaN, count: 0 };
  const k = 10 / PYEONG;
  const incomePerArea = valid.map((r) => (r.depositManwon! * depositYield + r.monthlyRentManwon! * 12) / r.areaM2!);
  const depoPerArea = valid.map((r) => r.depositManwon! / r.areaM2!);
  return { A: k * mean(incomePerArea), B: k * mean(depoPerArea), count: valid.length };
}

/** 매매가(target) 수준에 맞추는 보정 자본환원율 X = A/(target−B). 양수 해 없으면 NaN */
export function solveCapRate(ab: CapRateAB, target: number): number {
  if (!Number.isFinite(ab.A) || !Number.isFinite(ab.B) || !Number.isFinite(target)) return NaN;
  const denom = target - ab.B;
  if (!(denom > 0) || !(ab.A > 0)) return NaN;
  return ab.A / denom;
}

/** 7번 표 — 현재 자본환원율(7%) 환산가와 매매가 수준 보정 자본환원율 X */
export interface CapRateFix {
  base: number;                                  // 현재 자본환원율 (config.capRate)
  saleAvg: number; saleRecent5: number;          // 매매가 (6번과 동일)
  conv7Avg: number; conv7Recent5: number;        // 7% 환산가 (6번 환산가와 동일)
  xAvg: number; xRecent5: number;                // 보정 자본환원율 (소수, %는 ×100)
  convXAvg: number; convXRecent5: number;        // X% 환산가 (검산 ≈ 매매가)
}

export function buildCapRateFix(tx: TxRecord[], thisYear: number, cfg: AnalysisConfig): CapRateFix {
  const monthly = residMonthly(tx);
  const abAll = abOf(monthly, cfg.depositYield);
  const abR5 = abOf(monthly.filter((r) => within5(r, thisYear)), cfg.depositYield);
  const cmp = buildConvertCompare(tx, thisYear);
  const ppaAt = (ab: CapRateAB, c: number) => (Number.isFinite(ab.A) && c > 0 ? ab.A / c + ab.B : NaN);
  const xAvg = solveCapRate(abAll, cmp.saleAvg);
  const xRecent5 = solveCapRate(abR5, cmp.saleRecent5);
  return {
    base: cfg.capRate,
    saleAvg: cmp.saleAvg, saleRecent5: cmp.saleRecent5,
    conv7Avg: cmp.convAvg, conv7Recent5: cmp.convRecent5,
    xAvg, xRecent5,
    convXAvg: ppaAt(abAll, xAvg), convXRecent5: ppaAt(abR5, xRecent5),
  };
}
