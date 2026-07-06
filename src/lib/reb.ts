/** 부동산원 r-one 통계 카탈로그 (지역분석실행계획.MD) */
export interface RebStat { id: string; label: string; statbl: string; cycle: string; unit: string; }
export const REB_STATS: RebStat[] = [
  { id: 'sale_idx',  label: '매매가격지수(주택종합)',        statbl: 'A_2024_00016',      cycle: 'MM', unit: '지수' },
  { id: 'jeonse_ratio', label: '평균 매매 대비 전세가격(주택종합)', statbl: 'A_2024_00037',   cycle: 'MM', unit: '천원' },
  { id: 'shop_rent', label: '상가 임대가격지수(통합)',        statbl: 'TT249683134828248', cycle: 'QY', unit: '지수' },
  { id: 'trade_cnt', label: '주택매매 거래현황',              statbl: 'A_2024_00552',      cycle: 'MM', unit: '건' },
];
export const rebStat = (id: string) => REB_STATS.find((s) => s.id === id);

/** REB 통계 항목(지역) 1건 — /api/reb?mode=items 응답 형식 */
export interface RebItem { clsId: string; name: string; fullNm: string; par: string; }

export const REB_NATIONWIDE_CLS = '500001'; // 전국

/** 법정동 시도명 → 부동산원 통계의 짧은 시도명 (예: 서울특별시→서울, 충청북도→충북) */
const SIDO_TO_REB: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
  '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종',
  '경기도': '경기', '강원도': '강원', '강원특별자치도': '강원',
  '충청북도': '충북', '충청남도': '충남',
  '전라북도': '전북', '전북특별자치도': '전북', '전라남도': '전남',
  '경상북도': '경북', '경상남도': '경남',
  '제주특별자치도': '제주', '제주도': '제주',
};
export function rebSidoName(sido: string): string {
  return SIDO_TO_REB[sido] ?? sido.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/,'');
}

/** items 중 시도(최상위) CLS_ID — 실거래 조회지역의 시도(기준1)
 *  통계별로 시도명이 짧은형(서울)·전체형(서울특별시) 모두 있을 수 있어 후보 다중 매칭 */
export function findSidoCls(items: RebItem[], sido: string): RebItem | undefined {
  const cands = [rebSidoName(sido), sido, sido.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, '')];
  const tops = items.filter((i) => i.par === '0');
  for (const c of cands) { const hit = tops.find((i) => i.name === c); if (hit) return hit; }
  return undefined;
}

/** items 중 해당 시군구(구) CLS_ID — 시도 계층 하위에서 이름 일치(기준2)
 *  '동'은 REB 매매가격지수에 없으므로 시군구(구)로 폴백. 시군구명이 여러 토큰이면 마지막 토큰 우선. */
export function findGuCls(items: RebItem[], sido: string, sigunguName: string): RebItem | undefined {
  const prefixes = [rebSidoName(sido) + '>', sido + '>'];
  const tokens = sigunguName.trim().split(/\s+/).filter(Boolean); // 예: '수원시 팔달구'
  const inSido = items.filter((i) => prefixes.some((p) => i.fullNm.startsWith(p)));
  for (const t of [...tokens].reverse()) {          // 하위 토큰(구) 우선 매칭
    const hit = inSido.find((i) => i.name === t);
    if (hit) return hit;
  }
  return inSido.find((i) => i.name === sigunguName);
}
