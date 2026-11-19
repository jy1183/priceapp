'use client';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useStore, type SnapshotState } from '@/lib/store';
import ReportDocument from '@/components/ReportDocument';
import { buildFileBaseName, buildSnapshotWorkbook, workbookToBuffer, parseSnapshotFromBuffer, sectionsToPdfBlob, pickSnapshotFile, canPickFolder } from '@/lib/localStore';
import {
  sanitizePackageName, fetchViewerAssets, writePackageToFolder, downloadPackageFallback, ensureReadWrite,
  readPackageSnapshot, findPackageNames, parseSnapshotJs,
} from '@/lib/packageWriter';
import { listRecentPackages, rememberPackage, forgetPackage, type RecentPackage } from '@/lib/recentPackages';

const REPORT_SECTION_IDS = ['report-section-input', 'report-section-price', 'report-section-region'];

/** 현재 연결된 패키지 — 폴더 핸들이 있으면 저장 시 같은 패키지를 그대로 덮어쓴다 */
interface BoundPackage { name: string; dir: FileSystemDirectoryHandle }

/** 상단 프로젝트 바 — 저장(HTML 패키지: 폴더에 HTML·snapshot·엑셀·PDF 기록)·불러오기·최근 패키지, 전부 로컬 */
export default function ProjectBar() {
  const store = useStore();
  const { projectName, setProjectName, loadSnapshot } = store;
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pkg, setPkg] = useState<BoundPackage | null>(null);
  const [naming, setNaming] = useState(false);          // 새 패키지 이름 입력 중
  const [pkgName, setPkgName] = useState('');
  const [recent, setRecent] = useState<RecentPackage[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [folderChoice, setFolderChoice] = useState<{ dir: FileSystemDirectoryHandle; names: string[] } | null>(null);
  const folderMode = canPickFolder();

  useEffect(() => { listRecentPackages().then(setRecent); }, []);
  const refreshRecent = () => listRecentPackages().then(setRecent);

  function currentSnapshot(): SnapshotState {
    const s = useStore.getState();
    return {
      projectName: s.projectName, config: s.config,
      sise: s.sise, siseMeta: s.siseMeta,
      siseInput: s.siseInput, sisePaste: s.sisePaste, siseConfirmed: s.siseConfirmed,
      tx: s.tx, txMeta: s.txMeta, txForm: s.txForm,
      rebResult: s.rebResult, kosisResult: s.kosisResult,
      priceCalc: s.priceCalc, priceCalcKey: s.priceCalcKey, priceCalcRatio: s.priceCalcRatio,
      filteredSets: s.filteredSets,
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

  /** 패키지 저장 — existingDir가 있으면 그 폴더에 덮어쓰기, 없으면 폴더 선택(미지원 브라우저는 다운로드) */
  async function runSave(name: string, existingDir?: FileSystemDirectoryHandle) {
    setBusy(true); setMsg('');
    try {
      // 폴더 선택·권한 요청은 클릭 직후(사용자 제스처 유효 시간 안)에 먼저 수행한다
      let dir: FileSystemDirectoryHandle | null = null;
      if (existingDir) {
        if (!(await ensureReadWrite(existingDir))) throw new Error('저장 폴더의 쓰기 권한이 허용되지 않았습니다.');
        dir = existingDir;
      } else if (folderMode) {
        dir = await window.showDirectoryPicker!({ mode: 'readwrite' });
      }
      const snap = currentSnapshot();
      const meta = { name, savedAt: new Date().toISOString(), appOrigin: window.location.origin };
      const assets = await fetchViewerAssets();
      const wb = await buildSnapshotWorkbook(snap);
      const xlsx = new Blob([await workbookToBuffer(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const pdf = await renderReportAndCapture(snap);
      const input = { name, snap, xlsx, pdf, meta, assets };
      if (dir) {
        await writePackageToFolder(dir, input);
        await rememberPackage({ name, projectName: snap.projectName, savedAt: meta.savedAt, dir });
        setPkg({ name, dir });
        refreshRecent();
        setMsg(`저장됨: ${dir.name}/${name}.html (+ ${name}_data)`);
      } else {
        downloadPackageFallback(input);
        setMsg(`다운로드됨: ${name}.html / .xlsx / .pdf`);
      }
      setNaming(false);
    } catch (e: any) {
      if (e?.name === 'NotFoundError') {
        setPkg(null);
        setMsg('저장 폴더를 찾을 수 없습니다. [다른 이름으로 저장]으로 새 위치를 선택하세요.');
      } else if (e?.name !== 'AbortError') setMsg('저장 실패: ' + String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  function startNaming() {
    setPkgName(buildFileBaseName(currentSnapshot()));
    setNaming(true); setShowRecent(false); setFolderChoice(null); setMsg('');
  }

  function save() {
    if (pkg) runSave(pkg.name, pkg.dir); // 연결된 패키지가 있으면 폴더 재선택 없이 덮어쓰기
    else startNaming();
  }

  function confirmNaming() {
    const name = sanitizePackageName(pkgName);
    if (!name) { setMsg('패키지 이름을 입력하세요.'); return; }
    runSave(name);
  }

  async function load() {
    setBusy(true); setMsg('');
    try {
      const file = await pickSnapshotFile();
      if (!file) { setBusy(false); return; }
      const snap = /\.js$/i.test(file.name) ? parseSnapshotJs(await file.text()) : await parseSnapshotFromBuffer(await file.arrayBuffer());
      loadSnapshot(snap);
      setPkg(null); // 파일 선택은 폴더 핸들을 얻을 수 없으므로, 저장하면 새 패키지로 기록된다
      setMsg(`불러옴: ${snap.projectName}`);
    } catch (e: any) {
      setMsg('불러오기 실패: ' + String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  /** 패키지를 복원하고 연결 — 권한 요청은 클릭 제스처 안에서 첫 await로 수행 */
  async function openPackage(dir: FileSystemDirectoryHandle, name: string, recentKey?: string) {
    setBusy(true); setMsg('');
    try {
      if (!(await ensureReadWrite(dir))) throw new Error('폴더 접근 권한이 허용되지 않았습니다.');
      const snap = await readPackageSnapshot(dir, name);
      loadSnapshot(snap);
      setPkg({ name, dir });
      await rememberPackage({ name, projectName: snap.projectName, savedAt: new Date().toISOString(), dir });
      refreshRecent();
      setShowRecent(false); setFolderChoice(null);
      setMsg(`불러옴: ${snap.projectName} — [저장]하면 이 패키지를 덮어씁니다.`);
    } catch (e: any) {
      if (recentKey && (e?.name === 'NotFoundError' || e?.name === 'NotAllowedError')) {
        await forgetPackage(recentKey);
        refreshRecent();
        setMsg('패키지를 찾을 수 없어 목록에서 제거했습니다. [불러오기]로 데이터 폴더의 snapshot.js 또는 엑셀을 선택하세요.');
      } else if (e?.name !== 'AbortError') setMsg('불러오기 실패: ' + String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  /** 다른 PC·브라우저에서 받은 패키지 — 상위 폴더를 선택해 핸들을 등록 */
  async function openFolder() {
    setBusy(true); setMsg('');
    try {
      const dir = await window.showDirectoryPicker!({ mode: 'readwrite' });
      const names = await findPackageNames(dir);
      if (names.length === 0) setMsg('선택한 폴더에서 패키지(…_data/snapshot.js)를 찾지 못했습니다.');
      else if (names.length === 1) { setBusy(false); await openPackage(dir, names[0]); return; }
      else { setFolderChoice({ dir, names }); setShowRecent(true); }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsg('폴더 열기 실패: ' + String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR');

  return (
    <div className="no-print relative border-b bg-white px-6 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
          className="w-48 rounded border px-2 py-1" placeholder="프로젝트명" />
        <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50">저장</button>
        {pkg && <button onClick={startNaming} disabled={busy} className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-50">다른 이름으로 저장</button>}
        <button onClick={load} disabled={busy} className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-50">불러오기</button>
        {folderMode && (
          <button onClick={() => { setShowRecent((v) => !v); setNaming(false); }} disabled={busy} className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-50">
            최근 패키지{recent.length > 0 ? ` (${recent.length})` : ''}
          </button>
        )}
        {pkg && <span className="text-xs text-gray-500">연결됨: {pkg.name}</span>}
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {naming && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border bg-gray-50 px-3 py-2">
          <label className="text-xs text-gray-600">패키지 이름</label>
          <input value={pkgName} onChange={(e) => setPkgName(e.target.value)} className="w-96 rounded border px-2 py-1" />
          <button onClick={confirmNaming} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50">
            {folderMode ? '폴더 선택 후 저장' : '다운로드로 저장'}
          </button>
          <button onClick={() => setNaming(false)} disabled={busy} className="rounded border px-3 py-1 hover:bg-gray-100 disabled:opacity-50">취소</button>
          <span className="text-xs text-gray-500">{folderMode ? '선택한 폴더에 {이름}.html과 {이름}_data 폴더가 만들어집니다.' : '이 브라우저는 폴더 저장을 지원하지 않아 단일 HTML로 내려받습니다.'}</span>
        </div>
      )}

      {showRecent && folderMode && (
        <div className="mt-2 rounded border bg-gray-50 px-3 py-2">
          {folderChoice ? (
            <>
              <div className="mb-1 text-xs text-gray-600">이 폴더에 패키지가 여러 개 있습니다. 열 패키지를 선택하세요.</div>
              <ul className="space-y-1">
                {folderChoice.names.map((n) => (
                  <li key={n}><button onClick={() => openPackage(folderChoice.dir, n)} disabled={busy} className="text-blue-700 hover:underline disabled:opacity-50">{n}</button></li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {recent.length === 0 && <div className="text-xs text-gray-500">이 브라우저에서 저장하거나 연 패키지가 아직 없습니다.</div>}
              <ul className="space-y-1">
                {recent.map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <button onClick={() => openPackage(r.dir, r.name, r.key)} disabled={busy} className="text-left text-blue-700 hover:underline disabled:opacity-50">{r.name}</button>
                    <span className="text-xs text-gray-500">{r.projectName} · {fmt(r.savedAt)} · {r.dir.name}</span>
                  </li>
                ))}
              </ul>
              <button onClick={openFolder} disabled={busy} className="mt-2 rounded border px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50">패키지 폴더 열기…</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
