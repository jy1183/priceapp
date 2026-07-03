/**
 * 골든 데이터셋 테스트 — 엑셀 결과값 0 오차 대조 (Phase 1·2 필수 관문)
 * fixtures/golden_dataset.json = 영등포동8가 사례 추출
 */
import { describe, it, expect } from 'vitest';
import golden from '../../../../fixtures/golden_dataset.json';
import { ppaTrade } from '../transaction';
import { aggregate, mean } from '../aggregate';

describe('골든 데이터셋 — 실거래 평당가 & 집계', () => {
  const byId = Object.fromEntries(golden.cases.map((c: any) => [c.id, c]));

  it('오피스텔 실거래 매매: 평균/상위10/30/50% 엑셀 일치', () => {
    const c = byId['오피스텔_실거래_매매'];
    const ppa = c.rows.map((r: any) => ppaTrade(r.amt_manwon, r.excl_m2));
    const agg = aggregate(ppa);
    expect(agg.count).toBe(14);
    expect(agg.avg).toBeCloseTo(c.expected.mean, 6);
    expect(agg.top10).toBeCloseTo(c.expected.top10pct, 6);
    expect(agg.top30).toBeCloseTo(c.expected.top30pct, 6);
    expect(agg.top50).toBeCloseTo(c.expected.top50pct, 6);
  });

  it('토지 실거래 매매: 평균 엑셀 일치', () => {
    const c = byId['토지_실거래_매매'];
    const ppa = c.rows.map((r: any) => ppaTrade(r.amt_manwon, r.area_m2));
    expect(mean(ppa)).toBeCloseTo(c.expected_mean_excel, 6);
  });

  it('평당가 산출식 단일행 검산', () => {
    // 12800만원 / 19.86㎡ × 3.3058 × 10
    expect(ppaTrade(12800, 19.86)).toBeCloseTo((12800 / 19.86) * 3.3058 * 10, 9);
  });
});
