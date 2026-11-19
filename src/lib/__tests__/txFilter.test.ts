// 실거래 조회 필터·정렬·요약 순수 함수 검증
import { describe, it, expect } from 'vitest';
import type { TxRecord } from '@/lib/normalize';
import {
  distinctValues, applyFilters, sortByBuildYear, describeFilters, buildSetLabel, EMPTY_LABEL, type TxFilters,
} from '@/lib/txFilter';

const mk = (o: Partial<TxRecord>): TxRecord => ({
  facility: '오피스텔', trade: '매매', dealType: '매매', name: 'A', buildYear: 2010, areaM2: 30,
  amountManwon: 10000, depositManwon: null, monthlyRentManwon: null, dealDate: '2025-01-01',
  floor: 1, ppa: 1000, buyer: '개인', seller: '개인', raw: {}, ...o,
});

const rows: TxRecord[] = [
  mk({ floor: 10, buyer: '개인', buildYear: 2015 }),
  mk({ floor: 2, buyer: '공공기관', seller: '법인', buildYear: null }),
  mk({ floor: -1, buyer: '법인', buildYear: 2005 }),
  mk({ floor: null, buyer: null, seller: null, buildYear: 2020 }),
  mk({ floor: 1, buyer: '개인', buildYear: 2015 }),
];

describe('distinctValues', () => {
  it('층은 숫자 오름차순(지하층 음수 포함)이고 (빈값)은 맨 끝', () => {
    expect(distinctValues(rows, 'floor')).toEqual(['-1', '1', '2', '10', EMPTY_LABEL]);
  });
  it('매수자는 가나다순에 (빈값) 포함', () => {
    expect(distinctValues(rows, 'buyer')).toEqual(['개인', '공공기관', '법인', EMPTY_LABEL]);
  });
  it('빈값이 없으면 (빈값) 항목도 없다', () => {
    expect(distinctValues(rows, 'dealType')).toEqual(['매매']);
  });
  it('정규화 필드가 없는 예전 레코드는 raw에서 읽는다', () => {
    const old = [{ ...mk({}), buyer: undefined, raw: { buyerGbn: '법인' } } as TxRecord];
    expect(distinctValues(old, 'buyer')).toEqual(['법인']);
  });
});

describe('applyFilters', () => {
  it('필터 없으면 전체', () => {
    expect(applyFilters(rows, {})).toHaveLength(5);
  });
  it('(빈값)을 포함한 전체 선택은 빈값 행을 잃지 않는다', () => {
    const f: TxFilters = { buyer: new Set(distinctValues(rows, 'buyer')) };
    expect(applyFilters(rows, f)).toHaveLength(5);
  });
  it('(빈값)만 선택하면 빈값 행만 남는다', () => {
    const f: TxFilters = { buyer: new Set([EMPTY_LABEL]) };
    const out = applyFilters(rows, f);
    expect(out).toHaveLength(1);
    expect(out[0].buyer).toBeNull();
  });
  it('여러 필터는 AND로 결합된다', () => {
    const f: TxFilters = { buyer: new Set(['개인']), floor: new Set(['1']) };
    const out = applyFilters(rows, f);
    expect(out).toHaveLength(1);
    expect(out[0].floor).toBe(1);
  });
  it('빈 집합이면 결과 0건', () => {
    expect(applyFilters(rows, { floor: new Set() })).toHaveLength(0);
  });
});

describe('sortByBuildYear', () => {
  it('오름차순: 준공연도 없는 행은 맨 아래', () => {
    expect(sortByBuildYear(rows, 'asc').map((r) => r.buildYear)).toEqual([2005, 2015, 2015, 2020, null]);
  });
  it('내림차순에서도 준공연도 없는 행은 맨 아래', () => {
    expect(sortByBuildYear(rows, 'desc').map((r) => r.buildYear)).toEqual([2020, 2015, 2015, 2005, null]);
  });
  it('해제(null)면 원순서, 원본은 변경하지 않는다', () => {
    const before = rows.map((r) => r.buildYear);
    expect(sortByBuildYear(rows, null)).toBe(rows);
    sortByBuildYear(rows, 'asc');
    expect(rows.map((r) => r.buildYear)).toEqual(before);
  });
  it('같은 연도는 원순서를 유지(안정 정렬)', () => {
    const out = sortByBuildYear(rows, 'asc');
    expect(out[1].floor).toBe(10);
    expect(out[2].floor).toBe(1);
  });
});

describe('describeFilters / buildSetLabel', () => {
  it('전체 선택된 컬럼은 요약에서 제외하고 정렬을 덧붙인다', () => {
    const f: TxFilters = { buyer: new Set(['공공기관']), floor: new Set(distinctValues(rows, 'floor')) };
    expect(describeFilters(rows, f, 'asc')).toEqual(['매수자=공공기관', '준공연도 오름차순']);
  });
  it('선택값이 많으면 3개까지만 보이고 나머지는 외 N', () => {
    const f: TxFilters = { floor: new Set(['-1', '1', '2', '10']) };
    expect(describeFilters(rows, f, null)).toEqual(['층=-1, 1, 2 외 1']);
  });
  it('라벨 형식', () => {
    const sub = [rows[1]];
    expect(buildSetLabel(1, sub, ['매수자=공공기관'])).toBe('#1 · 오피스텔 매매 · 매수자=공공기관 · 1건');
    expect(buildSetLabel(2, sub, [])).toBe('#2 · 오피스텔 매매 · 1건');
  });
});
