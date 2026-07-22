/** 종합 집계 (시세 vs 실거래) — /summary·내보내기 공용 */
import { aggregate, type AggregateResult } from '@/lib/calc/aggregate';
import type { AnalysisConfig } from '@/lib/calc/constants';
import type { SiseResult } from '@/lib/store';
import type { TxRecord } from '@/lib/normalize';
import { parseSiseRaw, jeonseDepositPpa, type SiseRawInput } from '@/lib/calc/sise';

export interface SummaryRow {
  facility: string;
  sise: AggregateResult;
  tx: AggregateResult;
  gap: number; // 시세평균/실거래평균 - 1 (%)
}

export function buildSummaryRows(sise: SiseResult[], tx: TxRecord[], config: AnalysisConfig): SummaryRow[] {
  const facs = new Set<string>([...sise.map((s) => s.facility), ...tx.map((t) => t.facility)]);
  const pct = config.topPercentiles;
  return [...facs].map((f) => {
    const siseVals = sise.filter((s) => s.facility === f && s.deal === '매매' && s.ppaExcl != null).map((s) => s.ppaExcl!) as number[];
    const txVals = tx.filter((t) => t.facility === f && t.trade === '매매' && t.ppa != null).map((t) => t.ppa!) as number[];
    const sa = aggregate(siseVals, pct);
    const ta = aggregate(txVals, pct);
    const gap = Number.isFinite(sa.avg) && Number.isFinite(ta.avg) && ta.avg ? (sa.avg / ta.avg - 1) * 100 : NaN;
    return { facility: f, sise: sa, tx: ta, gap };
  }).filter((r) => r.sise.count > 0 || r.tx.count > 0);
}

/** 전세 종합 집계 — 시세(보증금 전용 평당가) vs 실거래(전세 평당가) 시설별 비교 */
export function buildJeonseSummaryRows(siseInput: SiseRawInput[], tx: TxRecord[], config: AnalysisConfig): SummaryRow[] {
  const pct = config.topPercentiles;
  const siseByFac = new Map<string, number[]>();
  siseInput.forEach((r) => {
    const p = parseSiseRaw(r, config);
    if (p.errors.length !== 0 || p.row.deal !== '전세') return;
    const v = jeonseDepositPpa(p.ppa).excl;
    if (v != null && Number.isFinite(v) && v > 0) {
      if (!siseByFac.has(p.row.facility)) siseByFac.set(p.row.facility, []);
      siseByFac.get(p.row.facility)!.push(v);
    }
  });
  const txByFac = new Map<string, number[]>();
  tx.forEach((t) => {
    if (t.dealType !== '전세' || t.ppa == null) return;
    if (!txByFac.has(t.facility)) txByFac.set(t.facility, []);
    txByFac.get(t.facility)!.push(t.ppa);
  });
  const facs = new Set<string>([...siseByFac.keys(), ...txByFac.keys()]);
  return [...facs].map((f) => {
    const sa = aggregate(siseByFac.get(f) ?? [], pct);
    const ta = aggregate(txByFac.get(f) ?? [], pct);
    const gap = Number.isFinite(sa.avg) && Number.isFinite(ta.avg) && ta.avg ? (sa.avg / ta.avg - 1) * 100 : NaN;
    return { facility: f, sise: sa, tx: ta, gap };
  }).filter((r) => r.sise.count > 0 || r.tx.count > 0);
}
