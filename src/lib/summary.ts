/** 종합 집계 (시세 vs 실거래) — /summary·내보내기 공용 */
import { aggregate, type AggregateResult } from '@/lib/calc/aggregate';
import type { AnalysisConfig } from '@/lib/calc/constants';
import type { SiseResult } from '@/lib/store';
import type { TxRecord } from '@/lib/normalize';

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
