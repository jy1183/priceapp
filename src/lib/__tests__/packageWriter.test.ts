// HTML 패키지(snapshot.js·로더 HTML) 생성·파싱 왕복 무손실 검증
import { describe, it, expect } from 'vitest';
import { buildSnapshotJs, parseSnapshotJs, buildPackageHtml, sanitizePackageName, dataFolderName } from '@/lib/packageWriter';
import { DEFAULT_CONFIG } from '@/lib/calc/constants';
import type { SnapshotState } from '@/lib/store';

const snap: SnapshotState = {
  projectName: '테스트 검토 </script><!-- 특수문자   "따옴표"',
  config: DEFAULT_CONFIG,
  sise: [{ facility: '오피스텔', deal: '매매', ppaSupply: 1000, ppaExcl: 1200, ppaYeon: null }],
  siseMeta: { parsedCount: 1, errorCount: 0 },
  siseInput: [{ id: 1, facility: '오피스텔', approvalDate: '2016.03.', name: '리버리치', amountText: '매매 3억 5,000', areaText: '전용 39.98㎡ 5/15층 남향' }],
  sisePaste: '붙여넣기 원문\n두번째 줄',
  siseConfirmed: true,
  tx: [{
    facility: '오피스텔', trade: '매매', dealType: '매매', name: '테스트오피스텔',
    buildYear: 2015, areaM2: 39.98, amountManwon: 35000, depositManwon: null, monthlyRentManwon: null,
    dealDate: '2025-03-01', floor: 5, ppa: 1150.5, raw: { totalFloorAr: '120.5' },
  }],
  txMeta: { facility: '오피스텔', trade: '매매', region: '영등포동8가', from: '202501', to: '202506' },
  txForm: { sido: '서울특별시', lawdCd: '11560', dong: '영등포동8가', facility: '오피스텔', trade: '매매', from: '202501', to: '202506', period: 'all' },
  rebResult: null,
  kosisResult: null,
  priceCalc: [{ id: 1, facility: '오피스텔', type: '84A(34평)', units: 10, exclM2: 84.5 }],
  priceCalcKey: null,
  priceCalcRatio: 100,
  filteredSets: [],
};

describe('packageWriter snapshot.js 왕복', () => {
  it('스냅샷 → snapshot.js → 파싱하면 원본과 동일하다', () => {
    expect(parseSnapshotJs(buildSnapshotJs(snap))).toEqual(snap);
  });

  it('snapshot.js를 브라우저처럼 스크립트로 실행하면 전역에 같은 스냅샷이 올라간다', () => {
    const win: Record<string, unknown> = {};
    new Function('window', buildSnapshotJs(snap))(win);
    expect(win.__PRICEAPP_SNAPSHOT__).toEqual(snap);
  });

  it('snapshot.js가 아닌 텍스트는 거부한다', () => {
    expect(() => parseSnapshotJs('hello')).toThrow();
  });
});

describe('packageWriter 로더 HTML', () => {
  const meta = { name: '20261119_영등포동8가_주변가격분석', savedAt: '2026-11-19T01:02:03.000Z', appOrigin: 'https://app.example.com' };

  it('폴더 방식은 상대경로 클래식 스크립트만 쓴다 (module·절대경로 없음)', () => {
    const html = buildPackageHtml({ meta, projectName: snap.projectName, mode: { kind: 'folder', dataDir: dataFolderName(meta.name) } });
    const d = encodeURIComponent(`${meta.name}_data`);
    expect(html).toContain(`<script src="${d}/snapshot.js"></script>`);
    expect(html).toContain(`<script src="${d}/viewer.js"></script>`);
    expect(html).toContain(`<link rel="stylesheet" href="${d}/viewer.css">`);
    expect(html).not.toContain('type="module"');
    expect(html).not.toMatch(/(src|href)="\//);
    expect(html).toContain('데이터 폴더를 찾을 수 없습니다');
  });

  it('프로젝트명·메타의 특수문자가 HTML을 깨지 않는다', () => {
    const html = buildPackageHtml({ meta, projectName: snap.projectName, mode: { kind: 'folder', dataDir: 'x_data' } });
    expect(html).toContain('<title>테스트 검토 &lt;/script&gt;&lt;!--');
    const tags = html.match(/<\/script>/g) ?? [];
    expect(tags.length).toBe(4); // 메타 + snapshot + viewer + 가드, 프로젝트명이 만든 가짜 종료 태그 없음
  });

  it('단일 HTML은 인라인 스크립트에 </script가 있어도 깨지지 않고 스냅샷이 복원된다', () => {
    const viewerJs = 'var s="</script><!--";window.__V__=s;';
    const html = buildPackageHtml({ meta, projectName: 'p', mode: { kind: 'single', snapshotJs: buildSnapshotJs(snap), viewerJs, viewerCss: 'body{}' } });
    const bodies = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(bodies.length).toBe(3); // 메타 + snapshot + viewer
    const win: Record<string, unknown> = {};
    for (const b of bodies) new Function('window', b)(win);
    expect(win.__PRICEAPP_SNAPSHOT__).toEqual(snap);
    expect(win.__PRICEAPP_META__).toEqual(meta);
    expect(win.__V__).toBe('</script><!--');
  });
});

describe('sanitizePackageName', () => {
  it('파일명에 쓸 수 없는 문자를 제거한다', () => {
    expect(sanitizePackageName(' a/b:c*d?"e<f>g|h. ')).toBe('abcdefgh');
  });
});
