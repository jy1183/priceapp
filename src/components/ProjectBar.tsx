'use client';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useStore, type SnapshotState } from '@/lib/store';
import ReportDocument from '@/components/ReportDocument';
import { buildFileBaseName, buildSnapshotWorkbook, workbookToBuffer, parseSnapshotFromBuffer, sectionsToPdfBlob, saveFilesToFolder, pickXlsxFile } from '@/lib/localStore';

const REPORT_SECTION_IDS = ['report-section-input', 'report-section-price', 'report-section-region'];

/** 상단 프로젝트 바 — 저장(폴더 선택→엑셀+PDF 동시 기록)·불러오기(파일 선택→복원), 전부 로컬 */
export default function ProjectBar() {
  const store = useStore();
  const { projectName, setProjectName, loadSnapshot } = store;
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function currentSnapshot(): SnapshotState {
    const s = useStore.getState();
    return {
      projectName: s.projectName, config: s.config,
      sise: s.sise, siseMeta: s.siseMeta,
      siseInput: s.siseInput, sisePaste: s.sisePaste, siseConfirmed: s.siseConfirmed,
      tx: s.tx, txMeta: s.txMeta, txForm: s.txForm,
      rebResult: s.rebResult, kosisResult: s.kosisResult,
    };
  }

  /** 오프스크린에 보고서를 렌더 → 섹션 캡처 → 즉시 언마운트 */
  async function renderReportAndCapture(snap: SnapshotState): Promise<Blob> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<ReportDocument snap={snap} />));
      const els = REPORT_SECTION_IDS
        .map((id) => container.querySelector<HTMLElement>(`#${id}`))
        .filter((el): el is HTMLElement => !!el);
      return await sectionsToPdfBlob(els);
    } finally {
      root.unmount();
      container.remove();
    }
  }

  async function save() {
    setBusy(true); setMsg('');
    try {
      const snap = currentSnapshot();
      const base = buildFileBaseName(snap);
      const wb = await buildSnapshotWorkbook(snap);
      const xlsxBuf = await workbookToBuffer(wb);
      const pdfBlob = await renderReportAndCapture(snap);
      const mode = await saveFilesToFolder([
        { name: `${base}.xlsx`, blob: new Blob([xlsxBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) },
        { name: `${base}.pdf`, blob: pdfBlob },
      ]);
      setMsg(mode === 'folder' ? `저장됨: ${base}.xlsx / .pdf` : `다운로드됨: ${base}.xlsx / .pdf`);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsg('저장 실패: ' + String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  async function load() {
    setBusy(true); setMsg('');
    try {
      const buf = await pickXlsxFile();
      if (!buf) { setBusy(false); return; }
      const snap = await parseSnapshotFromBuffer(buf);
      loadSnapshot(snap);
      setMsg(`불러옴: ${snap.projectName}`);
    } catch (e: any) {
      setMsg('불러오기 실패: ' + String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  return (
    <div className="no-print flex items-center gap-2 border-b bg-white px-6 py-2 text-sm">
      <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
        className="w-48 rounded border px-2 py-1" placeholder="프로젝트명" />
      <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50">저장</button>
      <button onClick={load} disabled={busy} className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-50">불러오기</button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
