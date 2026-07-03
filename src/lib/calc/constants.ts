/**
 * 계산 전역 상수 / 분석환경설정 변수 (엑셀 → TS 이식)
 * 근거: 20260703 계산로직_명세서.md §0
 * 사용자 결정(2026-07-03): 평환산 0.3025 통일, 보증금운영수익률 독립 변수
 */

/** 분석 변수 (전역 기본값 → 프로젝트별 오버라이드 → 화면 임시조정) */
export interface AnalysisConfig {
  /** 자본환원율 (기본 0.07) */
  capRate: number;
  /** 보증금운영수익률 — 독립 변수 (기본 0.035) */
  depositYield: number;
  /** 보증금운영수익률 산정 근거 메모 (재조회 추적용) */
  depositYieldMemo: string;
  /** 상위평균 산출 기준 백분위 집합 (상위10/30/50%) */
  topPercentiles: { top10: number; top30: number; top50: number };
}

/** ㎡ → 평 환산계수 (전 면적 통일) */
export const PYEONG = 0.3025;
/** 평당가 산출용 계수 (1평 = 3.3058㎡) */
export const PYEONG_FACTOR = 3.3058;

/** 전역 기본 분석 변수 */
export const DEFAULT_CONFIG: AnalysisConfig = {
  capRate: 0.07,
  depositYield: 0.035,
  depositYieldMemo: '자본환원율의 50% (은행이자 상당) 기준 산정',
  topPercentiles: { top10: 0.9, top30: 0.7, top50: 0.5 },
};

/** 시세 시설 구분 라벨 */
export const SISE_FACILITIES = [
  '아파트', '오피스텔', '빌라／연립', '원룸', '단독/다가구', '전원주택',
  '상가주택', '상가점포', '상가건물', '사무실', '토지', '공장／창고',
  '지식산업센터', '기타',
] as const;

export type DealType = '매매' | '전세' | '월세';
