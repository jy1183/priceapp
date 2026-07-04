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

import { parseNaverPaste } from '../sise';
describe('네이버 붙여넣기 파서 (anchor=가격줄)', () => {
  const paste = [
    '리버리치', '매매 3억 5,000', '오피스텔', '5년차(2016.03.)', '전용 39.98㎡', '5/15층', '남향',
    '확인매물 25.06.30.', '리버리치공인중개사', '',
    '문래자이', '전세 6억', '아파트', '전용 84.9㎡', '12/25층',
  ].join('\n');

  it('가격 줄 기준으로 2건 추출·필드 매핑·노이즈 제거', () => {
    const items = parseNaverPaste(paste);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('리버리치');
    expect(items[0].facility).toBe('오피스텔');
    expect(items[0].approvalDate).toBe('5년차');
    expect(items[0].amountText).toBe('매매 3억 5,000');
    expect(items[0].areaText).toContain('전용 39.98㎡');
    expect(items[0].areaText).toContain('5/15층');
    expect(items[0].areaText).toContain('남향');
    expect(items[1].facility).toBe('아파트');
    expect(items[1].amountText).toBe('전세 6억');
  });

  it('노이즈(공인중개사/확인매물)는 기타로 안 들어감', () => {
    const items = parseNaverPaste(paste);
    expect(items[0].areaText).not.toContain('공인중개사');
    expect(items[0].areaText).not.toContain('확인매물');
  });
});

describe('네이버 파서 — 유형이 면적 줄 앞에 붙는 실제 형식', () => {
  const paste = [
    '펠리시티 1동', '매매 5억 7,500', '아파트66B㎡ (전용55B)4/14층',
    '삼흥리치(주상복합)', '매매 5억 6,000', '아파트69㎡ (전용59)8/15층',
  ].join('\n');
  it('시설=아파트 추출, 면적에서 유형 제거', () => {
    const items = parseNaverPaste(paste);
    expect(items).toHaveLength(2);
    expect(items[0].facility).toBe('아파트');
    expect(items[0].areaText.startsWith('아파트')).toBe(false);
    expect(items[0].areaText).toContain('전용55');
    expect(items[1].facility).toBe('아파트');
  });
});
