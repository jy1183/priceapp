// 종합검토 6·7번 집계·자본환원율 보정 검증
import { describe, it, expect } from 'vitest';
import { buildConvertCompare, buildCapRateFix, solveCapRate } from '@/lib/summaryConvert';
import { convertedSaleFromMonthly } from '@/lib/calc/transaction';
import { DEFAULT_CONFIG } from '@/lib/calc/constants';
import type { TxRecord } from '@/lib/normalize';

const PYEONG = 0.3025;
const cfg = DEFAULT_CONFIG;

/** 월세 환산 평당가(기본 자본환원율) — normalize.ts와 동일식 */
const monthlyPpa = (d: number, m: number, area: number) =>
  convertedSaleFromMonthly(d, m, cfg) / (area * PYEONG);

const base: Omit<TxRecord, 'facility' | 'dealType' | 'ppa'> = {
  trade: '매매' as TxRecord['trade'],
  name: '테스트', buildYear: 2015, areaM2: 40,
  amountManwon: null, depositManwon: null, monthlyRentManwon: null,
  dealDate: '2026-01-01', floor: 3, raw: {},
};
const sale = (ppa: number, buildYear = 2015): TxRecord =>
  ({ ...base, facility: '아파트', dealType: '매매', buildYear, ppa });
const monthly = (d: number, m: number, area: number, buildYear = 2015): TxRecord =>
  ({ ...base, facility: '아파트', dealType: '월세', buildYear, areaM2: area,
     depositManwon: d, monthlyRentManwon: m, ppa: monthlyPpa(d, m, area) });

describe('buildConvertCompare — 매매가 vs 환산가', () => {
  it('평균·차이비율 산출', () => {
    const tx = [sale(40000), sale(50000), monthly(10000, 50, 40), monthly(5000, 80, 33)];
    const c = buildConvertCompare(tx, 2026);
    expect(c.saleAvg).toBeCloseTo(45000, 6);
    expect(c.saleAvgCount).toBe(2);
    expect(c.convAvgCount).toBe(2);
    // 차이비율 = (환산가−매매가)/매매가
    expect(c.gapAvg).toBeCloseTo((c.convAvg / c.saleAvg - 1) * 100, 6);
  });

  it('주거 시설만 집계 (토지·상업 제외)', () => {
    const land: TxRecord = { ...base, facility: '토지', dealType: '매매', ppa: 99999 };
    const c = buildConvertCompare([sale(40000), land], 2026);
    expect(c.saleAvg).toBeCloseTo(40000, 6); // 토지 제외
    expect(c.saleAvgCount).toBe(1);
  });
});

describe('buildCapRateFix — 자본환원율 보정', () => {
  it('보정 자본환원율 X로 환산가가 매매가와 일치(검산)', () => {
    const tx = [sale(40000), sale(50000), monthly(10000, 50, 40), monthly(5000, 80, 33)];
    const f = buildCapRateFix(tx, 2026, cfg);
    expect(f.base).toBe(0.07);
    expect(f.conv7Avg).toBeCloseTo(f.conv7Avg, 6); // 존재
    expect(f.xAvg).toBeGreaterThan(0);
    // 핵심 불변식: A/X + B == 매매가 평균
    expect(f.convXAvg).toBeCloseTo(f.saleAvg, 4);
  });

  it('매매가가 보증금 원금 항(B)보다 작으면 해 없음(NaN)', () => {
    // 보증금이 매우 큰 월세 + 매매가 매우 낮음
    const tx = [sale(100), monthly(50000, 10, 30)];
    const f = buildCapRateFix(tx, 2026, cfg);
    expect(Number.isNaN(f.xAvg)).toBe(true);
    expect(Number.isNaN(f.convXAvg)).toBe(true);
  });

  it('solveCapRate: target ≤ B → NaN', () => {
    expect(Number.isNaN(solveCapRate({ A: 1000, B: 5000, count: 1 }, 4000))).toBe(true);
    expect(solveCapRate({ A: 1000, B: 5000, count: 1 }, 15000)).toBeCloseTo(1000 / 10000, 9);
  });
});
