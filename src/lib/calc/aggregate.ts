/**
 * 집계 로직 — 평균 / 상위 n% 평균
 * 근거: 계산로직_명세서 §1-3, §2-2
 * 상위 n% 평균 = PERCENTILE.INC(p) 이상 값들의 평균 (엑셀 배열수식 재현)
 */

/**
 * Excel PERCENTILE.INC 동일 구현 (numpy 'linear' 보간과 일치, 골든셋으로 검증됨)
 * @param values 원본 배열 (정렬 불필요)
 * @param p 0~1 백분위
 */
export function percentileInc(values: number[], p: number): number {
  const arr = [...values].sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return NaN;
  if (n === 1) return arr[0];
  const rank = p * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return arr[lo];
  return arr[lo] + (rank - lo) * (arr[hi] - arr[lo]);
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** 상위 n% 평균: 임계값(percentile p) 이상 값들의 평균 */
export function topPercentAverage(values: number[], p: number): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return NaN;
  const threshold = percentileInc(clean, p);
  const top = clean.filter((v) => v >= threshold);
  return mean(top);
}

/** 시설 집계 결과 묶음 */
export interface AggregateResult {
  count: number;
  avg: number;
  top10: number; // p=0.9
  top30: number; // p=0.7
  top50: number; // p=0.5
}

export function aggregate(
  values: number[],
  pct = { top10: 0.9, top30: 0.7, top50: 0.5 },
): AggregateResult {
  const clean = values.filter((v) => Number.isFinite(v));
  return {
    count: clean.length,
    avg: mean(clean),
    top10: topPercentAverage(clean, pct.top10),
    top30: topPercentAverage(clean, pct.top30),
    top50: topPercentAverage(clean, pct.top50),
  };
}
