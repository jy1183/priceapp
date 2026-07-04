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
  ppaExcl: number | null;    // 전용 기준 평당가
}

export interface SiseInputRow extends SiseRawInput { id: number }
export interface SiseMeta { parsedCount: number; errorCount: number; }
export interface TxMeta { facility: string; trade: string; region: string; from: string; to: string; }

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
  setProjectName: (v: string) => void;
  setConfig: (c: AnalysisConfig) => void;
  setSise: (rows: SiseResult[], meta: SiseMeta) => void;
  setSiseInput: (rows: SiseInputRow[]) => void;
  setSisePaste: (v: string) => void;
  setSiseConfirmed: (v: boolean) => void;
  resetSise: () => void;
  setTx: (rows: TxRecord[], meta: TxMeta) => void;
  setTxForm: (f: Partial<AppState['txForm']>) => void;
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
  setProjectName: (v) => set({ projectName: v }),
  setConfig: (config) => set({ config }),
  setSise: (sise, siseMeta) => set({ sise, siseMeta }),
  setSiseInput: (siseInput) => set({ siseInput }),
  setSisePaste: (sisePaste) => set({ sisePaste }),
  setSiseConfirmed: (siseConfirmed) => set({ siseConfirmed }),
  resetSise: () => set({ siseInput: [], sisePaste: '', siseConfirmed: false, sise: [], siseMeta: { parsedCount: 0, errorCount: 0 } }),
  setTx: (tx, txMeta) => set({ tx, txMeta }),
  setTxForm: (f) => set((st) => ({ txForm: { ...st.txForm, ...f } })),
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
      }),
    },
  ),
);
