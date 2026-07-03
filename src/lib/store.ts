/**
 * 화면 간 공유 상태 (Zustand) — 시세·실거래 결과를 종합/검증 화면에서 참조
 */
import { create } from 'zustand';
import { DEFAULT_CONFIG, type AnalysisConfig } from '@/lib/calc/constants';
import type { TxRecord } from '@/lib/normalize';

/** 시세 확정 1행 (집계용 최소 필드) */
export interface SiseResult {
  facility: string;
  deal: '매매' | '전세' | '월세';
  ppaSupply: number | null;  // 공급/계약 기준 평당가
  ppaExcl: number | null;    // 전용 기준 평당가
}

export interface SiseMeta { parsedCount: number; errorCount: number; }
export interface TxMeta { facility: string; trade: string; region: string; from: string; to: string; }

interface AppState {
  projectName: string;
  config: AnalysisConfig;
  sise: SiseResult[];
  siseMeta: SiseMeta;
  tx: TxRecord[];
  txMeta: TxMeta | null;
  setProjectName: (v: string) => void;
  setConfig: (c: AnalysisConfig) => void;
  setSise: (rows: SiseResult[], meta: SiseMeta) => void;
  setTx: (rows: TxRecord[], meta: TxMeta) => void;
  loadSnapshot: (s: Partial<AppState>) => void;
}

export const useStore = create<AppState>((set) => ({
  projectName: '무제 검토',
  config: DEFAULT_CONFIG,
  sise: [],
  siseMeta: { parsedCount: 0, errorCount: 0 },
  tx: [],
  txMeta: null,
  setProjectName: (v) => set({ projectName: v }),
  setConfig: (config) => set({ config }),
  setSise: (sise, siseMeta) => set({ sise, siseMeta }),
  setTx: (tx, txMeta) => set({ tx, txMeta }),
  loadSnapshot: (s) => set(s),
}));
