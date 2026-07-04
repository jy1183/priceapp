'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { buildSummaryRows } from '@/lib/summary';
import { exportExcel, exportWord, exportPptx, type ExportPayload } from '@/lib/export';

/** 종합 검토 내보내기 (Excel·PDF인쇄·Word·PPT) */
export default function ExportBar() {
  const { projectName, config, sise, tx, txMeta } = useStore();
  const [busy, setBusy] = useState('');

  function payload(): ExportPayload {
    return {
      projectName, config,
      filterNote: txMeta ? `${txMeta.region} · ${txMeta.facility}·${txMeta.trade} · ${txMeta.from}~${txMeta.to}` : '전체',
      rows: buildSummaryRows(sise, tx, config),
    };
  }
  async function run(kind: string, fn: (p: ExportPayload) => Promise<void>) {
    setBusy(kind);
    try { await fn(payload()); } catch (e) { alert('내보내기 실패: ' + String(e)); }
    finally { setBusy(''); }
  }

  const disabled = sise.length === 0 && tx.length === 0;
  const btn = 'rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40';

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">내보내기:</span>
      <button className={btn} disabled={disabled || !!busy} onClick={() => run('xlsx', exportExcel)}>{busy === 'xlsx' ? '…' : '엑셀'}</button>
      <button className={btn} disabled={disabled || !!busy} onClick={() => run('docx', exportWord)}>{busy === 'docx' ? '…' : 'Word'}</button>
      <button className={btn} disabled={disabled || !!busy} onClick={() => run('pptx', exportPptx)}>{busy === 'pptx' ? '…' : 'PPT'}</button>
      <button className={btn} disabled={disabled} onClick={() => window.print()}>PDF(인쇄)</button>
    </div>
  );
}
