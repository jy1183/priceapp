// 필터링 데이터(filteredSets) 스토어 액션과 저장·불러오기 호환 검증
import { describe, it, expect, beforeEach, vi } from 'vitest';

// store.ts는 window.localStorage가 있을 때만 persist를 쓰므로, node 환경에서는 메모리 저장소로 대신한다.
vi.hoisted(() => {
  const mem = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    },
  };
});
import { useStore } from '@/lib/store';
import type { TxRecord } from '@/lib/normalize';
import { buildSnapshotWorkbook, workbookToBuffer, parseSnapshotFromBuffer } from '@/lib/localStore';
import type { SnapshotState } from '@/lib/store';

const mk = (o: Partial<TxRecord> = {}): TxRecord => ({
  facility: '오피스텔', trade: '매매', dealType: '매매', name: 'A', buildYear: 2010, areaM2: 30,
  amountManwon: 10000, depositManwon: null, monthlyRentManwon: null, dealDate: '2025-01-01',
  floor: 1, ppa: 1000, raw: { buyerGbn: '법인', slerGbn: '개인', big: 'x'.repeat(100) }, ...o,
});

const send = (rows: TxRecord[]) =>
  useStore.getState().addFilteredSet({ rows, filterDesc: ['매수자=법인'], meta: null, buildLabel: (n) => `#${n} · test` });

beforeEach(() => { useStore.setState({ filteredSets: [] }); });

describe('filteredSets 스토어', () => {
  it('보낸 순서대로 쌓이고 번호는 삭제돼도 재사용하지 않는다', () => {
    const a = send([mk()]);
    const b = send([mk(), mk()]);
    expect(useStore.getState().filteredSets.map((x) => x.seq)).toEqual([1, 2]);
    useStore.getState().removeFilteredSet(a.id);
    const c = send([mk()]);
    expect(useStore.getState().filteredSets.map((x) => x.id)).toEqual([b.id, c.id]);
    expect(c.seq).toBe(3);
    expect(c.label).toBe('#3 · test');
  });

  it('raw를 비우되 매수자·매도자는 정규화 필드로 보존한다', () => {
    const s = send([mk()]);
    expect(s.rows[0].raw).toEqual({});
    expect(s.rows[0].buyer).toBe('법인');
    expect(s.rows[0].seller).toBe('개인');
  });

  it('차트는 추가 순서대로 쌓이고 같은 블록 중복도 허용하며 개별 삭제된다', () => {
    const s = send([mk()]);
    const { addChart, removeChart } = useStore.getState();
    addChart(s.id, { kind: '1', deal: '매매' });
    addChart(s.id, { kind: '2', deal: '매매' });
    addChart(s.id, { kind: '1', deal: '매매' });
    const charts = () => useStore.getState().filteredSets[0].charts;
    expect(charts().map((c) => c.kind)).toEqual(['1', '2', '1']);
    expect(new Set(charts().map((c) => c.id)).size).toBe(3);
    removeChart(s.id, charts()[1].id);
    expect(charts().map((c) => c.kind)).toEqual(['1', '1']);
  });

  it('다른 표의 차트는 건드리지 않는다', () => {
    const a = send([mk()]);
    const b = send([mk()]);
    useStore.getState().addChart(a.id, { kind: '3', deal: '매매' });
    expect(useStore.getState().filteredSets.find((x) => x.id === b.id)!.charts).toHaveLength(0);
  });
});

describe('저장·불러오기 호환', () => {
  const base = (): SnapshotState => {
    const s = useStore.getState();
    return {
      projectName: s.projectName, config: s.config, sise: [], siseMeta: s.siseMeta, siseInput: [], sisePaste: '',
      siseConfirmed: false, tx: [], txMeta: null, txForm: s.txForm, rebResult: null, kosisResult: null,
      priceCalc: [], priceCalcKey: null, priceCalcRatio: 100, filteredSets: [],
    };
  };

  it('filteredSets가 엑셀 _appdata 왕복 후에도 같다', async () => {
    const s = send([mk()]);
    useStore.getState().addChart(s.id, { kind: '5b', deal: '매매' });
    const snap = { ...base(), filteredSets: useStore.getState().filteredSets };
    const buf = await workbookToBuffer(await buildSnapshotWorkbook(snap));
    const restored = await parseSnapshotFromBuffer(buf as ArrayBuffer);
    expect(restored.filteredSets).toEqual(snap.filteredSets);
  });

  it('필드가 없는 예전 스냅샷을 불러오면 filteredSets가 빈 배열로 초기화된다', () => {
    send([mk()]);
    const { filteredSets: _omit, ...old } = base();
    useStore.getState().loadSnapshot(old as Partial<SnapshotState>);
    expect(useStore.getState().filteredSets).toEqual([]);
  });
});
