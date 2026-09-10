'use client';
// 결과 페이지를 A4 다중 페이지 PDF로 내려받는 경량 버튼 — 시세분석·실거래분석·종합검토 공용
import { useState, type RefObject } from 'react';
import { exportElementToPdf } from '@/lib/pdfExport';

export default function PdfExportButton({ targetRef, fileName }: { targetRef: RefObject<HTMLDivElement | null>; fileName: string }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(targetRef.current, fileName);
    } catch (e) {
      alert('PDF 내보내기 실패: ' + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="no-print rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
      disabled={busy}
      onClick={run}
    >
      {busy ? 'PDF 생성 중…' : 'PDF 다운로드'}
    </button>
  );
}
