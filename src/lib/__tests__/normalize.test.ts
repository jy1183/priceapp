// 실거래 정규화의 매수자·매도자 필드와 raw 폴백 헬퍼 검증
import { describe, it, expect } from 'vitest';
import { normalize, buyerOf, sellerOf, type TxRecord } from '@/lib/normalize';

const saleItem = {
  offiNm: '테스트오피스텔', buildYear: '2015', excluUseAr: '39.98', dealAmount: '35,000',
  dealYear: '2025', dealMonth: '3', dealDay: '5', floor: '5', buyerGbn: '공공기관', slerGbn: '개인',
};

describe('normalize 매수자·매도자', () => {
  it('매매 item의 buyerGbn/slerGbn을 buyer/seller로 담는다', () => {
    const r = normalize('오피스텔', '매매', saleItem);
    expect(r.buyer).toBe('공공기관');
    expect(r.seller).toBe('개인');
  });

  it('전월세·토지처럼 필드가 없으면 null이다', () => {
    const rent = normalize('오피스텔', '전월세', { offiNm: 'x', deposit: '10,000', monthlyRent: '0', excluUseAr: '30' });
    expect(rent.buyer).toBeNull();
    expect(rent.seller).toBeNull();
    const land = normalize('토지', '매매', { jibun: '1', dealAmount: '1000', dealArea: '10' });
    expect(land.buyer).toBeNull();
    expect(land.seller).toBeNull();
  });

  it('빈 문자열·공백은 null로 정규화한다', () => {
    const r = normalize('상업업무용', '매매', { ...saleItem, buyerGbn: '', slerGbn: '  ' });
    expect(r.buyer).toBeNull();
    expect(r.seller).toBeNull();
  });
});

describe('buyerOf / sellerOf 호환 헬퍼', () => {
  const base = { raw: { buyerGbn: '법인', slerGbn: '기타' } } as Pick<TxRecord, 'raw'>;

  it('정규화 필드가 없는 예전 레코드는 raw에서 읽는다', () => {
    expect(buyerOf(base as TxRecord)).toBe('법인');
    expect(sellerOf(base as TxRecord)).toBe('기타');
  });

  it('정규화 필드가 있으면 그 값을 우선한다(null 포함)', () => {
    expect(buyerOf({ ...base, buyer: '개인' } as TxRecord)).toBe('개인');
    expect(buyerOf({ ...base, buyer: null } as TxRecord)).toBeNull();
  });

  it('raw에도 없으면 null', () => {
    expect(buyerOf({ raw: {} } as TxRecord)).toBeNull();
    expect(sellerOf({ raw: {} } as TxRecord)).toBeNull();
  });
});
