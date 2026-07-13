/** 보고서 내보내기 — Excel·Word·PPT (동적 import로 번들 경량화) */
import type { SummaryRow } from '@/lib/summary';
import type { AnalysisConfig } from '@/lib/calc/constants';

export interface ExportPayload {
  projectName: string;
  config: AnalysisConfig;
  filterNote: string;
  rows: SummaryRow[];
}
const r = (v: number) => (Number.isFinite(v) ? Math.round(v) : 0);
const HEAD = ['시설', '시세 건수', '시세 평균(전용)', '시세 상위10%(전용)', '시세 상위30%(전용)', '실거래 건수', '실거래 평균(전용)', '실거래 상위10%(전용)', '실거래 상위30%(전용)', '괴리(%)'];
const toRow = (x: SummaryRow) => [x.facility, x.sise.count, r(x.sise.avg), r(x.sise.top10), r(x.sise.top30), x.tx.count, r(x.tx.avg), r(x.tx.top10), r(x.tx.top30), Number.isFinite(x.gap) ? Number(x.gap.toFixed(1)) : ''];

function dl(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportExcel(p: ExportPayload) {
  const mod: any = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS: any = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('가격검토종합');
  ws.addRow([`${p.projectName} — 가격검토종합`]);
  ws.addRow([`기준: ${p.filterNote}`]);
  ws.addRow([`변수: 자본환원율 ${p.config.capRate}, 보증금운영수익률 ${p.config.depositYield} (${p.config.depositYieldMemo})`]);
  ws.addRow([]);
  ws.addRow(HEAD).font = { bold: true };
  p.rows.forEach((x) => ws.addRow(toRow(x)));
  ws.columns.forEach((c: any) => (c.width = 14));
  const buf = await wb.xlsx.writeBuffer();
  dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `가격검토종합_${stamp()}.xlsx`);
}

export async function exportWord(p: ExportPayload) {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } = docx;
  const cell = (t: string | number, bold = false) => new TableCell({ children: [new Paragraph({ children: [new (docx.TextRun)({ text: String(t), bold })] })] });
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: HEAD.map((h) => cell(h, true)) }),
      ...p.rows.map((x) => new TableRow({ children: toRow(x).map((v) => cell(v)) })),
    ],
  });
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: `${p.projectName} — 가격검토종합`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `기준: ${p.filterNote}` }),
        new Paragraph({ text: `변수: 자본환원율 ${p.config.capRate} · 보증금운영수익률 ${p.config.depositYield}` }),
        new Paragraph({ text: '' }),
        table,
      ],
    }],
  });
  dl(await Packer.toBlob(doc), `가격검토종합_${stamp()}.docx`);
}

export async function exportPptx(p: ExportPayload) {
  const PptxGen = (await import('pptxgenjs')).default;
  const pptx = new PptxGen();
  const slide = pptx.addSlide();
  slide.addText(`${p.projectName} — 가격검토종합`, { x: 0.4, y: 0.3, fontSize: 18, bold: true });
  slide.addText(`기준: ${p.filterNote}`, { x: 0.4, y: 0.8, fontSize: 10, color: '666666' });
  const table = [HEAD.map((h) => ({ text: h, options: { bold: true, fill: 'EEEEEE' } })), ...p.rows.map((x) => toRow(x).map((v) => ({ text: String(v) })))];
  slide.addTable(table as any, { x: 0.4, y: 1.2, w: 9.2, fontSize: 9, border: { type: 'solid', color: 'DDDDDD', pt: 0.5 } });
  await pptx.writeFile({ fileName: `가격검토종합_${stamp()}.pptx` });
}
