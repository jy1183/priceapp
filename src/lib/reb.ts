/** 부동산원 r-one 통계 카탈로그 (지역분석실행계획.MD) */
export interface RebStat { id: string; label: string; statbl: string; cycle: string; unit: string; }
export const REB_STATS: RebStat[] = [
  { id: 'sale_idx',  label: '매매가격지수(주택종합)',        statbl: 'A_2024_00016',      cycle: 'MM', unit: '지수' },
  { id: 'jeonse_ratio', label: '평균 매매 대비 전세가격(주택종합)', statbl: 'A_2024_00037',   cycle: 'MM', unit: '천원' },
  { id: 'shop_rent', label: '상가 임대가격지수(통합)',        statbl: 'TT249683134828248', cycle: 'QY', unit: '지수' },
  { id: 'trade_cnt', label: '주택매매 거래현황',              statbl: 'A_2024_00552',      cycle: 'MM', unit: '건' },
];
export const rebStat = (id: string) => REB_STATS.find((s) => s.id === id);
