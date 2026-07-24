/**
 * 실거래 평당가 산출 (시설유형별) — 단위: 천원/평
 * 근거: 계산로직_명세서 §2-1
 * 결정 반영: 단독다가구 ×3.3058 통일, 평환산 0.3025 통일
 */
import { PYEONG, PYEONG_FACTOR, type AnalysisConfig } from './constants';

/** 매매 공통형: 전용평당가 = 금액(만원) / 면적(㎡) × 3.3058 × 10 */
export function ppaTrade(amountManwon: number, areaM2: number): number {
  if (!(areaM2 > 0) || !Number.isFinite(amountManwon)) return NaN;
  return (amountManwon / areaM2) * PYEONG_FACTOR * 10;
}

/** 단독다가구 매매 — 금액 / 대지㎡ × 3.3058 × 10 (결정②로 통일) */
export const ppaDetachedTrade = ppaTrade;

/** 전세 — 보증금 기준 전용평당가 */
export function ppaJeonse(depositManwon: number, exclM2: number): number {
  return ppaTrade(depositManwon, exclM2);
}

/** 월세 → 매매환산가(천원) = ((보증금×depositYield + 월세×12) / capRate + 보증금) × 10
 *  소유자는 보증금 운용수익·월세뿐 아니라 보증금 원금도 보유하므로 보증금을 포함해 산출. */
export function convertedSaleFromMonthly(
  depositManwon: number,
  monthlyRentManwon: number,
  cfg: AnalysisConfig,
): number {
  return (((depositManwon * cfg.depositYield + monthlyRentManwon * 12) / cfg.capRate) + depositManwon) * 10;
}

/** 월세 전용평당가 = 매매환산가 / (전용㎡ × 0.3025) */
export function ppaMonthly(
  depositManwon: number,
  monthlyRentManwon: number,
  exclM2: number,
  cfg: AnalysisConfig,
): number {
  if (!(exclM2 > 0)) return NaN;
  const converted = convertedSaleFromMonthly(depositManwon, monthlyRentManwon, cfg);
  return converted / (exclM2 * PYEONG);
}

/** 준공연도 기준 최근 N년 이내 건축물 여부 (결정④) */
export function isRecentBuilt(buildYear: number, withinYears: number, todayYear: number): boolean {
  return buildYear >= todayYear - withinYears && buildYear <= todayYear;
}
