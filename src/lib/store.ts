/**
 * 화면 간 공유 상태 (Zustand) — 시세·실거래 결과를 종합/검증 화면에서 참조
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_CONFIG, type AnalysisConfig } from '@/lib/calc/constants';
import type { TxRecord } from '@/lib/normalize';
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

interface AppState {
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
  loadSnapshot: (s: Partial<AppState>) => void;
}

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
  loadSnapshot: (s) => set(s),
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
      }),
    },
  ),
);
