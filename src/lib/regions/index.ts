/** 법정동코드 지역 데이터 (xlsm 법정동코드·동목록 시트 내장) */
import data from './regions.json';

export interface Sigungu { sigungu: string; code: string; dongs: string[] }
export const SIDO_LIST: string[] = data.sido;
export const BY_SIDO: Record<string, Sigungu[]> = data.byShido as Record<string, Sigungu[]>;

export function sigunguOf(sido: string): Sigungu[] {
  return BY_SIDO[sido] ?? [];
}
export function dongsOf(sido: string, code: string): string[] {
  return (BY_SIDO[sido] ?? []).find((s) => s.code === code)?.dongs ?? [];
}
/** 시도+법정동(시군구 5자리)코드 → 시군구명 (예: 서울특별시,11560 → 영등포구) */
export function sigunguName(sido: string, code: string): string {
  return (BY_SIDO[sido] ?? []).find((s) => s.code === code)?.sigungu ?? '';
}
