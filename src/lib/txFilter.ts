// 실거래 조회 표의 머릿글 필터·준공연도 정렬·필터 요약을 담당하는 순수 함수 모음
import { txValue, type TxRecord } from '@/lib/normalize';

/** 머릿글 드롭다운 필터를 지원하는 컬럼 */
export type FilterKey = 'name' | 'dealType' | 'floor' | 'buyer' | 'seller';
export const FILTER_KEYS: FilterKey[] = ['name', 'dealType', 'floor', 'buyer', 'seller'];
export const FILTER_LABELS: Record<FilterKey, string> = {
  name: '시설명', dealType: '거래', floor: '층', buyer: '매수자', seller: '매도자',
};

/** 컬럼별 "표시할 값" 집합 — 키가 없으면 그 컬럼은 필터 미적용(전체 표시) */
export type TxFilters = Partial<Record<FilterKey, Set<string>>>;
export type SortDir = 'asc' | 'desc' | null;

/** 값이 없는(null·빈 문자열) 행을 나타내는 필터 항목 */
export const EMPTY_LABEL = '(빈값)';

/** 행의 컬럼 값을 필터 항목 문자열로 변환 — 빈값은 (빈값) */
export function filterValueOf(r: TxRecord, key: FilterKey): string {
  const v = txValue(r, key);
  return v == null || v === '' ? EMPTY_LABEL : String(v);
}

/** 필터 목록용 고유값 — 층은 숫자 오름차순(지하층 음수 포함), 그 외는 가나다순, (빈값)은 맨 끝 */
export function distinctValues(rows: TxRecord[], key: FilterKey): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(filterValueOf(r, key));
  const hasEmpty = set.delete(EMPTY_LABEL);
  const vals = [...set];
  if (key === 'floor') {
    vals.sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, 'ko');
    });
  } else {
    vals.sort((a, b) => a.localeCompare(b, 'ko'));
  }
  if (hasEmpty) vals.push(EMPTY_LABEL);
  return vals;
}

/** 활성 필터를 모두 통과(AND)한 행만 반환 */
export function applyFilters(rows: TxRecord[], filters: TxFilters): TxRecord[] {
  const active = (Object.entries(filters) as [FilterKey, Set<string> | undefined][]).filter(([, set]) => !!set);
  if (active.length === 0) return rows;
  return rows.filter((r) => active.every(([k, set]) => set!.has(filterValueOf(r, k))));
}

/** 준공연도 정렬 — 해제(null)면 원순서 유지, 준공연도 없는 행은 항상 맨 아래. 원본 배열은 변경하지 않음 */
export function sortByBuildYear(rows: TxRecord[], dir: SortDir): TxRecord[] {
  if (!dir) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ya = a.r.buildYear, yb = b.r.buildYear;
      if (ya == null && yb == null) return a.i - b.i;
      if (ya == null) return 1;
      if (yb == null) return -1;
      return ya === yb ? a.i - b.i : (ya - yb) * sign;
    })
    .map((x) => x.r);
}

/** 적용 중인 필터·정렬 요약 문자열 목록 — 예) ["매수자=공공기관", "준공연도 오름차순"] */
export function describeFilters(
  rows: TxRecord[], filters: TxFilters, sortDir: SortDir, maxValues = 3,
): string[] {
  const out: string[] = [];
  for (const key of FILTER_KEYS) {
    const set = filters[key];
    if (!set) continue;
    const all = distinctValues(rows, key);
    if (set.size >= all.length) continue; // 전체 선택 = 미적용
    const picked = all.filter((v) => set.has(v));
    const shown = picked.slice(0, maxValues).join(', ');
    const rest = picked.length - maxValues;
    out.push(`${FILTER_LABELS[key]}=${picked.length === 0 ? '(선택 없음)' : shown}${rest > 0 ? ` 외 ${rest}` : ''}`);
  }
  if (sortDir) out.push(`준공연도 ${sortDir === 'asc' ? '오름차순' : '내림차순'}`);
  return out;
}

/** 필터링 표 라벨 — 예) "#1 · 오피스텔 매매 · 매수자=공공기관 · 11건" */
export function buildSetLabel(seq: number, rows: TxRecord[], filterDesc: string[]): string {
  const facs = [...new Set(rows.map((r) => r.facility))].join('·');
  const deals = [...new Set(rows.map((r) => r.dealType))].join('·');
  return [`#${seq}`, `${facs} ${deals}`.trim(), ...filterDesc, `${rows.length}건`].join(' · ');
}

/** 실거래 표 컬럼 정의 — 조회 페이지와 필터링 데이터 페이지가 같은 컬럼·서식을 쓴다 */
export interface TxColumn { key: keyof TxRecord; label: string; fmt?: (v: any) => string }
const num0 = (v: any) => v?.toLocaleString() ?? '';
export const TX_COLUMNS: TxColumn[] = [
  { key: 'facility', label: '유형' },
  { key: 'name', label: '시설명' },
  { key: 'dealType', label: '거래' },
  { key: 'dealDate', label: '거래일' },
  { key: 'buildYear', label: '준공연도' },
  { key: 'areaM2', label: '면적(㎡)' },
  { key: 'amountManwon', label: '금액(만원)', fmt: num0 },
  { key: 'depositManwon', label: '보증금(만원)', fmt: num0 },
  { key: 'monthlyRentManwon', label: '월세(만원)', fmt: num0 },
  { key: 'floor', label: '층' },
  { key: 'buyer', label: '매수자' },
  { key: 'seller', label: '매도자' },
  { key: 'ppa', label: '평당가(천원/평)', fmt: num0 },
];

/** 값이 하나라도 있는 컬럼만 노출 — 전월세·토지 조회 시 매수자·매도자가 자동으로 숨는다 */
export function visibleColumns(rows: TxRecord[]): TxColumn[] {
  return TX_COLUMNS.filter((c) => rows.some((r) => { const v = txValue(r, c.key); return v != null && v !== ''; }));
}
