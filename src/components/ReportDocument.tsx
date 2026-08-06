'use client';
// 저장용 통합 PDF 보고서 — 입력/가격분석/기타분석 3개 섹션(각 새 페이지)을 화면 밖에서 렌더해 캡처
import type { SnapshotState } from '@/lib/store';
import { buildSummaryRows, buildJeonseSummaryRows } from '@/lib/summary';

const fmt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '-' : Math.round(v).toLocaleString());
const fmtPct = (v: number) => (Number.isFinite(v) ? v.toFixed(1) + '%' : '-');

const wrapStyle: React.CSSProperties = { width: 780, background: '#fff', color: '#111', padding: 28, fontSize: 12, fontFamily: 'sans-serif' };
const th: React.CSSProperties = { border: '1px solid #ccc', padding: '4px 6px', background: '#f3f4f6', textAlign: 'left', fontWeight: 700 };
const td: React.CSSProperties = { border: '1px solid #ddd', padding: '4px 6px' };

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8, marginBottom: 16 }}>
      <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td style={td} colSpan={head.length}>데이터 없음</td></tr>}
        {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} style={td}>{v}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

/** 섹션① 입력 — 시세 입력 원본 + 실거래 조회 요약 */
function InputSection({ snap }: { snap: SnapshotState }) {
  return (
    <div id="report-section-input" style={wrapStyle}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{snap.projectName} — 입력 데이터</h1>
      <p style={{ color: '#555', marginTop: 4 }}>저장일시 {new Date().toLocaleString('ko-KR')}</p>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20 }}>시세 입력 ({snap.siseInput.length}건)</h2>
      <Table head={['시설', '사용승인일', '물건명', '금액', '면적/층/향']}
        rows={snap.siseInput.map((r) => [r.facility, r.approvalDate ?? '-', r.name ?? '-', r.amountText, r.areaText])} />

      <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20 }}>실거래가 조회</h2>
      <p style={{ marginTop: 4 }}>
        {snap.txMeta ? `${snap.txMeta.region} · ${snap.txMeta.facility}·${snap.txMeta.trade} · ${snap.txMeta.from}~${snap.txMeta.to}` : '조회된 조건 없음'}
        {' · 총 '}{snap.tx.length}건 (상세 목록은 첨부 엑셀 "실거래" 시트 참고)
      </p>
    </div>
  );
}

/** 섹션② 가격 분석 — 매매/전세 시세vs실거래 종합 */
function PriceSection({ snap }: { snap: SnapshotState }) {
  const saleRows = buildSummaryRows(snap.sise, snap.tx, snap.config);
  const jeonseRows = buildJeonseSummaryRows(snap.siseInput, snap.tx, snap.config);
  const head = ['시설', '시세건수', '시세평균', '시세상위10%', '시세상위30%', '실거래건수', '실거래평균', '실거래상위10%', '실거래상위30%', '괴리(%)'];
  const toRow = (x: (typeof saleRows)[number]) => [x.facility, x.sise.count, fmt(x.sise.avg), fmt(x.sise.top10), fmt(x.sise.top30), x.tx.count, fmt(x.tx.avg), fmt(x.tx.top10), fmt(x.tx.top30), Number.isFinite(x.gap) ? fmtPct(x.gap) : '-'];

  return (
    <div id="report-section-price" style={wrapStyle}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>가격 분석</h1>
      <p style={{ color: '#555', marginTop: 4 }}>변수: 자본환원율 {snap.config.capRate} · 보증금운영수익률 {snap.config.depositYield}</p>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20 }}>매매 — 시세 vs 실거래</h2>
      <Table head={head} rows={saleRows.map(toRow)} />

      <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20 }}>전세 — 시세 vs 실거래</h2>
      <Table head={head} rows={jeonseRows.map(toRow)} />
    </div>
  );
}

/** 섹션③ 기타 분석 — 지역(REB) 가격지수·KOSIS 인구 */
function RegionSection({ snap }: { snap: SnapshotState }) {
  const rb = snap.rebResult;
  const k = snap.kosisResult;
  return (
    <div id="report-section-region" style={wrapStyle}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>기타 분석 — 지역 분석</h1>

      {rb ? (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20 }}>{rb.statLabel} ({rb.unit}) · {rb.start}~{rb.end}</h2>
          <Table head={['시점', `${rb.sidoName}(시도)`, `${rb.guName}(구)`]}
            rows={Array.from({ length: Math.max(rb.sidoSeries.length, rb.guSeries.length) }, (_, i) => [
              rb.sidoSeries[i]?.time ?? rb.guSeries[i]?.time ?? '-',
              fmt(rb.sidoSeries[i]?.value), fmt(rb.guSeries[i]?.value),
            ]).slice(-12)} />
        </>
      ) : <p style={{ marginTop: 12, color: '#555' }}>조회된 부동산원 지역분석 데이터 없음</p>}

      {k ? (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 20 }}>KOSIS 인구 — {k.data.region} · {k.data.period} · 총인구 {k.data.total.toLocaleString()}명</h2>
          <Table head={['연령대', '인구수']} rows={k.data.ages.map((a) => [a.label, a.value.toLocaleString()])} />
        </>
      ) : <p style={{ marginTop: 12, color: '#555' }}>조회된 KOSIS 인구 데이터 없음</p>}
    </div>
  );
}

/** 저장 시점에만 오프스크린 렌더 → html2canvas로 캡처 후 즉시 언마운트 (localStore.saveLocal에서 호출) */
export default function ReportDocument({ snap }: { snap: SnapshotState }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: -99999, zIndex: -1 }}>
      <InputSection snap={snap} />
      <PriceSection snap={snap} />
      <RegionSection snap={snap} />
    </div>
  );
}
