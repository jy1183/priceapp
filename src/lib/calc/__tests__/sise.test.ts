import { describe, it, expect } from 'vitest';
import { parseSiseRaw, amountToCheonwon } from '../sise';
import { DEFAULT_CONFIG } from '../constants';

describe('시세 파서 · 평당가', () => {
  it('금액 파싱: 억+만원 → 천원', () => {
    expect(amountToCheonwon('3억5000')).toBe(350000); // 3.5억
    expect(amountToCheonwon('6억')).toBe(600000);
    expect(amountToCheonwon('3,500')).toBe(35000);
  });

  it('매매 전용 평당가 (÷0.3025)', () => {
    const { ppa, errors } = parseSiseRaw(
      { facility: '오피스텔', amountText: '매매 3억5000', areaText: '전용39.98㎡ 5/15층' },
      DEFAULT_CONFIG,
    );
    expect(errors).toHaveLength(0);
    expect(ppa.convertedSale).toBe(350000);
    // 350000 / (39.98*0.3025)
    expect(ppa.ppaExcl!).toBeCloseTo(350000 / (39.98 * 0.3025), 6);
  });

  it('월세 자본환원 환산매매가 = (월세×12 + 보증금×0.035)/0.07', () => {
    const { ppa, errors } = parseSiseRaw(
      { facility: '오피스텔', amountText: '월세 3000/130', areaText: '전용29.7㎡ 3/15층' },
      DEFAULT_CONFIG,
    );
    expect(errors).toHaveLength(0);
    const expected = (1300 * 12 + 30000 * 0.035) / 0.07; // 천원
    expect(ppa.convertedSale).toBeCloseTo(expected, 6);
    expect(ppa.ppaExcl!).toBeCloseTo(expected / (29.7 * 0.3025), 6);
  });

  it('전세 평당보증금, 환산매매가 0', () => {
    const { ppa } = parseSiseRaw(
      { facility: '아파트', amountText: '전세 6억', areaText: '전용84.9㎡ 12/25층' },
      DEFAULT_CONFIG,
    );
    expect(ppa.convertedSale).toBe(0);
  });
});
