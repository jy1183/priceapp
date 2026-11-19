/**
 * 화면 간 공유 상태 (Zustand) — 시세·실거래 결과를 종합/검증 화면에서 참조
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_CONFIG, type AnalysisConfig } from '@/lib/calc/constants';
import { buyerOf, sellerOf, type TxRecord } from '@/lib/normalize';
import type { DealType } from '@/lib/txAnalysis';
import type { SiseRawInput } from '@/lib/calc/sise';

/** 시세 확정 1행 (집계용 최소 필드) */
export interface SiseResult {
  facility: string;
  deal: '매매' | '전세' | '월세';
  ppaSupply: number | null;  // 공급/계약 기준 평당가
  ppaExcl: number | null;    // 전용 기준 평당가 (단독·상가주택 등은 대지 대표값)
  ppaYeon: number | null;    // 연면적 기준 평당가 (소스에 연면적이 있을 때)
}

export interface SiseInputRow extends SiseRawInput { id: number }
export interface SiseMeta { parsedCount: number; errorCount: number; }
export interface TxMeta { facility: string; trade: string; region: string; from: string; to: string; }

/** 필터링 데이터 차트 종류 — 실거래가 분석 1~6번 블록 + 5-b */
export type TxChartKind = '1' | '2' | '3' | '4' | '5' | '5b' | '6';
/** 필터링 표 아래 차트 1개 — 같은 블록·거래방식도 중복 추가 가능하므로 id로 구분 */
export interface TxChartSpec { id: string; kind: TxChartKind; deal: DealType }
/** '결과 값 보내기'로 보낸 필터링 표 1건 */
export interface FilteredSet {
  id: string;
  seq: number;             // 표 번호(#N) — 삭제돼도 재사용하지 않도록 최대값+1로 부여
  createdAt: string;       // 보낸 시각(ISO)
  label: string;           // 예) "#1 · 오피스텔 매매 · 매수자=공공기관 · 11건"
  filterDesc: string[];    // 적용 필터·정렬 요약
  meta: TxMeta | null;     // 보낼 당시 조회 조건
  rows: TxRecord[];        // raw 제거본 (localStorage 용량 절감)
  charts: TxChartSpec[];   // 표 아래 차트(추가 순서)
}
/** addFilteredSet 입력 — label은 buildLabel(seq)로 번호 확정 후 생성 */
export interface FilteredSetInput {
  rows: TxRecord[];
  filterDesc: string[];
  meta: TxMeta | null;
  buildLabel: (seq: number) => string;
}

/** raw를 비운 표시·집계용 사본 — 매수자·매도자는 raw에서 복원해 정규화 필드로 옮긴다 */
export const stripRaw = (r: TxRecord): TxRecord => ({ ...r, buyer: buyerOf(r), seller: sellerOf(r), raw: {} });

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 가격 산정 입력 1행 — 시설·타입(평형)별 세대수·전용면적. 단가·적용비율은 표 상단에서 전체 행에 공통 적용(store 최상위 필드). */
export interface PriceCalcRow {
  id: number;
  facility: string;
  type: string;        // 타입(평형) — 예: "84A(34평)"
  units: number | null; // 세대수
  exclM2: number | null; // 전용면적(㎡)
}

/** 지역분석(REB) 조회 결과 스냅샷 — 초기화 전까지 화면에 유지 */
export interface RebPt { time: string; value: number }
export interface RebResult {
  statId: string; statLabel: string; unit: string; start: string; end: string;
  sidoName: string; guName: string;
  sidoSeries: RebPt[]; guSeries: RebPt[]; natl: RebPt[];
}
/** 지역분석(KOSIS 인구) 조회 결과 스냅샷 */
export interface KosisAge { label: string; value: number }
export interface KosisPop { region: string; period: string; total: number; ages: KosisAge[] }
export interface KosisResult {
  pick: { sido: string; lawdCd: string; dong: string };
  data: KosisPop; sido: KosisPop | null;
}

export interface AppState {
  projectName: string;
  config: AnalysisConfig;
  sise: SiseResult[];
  siseMeta: SiseMeta;
  siseInput: SiseInputRow[];   // 파싱 편집 원본(화면 이동에도 유지)
  sisePaste: string;
  siseConfirmed: boolean;
  tx: TxRecord[];
  txMeta: TxMeta | null;
  txForm: { sido: string; lawdCd: string; dong: string; facility: string; trade: string; from: string; to: string; period: string };
  rebResult: RebResult | null;
  kosisResult: KosisResult | null;
  priceCalc: PriceCalcRow[];
  priceCalcKey: string | null;  // 가격 산정 — 표 상단 공통 평당매매가격(적용 단가) 선택
  priceCalcRatio: number;       // 가격 산정 — 표 상단 공통 적용비율(%), 기본 100
  filteredSets: FilteredSet[];  // 필터링 데이터 — 보낸 표 목록(보낸 순서)
  setProjectName: (v: string) => void;
  setConfig: (c: AnalysisConfig) => void;
  setSise: (rows: SiseResult[], meta: SiseMeta) => void;
  setSiseInput: (rows: SiseInputRow[]) => void;
  setSisePaste: (v: string) => void;
  setSiseConfirmed: (v: boolean) => void;
  resetSise: () => void;
  setTx: (rows: TxRecord[], meta: TxMeta) => void;
  appendTx: (rows: TxRecord[]) => void;
  setTxForm: (f: Partial<AppState['txForm']>) => void;
  setRebResult: (r: RebResult | null) => void;
  setKosisResult: (k: KosisResult | null) => void;
  setPriceCalc: (rows: PriceCalcRow[]) => void;
  setPriceCalcKey: (key: string | null) => void;
  setPriceCalcRatio: (ratio: number) => void;
  addFilteredSet: (input: FilteredSetInput) => FilteredSet;
  removeFilteredSet: (id: string) => void;
  addChart: (setId: string, spec: { kind: TxChartKind; deal: DealType }) => void;
  removeChart: (setId: string, chartId: string) => void;
  loadSnapshot: (s: Partial<AppState>) => void;
}

/** 로컬 저장(엑셀 _appdata)·복원 대상 필드 — persist partialize와 동일 범위 */
export type SnapshotState = Pick<AppState,
  | 'projectName' | 'config'
  | 'sise' | 'siseMeta' | 'siseInput' | 'sisePaste' | 'siseConfirmed'
  | 'tx' | 'txMeta' | 'txForm'
  | 'rebResult' | 'kosisResult'
  | 'priceCalc' | 'priceCalcKey' | 'priceCalcRatio'
  | 'filteredSets'
>;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
  projectName: '무제 검토',
  config: DEFAULT_CONFIG,
  sise: [],
  siseMeta: { parsedCount: 0, errorCount: 0 },
  siseInput: [],
  sisePaste: '',
  siseConfirmed: false,
  tx: [],
  txMeta: null,
  txForm: { sido: '서울특별시', lawdCd: '11560', dong: '영등포동8가', facility: '오피스텔', trade: '매매', from: '202501', to: '202506', period: 'all' },
  rebResult: null,
  kosisResult: null,
  priceCalc: [],
  priceCalcKey: null,
  priceCalcRatio: 100,
  filteredSets: [],
  setProjectName: (v) => set({ projectName: v }),
  setConfig: (config) => set({ config }),
  setSise: (sise, siseMeta) => set({ sise, siseMeta }),
  setSiseInput: (siseInput) => set({ siseInput }),
  setSisePaste: (sisePaste) => set({ sisePaste }),
  setSiseConfirmed: (siseConfirmed) => set({ siseConfirmed }),
  resetSise: () => set({ siseInput: [], sisePaste: '', siseConfirmed: false, sise: [], siseMeta: { parsedCount: 0, errorCount: 0 } }),
  setTx: (tx, txMeta) => set({ tx, txMeta }),
  appendTx: (rows) => set((st) => ({ tx: [...st.tx, ...rows] })),
  setTxForm: (f) => set((st) => ({ txForm: { ...st.txForm, ...f } })),
  setRebResult: (rebResult) => set({ rebResult }),
  setKosisResult: (kosisResult) => set({ kosisResult }),
  setPriceCalc: (priceCalc) => set({ priceCalc }),
  setPriceCalcKey: (priceCalcKey) => set({ priceCalcKey }),
  setPriceCalcRatio: (priceCalcRatio) => set({ priceCalcRatio }),
  addFilteredSet: (input) => {
    let created!: FilteredSet;
    set((st) => {
      const seq = st.filteredSets.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
      created = {
        id: newId(), seq, createdAt: new Date().toISOString(),
        label: input.buildLabel(seq), filterDesc: input.filterDesc, meta: input.meta,
        rows: input.rows.map(stripRaw), charts: [],
      };
      return { filteredSets: [...st.filteredSets, created] };
    });
    return created;
  },
  removeFilteredSet: (id) => set((st) => ({ filteredSets: st.filteredSets.filter((x) => x.id !== id) })),
  addChart: (setId, spec) => set((st) => ({
    filteredSets: st.filteredSets.map((x) => (x.id === setId ? { ...x, charts: [...x.charts, { id: newId(), ...spec }] } : x)),
  })),
  removeChart: (setId, chartId) => set((st) => ({
    filteredSets: st.filteredSets.map((x) => (x.id === setId ? { ...x, charts: x.charts.filter((c) => c.id !== chartId) } : x)),
  })),
  // 예전 파일(filteredSets 없음)을 불러오면 이전 화면의 표가 남지 않도록 빈 목록으로 초기화
  loadSnapshot: (s) => set({ ...s, filteredSets: s.filteredSets ?? [] }),
    }),
    {
      name: 'priceapp-store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : undefined as any)),
      skipHydration: true, // SSR 불일치 방지 — 클라이언트 마운트 후 수동 rehydrate
      partialize: (st) => ({
        projectName: st.projectName, config: st.config,
        sise: st.sise, siseMeta: st.siseMeta,
        siseInput: st.siseInput, sisePaste: st.sisePaste, siseConfirmed: st.siseConfirmed,
        tx: st.tx, txMeta: st.txMeta, txForm: st.txForm,
        rebResult: st.rebResult, kosisResult: st.kosisResult,
        priceCalc: st.priceCalc, priceCalcKey: st.priceCalcKey, priceCalcRatio: st.priceCalcRatio,
        filteredSets: st.filteredSets,
      }),
    },
  ),
);
