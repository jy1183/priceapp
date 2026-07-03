/**
 * 국토부 실거래가 API 정의 (공공데이터포털 1613000)
 * 근거: 계산로직_명세서 §3, 20260430 실거래가_VBA코드_개선안.vba
 */
export const MOLIT_BASE = 'https://apis.data.go.kr/1613000';

export type Facility = '아파트' | '오피스텔' | '연립다세대' | '단독다가구' | '토지' | '상업업무용';
export type Trade = '매매' | '전월세';

/** 시설 × 거래 → 엔드포인트 경로 (전월세 없는 시설은 null) */
export const ENDPOINTS: Record<Facility, { 매매: string; 전월세: string | null }> = {
  아파트:     { 매매: 'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',   전월세: 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent' },
  오피스텔:   { 매매: 'RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade', 전월세: 'RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent' },
  연립다세대: { 매매: 'RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',     전월세: 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent' },
  단독다가구: { 매매: 'RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade',     전월세: 'RTMSDataSvcSHRent/getRTMSDataSvcSHRent' },
  토지:       { 매매: 'RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade', 전월세: null },
  상업업무용: { 매매: 'RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade',   전월세: null },
};

export function endpointUrl(facility: Facility, trade: Trade): string | null {
  const e = ENDPOINTS[facility];
  const path = trade === '매매' ? e.매매 : e.전월세;
  return path ? `${MOLIT_BASE}/${path}` : null;
}
