/** 저장·불러오기 — 로컬 파일(엑셀 하이브리드: 표 시트 + 숨김 _appdata 스냅샷) */
import type { SnapshotState } from '@/lib/store';
import { buildPriceCatalog, resolveAreaBandOptions } from '@/lib/priceCalc';
import { bandByFacility } from '@/lib/areaBands';
import { bandByRecencyFacility } from '@/lib/monthlyRent';
import { PYEONG } from '@/lib/calc/constants';

const APPDATA_SHEET = '_appdata';
const CHUNK = 30000; // 엑셀 셀 문자열 한도(32767) 이내로 JSON 분할 저장

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

/** 저장 파일 베이스명: {오늘날짜}_{실거래 지역명}_주변가격분석 */
export function buildFileBaseName(snap: SnapshotState): string {
  const region = snap.txMeta?.region || '무제';
  return `${stamp()}_${region}_주변가격분석`;
}

async function loadExcelJS() {
  const mod: any = await import('exceljs/dist/exceljs.min.js');
  return mod.default ?? mod;
}

/** 스냅샷 → 하이브리드 워크북(표 시트 + 숨김 _appdata) */
export async function buildSnapshotWorkbook(snap: SnapshotState): Promise<any> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();

  const wsInfo = wb.addWorksheet('개요');
  wsInfo.addRow([`${snap.projectName} — 저장 데이터`]);
  wsInfo.addRow([`저장일시: ${new Date().toLocaleString('ko-KR')}`]);
  wsInfo.addRow([`실거래 조회: ${snap.txMeta ? `${snap.txMeta.region} · ${snap.txMeta.facility}·${snap.txMeta.trade} · ${snap.txMeta.from}~${snap.txMeta.to}` : '조회 안함'}`]);
  wsInfo.addRow([`분석변수: 자본환원율 ${snap.config.capRate} / 보증금운영수익률 ${snap.config.depositYield} (${snap.config.depositYieldMemo})`]);
  wsInfo.columns = [{ width: 90 }];

  const wsSise = wb.addWorksheet('시세입력');
  wsSise.addRow(['시설', '사용승인일', '물건명', '금액', '면적/층/향']).font = { bold: true };
  snap.siseInput.forEach((r) => wsSise.addRow([r.facility, r.approvalDate ?? '', r.name ?? '', r.amountText, r.areaText]));
  wsSise.columns.forEach((c: any) => (c.width = 20));

  const wsTx = wb.addWorksheet('실거래');
  wsTx.addRow(['시설', '거래유형', '단지/건물명', '거래일', '건축년도', '층', '면적(㎡)', '거래금액(만원)', '보증금(만원)', '월세(만원)', '평당가(천원/평)']).font = { bold: true };
  snap.tx.forEach((t) => wsTx.addRow([t.facility, t.dealType, t.name, t.dealDate ?? '', t.buildYear ?? '', t.floor ?? '', t.areaM2 ?? '', t.amountManwon ?? '', t.depositManwon ?? '', t.monthlyRentManwon ?? '', t.ppa ?? '']));
  wsTx.columns.forEach((c: any) => (c.width = 16));

  const wsRegion = wb.addWorksheet('지역분석');
  let r = 1;
  if (snap.rebResult) {
    const rb = snap.rebResult;
    wsRegion.addRow([`부동산원 — ${rb.statLabel} (${rb.unit}) · ${rb.start}~${rb.end}`]); r++;
    wsRegion.addRow(['시점', `${rb.sidoName}(시도)`, `${rb.guName}(구)`]).font = { bold: true }; r++;
    const n = Math.max(rb.sidoSeries.length, rb.guSeries.length);
    for (let i = 0; i < n; i++) {
      wsRegion.addRow([rb.sidoSeries[i]?.time ?? rb.guSeries[i]?.time ?? '', rb.sidoSeries[i]?.value ?? '', rb.guSeries[i]?.value ?? '']);
      r++;
    }
    wsRegion.addRow([]); r++;
  }
  if (snap.kosisResult) {
    const k = snap.kosisResult;
    wsRegion.addRow([`KOSIS 인구 — ${k.data.region} · ${k.data.period} · 총인구 ${k.data.total.toLocaleString()}명`]); r++;
    wsRegion.addRow(['연령대', '인구수']).font = { bold: true }; r++;
    k.data.ages.forEach((a) => { wsRegion.addRow([a.label, a.value]); r++; });
  }
  if (!snap.rebResult && !snap.kosisResult) wsRegion.addRow(['조회된 지역분석 데이터 없음']);
  wsRegion.columns.forEach((c: any) => (c.width = 18));

  const wsPrice = wb.addWorksheet('가격산정');
  wsPrice.addRow(['시설', '타입', '평형', '세대수', '전용면적(㎡)', '전용면적(평)', '적용 단가', '평당매매가격(천원/평)', '적용비율(%)', '세대당 매각가(천원)', '총매출(천원)']).font = { bold: true };
  const thisYear = new Date().getFullYear();
  const catalog = buildPriceCatalog(snap.sise, snap.tx, snap.config, thisYear);
  const saleTx = snap.tx.filter((t) => t.dealType === '매매');
  const bandFac = bandByFacility(saleTx);
  const bandRecFac = bandByRecencyFacility(saleTx, thisYear);
  snap.priceCalc.forEach((r) => {
    const areaOpts = resolveAreaBandOptions(r.facility, r.exclM2, bandFac, bandRecFac);
    const opt = [...(catalog.get(r.facility) ?? []), ...areaOpts].find((o) => o.key === r.priceKey && !o.disabled);
    const pyeong = r.exclM2 != null ? r.exclM2 * PYEONG : null;
    const applied = opt ? opt.value * (r.applyRatio / 100) : null;
    const unitPrice = pyeong != null && applied != null ? pyeong * applied : null;
    const total = unitPrice != null && r.units != null ? unitPrice * r.units : null;
    wsPrice.addRow([
      r.facility, r.type, r.pyeong, r.units ?? '', r.exclM2 ?? '',
      pyeong != null ? Math.round(pyeong * 100) / 100 : '',
      opt?.label ?? '', opt ? Math.round(opt.value) : '', r.applyRatio,
      unitPrice != null ? Math.round(unitPrice) : '', total != null ? Math.round(total) : '',
    ]);
  });
  wsPrice.columns.forEach((c: any) => (c.width = 16));

  const wsData = wb.addWorksheet(APPDATA_SHEET);
  wsData.state = 'hidden';
  const json = JSON.stringify(snap);
  for (let i = 0; i < json.length; i += CHUNK) wsData.addRow([json.slice(i, i + CHUNK)]);

  return wb;
}

export async function workbookToBuffer(wb: any): Promise<ArrayBuffer> {
  return wb.xlsx.writeBuffer();
}

/** 워크북 버퍼 → 스냅샷 복원 (_appdata 시트 JSON 조각 결합) */
export async function parseSnapshotFromBuffer(buf: ArrayBuffer): Promise<SnapshotState> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(APPDATA_SHEET);
  if (!ws) throw new Error('이 파일은 본 앱에서 저장한 데이터 파일이 아닙니다 (_appdata 시트 없음)');
  let json = '';
  ws.eachRow((row: any) => { json += String(row.getCell(1).value ?? ''); });
  return JSON.parse(json) as SnapshotState;
}

/** 섹션 DOM 요소들을 A4 다중 페이지 PDF Blob으로 변환 (섹션마다 새 페이지 시작) */
export async function sectionsToPdfBlob(sectionEls: HTMLElement[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let firstPage = true;

  for (const el of sectionEls) {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;

    if (!firstPage) pdf.addPage();
    firstPage = false;
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
  }
  return pdf.output('blob');
}

const canPickFolder = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일들을 저장 — Chrome/Edge는 폴더 선택 후 동시 기록, 그 외는 다운로드 폴더로 개별 저장 */
export async function saveFilesToFolder(files: { name: string; blob: Blob }[]): Promise<'folder' | 'download'> {
  if (canPickFolder()) {
    const dir = await window.showDirectoryPicker!({ mode: 'readwrite' });
    for (const f of files) {
      const handle = await dir.getFileHandle(f.name, { create: true });
      const w = await handle.createWritable();
      await w.write(f.blob);
      await w.close();
    }
    return 'folder';
  }
  files.forEach((f) => downloadBlob(f.blob, f.name));
  return 'download';
}

/** 파일 선택 탐색창(.xlsx)을 열어 선택된 파일을 ArrayBuffer로 반환 (모든 브라우저 공통 — input[type=file]) */
export function pickXlsxFile(): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    let settled = false;
    const finish = async (file: File | undefined) => {
      if (settled) return;
      settled = true;
      resolve(file ? await file.arrayBuffer() : null);
    };
    input.onchange = () => finish(input.files?.[0]);
    // 탐색창을 취소했을 때는 change가 발생하지 않으므로 cancel로 대기가 멈추지 않게 함
    input.addEventListener('cancel', () => finish(undefined));
    input.click();
  });
}
