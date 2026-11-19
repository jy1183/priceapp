// HTML 패키지 생성·기록 — snapshot.js·로더 HTML 생성/파싱, 뷰어 번들 읽기, 폴더(또는 다운로드) 기록
import type { SnapshotState } from '@/lib/store';
import type { PackageMeta } from '@/lib/viewerMode';

const SNAPSHOT_PREFIX = 'window.__PRICEAPP_SNAPSHOT__ = ';

/** 패키지 이름에 쓸 수 없는 문자를 제거 — 파일명·폴더명 공용 */
export function sanitizePackageName(raw: string): string {
  return raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim();
}

export const dataFolderName = (name: string) => `${name}_data`;

/** 스냅샷 → snapshot.js (file://에서 fetch가 막히므로 클래식 스크립트로 전역에 대입) */
export function buildSnapshotJs(snap: SnapshotState): string {
  return `${SNAPSHOT_PREFIX}${JSON.stringify(snap)};\n`;
}

/** snapshot.js 텍스트 → 스냅샷 복원 (불러오기·최근 패키지 복원용) */
export function parseSnapshotJs(text: string): SnapshotState {
  const i = text.indexOf(SNAPSHOT_PREFIX);
  if (i < 0) throw new Error('이 파일은 본 앱에서 저장한 snapshot.js가 아닙니다');
  const json = text.slice(i + SNAPSHOT_PREFIX.length).trim().replace(/;$/, '');
  return JSON.parse(json) as SnapshotState;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 인라인 <script> 안에 안전하게 넣을 JSON — '<'를 이스케이프해 </script> 조기 종료 방지 */
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** 데이터 폴더가 없을 때 사용자에게 알리는 안내 — 뷰어가 실행되지 못했을 때만 노출 */
const GUARD_SCRIPT = `if(!window.__PRICEAPP_VIEWER_READY__){var g=document.getElementById('priceapp-guard');if(g)g.style.display='block';}`;
const GUARD_DIV = '<div id="priceapp-guard" style="display:none;margin:40px auto;max-width:560px;font-family:sans-serif;line-height:1.6;color:#b91c1c">'
  + '<b>데이터 폴더를 찾을 수 없습니다.</b><br>이 HTML 파일과 같은 이름의 <code>_data</code> 폴더를 같은 위치에 두세요. 폴더를 옮길 때는 HTML 파일과 함께 옮겨야 합니다.</div>';

export interface PackageHtmlInput {
  meta: PackageMeta;
  projectName: string;
  /** 외부 파일 방식이면 데이터 폴더명, 단일 HTML이면 인라인할 번들 */
  mode: { kind: 'folder'; dataDir: string } | { kind: 'single'; snapshotJs: string; viewerJs: string; viewerCss: string };
}

/** `</script`·`<!--`이 인라인 스크립트를 깨지 않도록 이스케이프 (문자열·정규식 리터럴 안에서만 나타나므로 의미 불변) */
const escapeInlineScript = (js: string) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

/** 더블클릭 대상 HTML — 폴더 방식은 상대경로 클래식 스크립트만 사용(폴더째 옮겨도 동작) */
export function buildPackageHtml({ meta, projectName, mode }: PackageHtmlInput): string {
  const head = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(projectName)} — 주변 가격 분석</title>
`;
  const metaScript = `<script>window.__PRICEAPP_META__=${jsonForScript(meta)};</script>`;
  if (mode.kind === 'folder') {
    const d = encodeURIComponent(mode.dataDir);
    return `${head}<link rel="stylesheet" href="${d}/viewer.css">
</head>
<body>
<div id="root"></div>
${GUARD_DIV}
${metaScript}
<script src="${d}/snapshot.js"></script>
<script src="${d}/viewer.js"></script>
<script>${GUARD_SCRIPT}</script>
</body>
</html>
`;
  }
  return `${head}<style>${mode.viewerCss}</style>
</head>
<body>
<div id="root"></div>
${metaScript}
<script>${escapeInlineScript(mode.snapshotJs)}</script>
<script>${escapeInlineScript(mode.viewerJs)}</script>
</body>
</html>
`;
}

/** 빌드 때 만들어 둔 뷰어 번들을 자기 출처에서 읽는다 (public/viewer — npm run build:viewer 산출물) */
export async function fetchViewerAssets(): Promise<{ js: string; css: string }> {
  const get = async (name: string) => {
    const res = await fetch(`/viewer/${name}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`뷰어 번들(${name})을 읽지 못했습니다 (${res.status}). 'npm run build:viewer'를 실행했는지 확인하세요.`);
    return res.text();
  };
  const [js, css] = await Promise.all([get('viewer.js'), get('viewer.css')]);
  return { js, css };
}

export interface PackageInput {
  name: string;               // 정리된 패키지 이름(HTML·폴더·엑셀·PDF 공통 베이스)
  snap: SnapshotState;
  xlsx: Blob;
  pdf: Blob;
  meta: PackageMeta;
  assets: { js: string; css: string };
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const handle = await dir.getFileHandle(name, { create: true });
  const w = await handle.createWritable();
  await w.write(data);
  await w.close();
}

/** 폴더에 패키지 기록 — `_data` 안의 파일을 먼저 쓰고 HTML을 마지막에 써서, HTML이 있으면 데이터도 항상 완결 상태가 되게 한다 */
export async function writePackageToFolder(dir: FileSystemDirectoryHandle, p: PackageInput): Promise<void> {
  const dataDir = dataFolderName(p.name);
  const data = await dir.getDirectoryHandle(dataDir, { create: true });
  await writeFile(data, 'snapshot.js', buildSnapshotJs(p.snap));
  await writeFile(data, 'viewer.js', p.assets.js);
  await writeFile(data, 'viewer.css', p.assets.css);
  await writeFile(data, `${p.name}.xlsx`, p.xlsx);
  await writeFile(data, `${p.name}.pdf`, p.pdf);
  await writeFile(dir, `${p.name}.html`, buildPackageHtml({ meta: p.meta, projectName: p.snap.projectName, mode: { kind: 'folder', dataDir } }));
}

/** 폴더 쓰기를 쓸 수 없는 브라우저용 — 자체완결 단일 HTML + 엑셀·PDF를 다운로드로 내려보낸다 */
export function downloadPackageFallback(p: PackageInput): void {
  const html = buildPackageHtml({
    meta: p.meta, projectName: p.snap.projectName,
    mode: { kind: 'single', snapshotJs: buildSnapshotJs(p.snap), viewerJs: p.assets.js, viewerCss: p.assets.css },
  });
  const files: [string, Blob][] = [
    [`${p.name}.html`, new Blob([html], { type: 'text/html;charset=utf-8' })],
    [`${p.name}.xlsx`, p.xlsx],
    [`${p.name}.pdf`, p.pdf],
  ];
  for (const [name, blob] of files) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 폴더 핸들의 읽기·쓰기 권한 확인 — 필요하면 요청(반드시 클릭 같은 사용자 제스처 안에서 호출) */
export async function ensureReadWrite(h: FileSystemHandle): Promise<boolean> {
  if (!h.queryPermission || !h.requestPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** 폴더 핸들의 `{name}_data/snapshot.js`를 읽어 스냅샷 복원 */
export async function readPackageSnapshot(dir: FileSystemDirectoryHandle, name: string): Promise<SnapshotState> {
  const data = await dir.getDirectoryHandle(dataFolderName(name));
  const fh = await data.getFileHandle('snapshot.js');
  return parseSnapshotJs(await (await fh.getFile()).text());
}

/** 폴더 안에서 패키지(`*_data/snapshot.js`)로 보이는 이름 목록 */
export async function findPackageNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of (dir as any).values() as AsyncIterable<FileSystemHandle>) {
    if (entry.kind !== 'directory' || !entry.name.endsWith('_data')) continue;
    try { await (entry as FileSystemDirectoryHandle).getFileHandle('snapshot.js'); names.push(entry.name.slice(0, -'_data'.length)); } catch { /* snapshot.js 없음 → 패키지 아님 */ }
  }
  return names;
}
