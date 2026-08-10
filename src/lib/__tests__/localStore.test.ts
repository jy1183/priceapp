// 로컬 저장(엑셀 _appdata) 왕복 무손실 검증
import { describe, it, expect } from 'vitest';
import { buildSnapshotWorkbook, workbookToBuffer, parseSnapshotFromBuffer, buildFileBaseName } from '@/lib/localStore';
import { DEFAULT_CONFIG } from '@/lib/calc/constants';
import type { SnapshotState } from '@/lib/store';

const snap: SnapshotState = {
  projectName: '테스트 검토',
  config: DEFAULT_CONFIG,
  sise: [{ facility: '오피스텔', deal: '매매', ppaSupply: 1000, ppaExcl: 1200, ppaYeon: null }],
  siseMeta: { parsedCount: 1, errorCount: 0 },
  siseInput: [{ id: 1, facility: '오피스텔', approvalDate: '2016.03.', name: '리버리치', amountText: '매매 3억 5,000', areaText: '전용 39.98㎡ 5/15층 남향' }],
  sisePaste: '',
  siseConfirmed: true,
  tx: [{
    facility: '오피스텔', trade: '매매', dealType: '매매', name: '테스트오피스텔',
    buildYear: 2015, areaM2: 39.98, amountManwon: 35000, depositManwon: null, monthlyRentManwon: null,
    dealDate: '2025-03-01', floor: 5, ppa: 1150.5, raw: {},
  }],
  txMeta: { facility: '오피스텔', trade: '매매', region: '영등포동8가', from: '202501', to: '202506' },
  txForm: { sido: '서울특별시', lawdCd: '11560', dong: '영등포동8가', facility: '오피스텔', trade: '매매', from: '202501', to: '202506', period: 'all' },
  rebResult: null,
  kosisResult: null,
  priceCalc: [],
  priceCalcKey: null,
  priceCalcRatio: 100,
};

describe('localStore 저장/불러오기 왕복', () => {
  it('워크북으로 저장 후 다시 읽으면 원본 스냅샷과 동일하다', async () => {
    const wb = await buildSnapshotWorkbook(snap);
    const buf = await workbookToBuffer(wb);
    const restored = await parseSnapshotFromBuffer(buf as ArrayBuffer);
    expect(restored).toEqual(snap);
  });

  it('파일명은 오늘날짜_지역명_주변가격분석 형식이다', () => {
    const base = buildFileBaseName(snap);
    expect(base).toMatch(/^\d{8}_영등포동8가_주변가격분석$/);
  });

  it('실거래 조회 지역이 없으면 무제로 대체된다', () => {
    const base = buildFileBaseName({ ...snap, txMeta: null });
    expect(base).toMatch(/^\d{8}_무제_주변가격분석$/);
  });

  it('지역분석(REB·KOSIS) 데이터도 왕복 후 동일하다', async () => {
    const snapWithRegion: SnapshotState = {
      ...snap,
      rebResult: {
        statId: 'sale_idx', statLabel: '매매가격지수(주택종합)', unit: '지수', start: '202301', end: '202306',
        sidoName: '서울', guName: '영등포',
        sidoSeries: [{ time: '202301', value: 100.1 }], guSeries: [{ time: '202301', value: 99.8 }], natl: [],
      },
      kosisResult: {
        pick: { sido: '서울특별시', lawdCd: '11560', dong: '영등포동8가' },
        data: { region: '영등포동8가', period: '2025', total: 12345, ages: [{ label: '20대', value: 1000 }] },
        sido: null,
      },
    };
    const wb = await buildSnapshotWorkbook(snapWithRegion);
    const buf = await workbookToBuffer(wb);
    const restored = await parseSnapshotFromBuffer(buf as ArrayBuffer);
    expect(restored).toEqual(snapWithRegion);
  });
});
