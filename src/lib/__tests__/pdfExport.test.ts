// PDF 페이지네이션 계산 검증 — 그룹(제목+표+차트) 단위 묶기(buildUnits) + 페이지 경계(computePageBreaks)
import { describe, it, expect } from 'vitest';
import { computePageBreaks, buildUnits, type GroupRange } from '@/lib/pdfExport';

describe('computePageBreaks — 블록 경계 기준 페이지 분할', () => {
  it('전체 높이가 페이지 용량보다 작으면 1페이지로 끝난다', () => {
    const blocks = [{ start: 0, end: 300 }];
    expect(computePageBreaks(blocks, 1000, 300)).toEqual([{ start: 0, end: 300 }]);
  });

  it('블록이 페이지 경계에 걸치면 블록 시작 지점에서 페이지를 나눈다(블록 중간에서 자르지 않음)', () => {
    // 페이지 용량 1000. 블록1: 0~900, 블록2: 900~1400(1000을 넘어감) → 블록2 시작(900)에서 분할
    const blocks = [{ start: 0, end: 900 }, { start: 900, end: 1400 }];
    const pages = computePageBreaks(blocks, 1000, 1400);
    expect(pages).toEqual([{ start: 0, end: 900 }, { start: 900, end: 1400 }]);
  });

  it('블록 사이 여백만큼 용량을 근소하게 넘겨도, 그 여백은 페이지에서 제외되고 빈 페이지가 추가로 생기지 않는다', () => {
    // 페이지 용량 1000. 블록1: 0~980(용량 이내), 블록2: 1020~1400(사이 여백 40).
    // 블록2까지 이어붙이면 1400>1000이라 블록2 시작(1020)에서 분할해야 하지만,
    // 페이지1은 "실제로 들어간 내용의 끝"인 980에서 닫혀야 한다(1000이 아니라) — 여백만큼의 빈 페이지가 생기면 버그.
    const blocks = [{ start: 0, end: 980 }, { start: 1020, end: 1400 }];
    const pages = computePageBreaks(blocks, 1000, 1400);
    expect(pages).toEqual([{ start: 0, end: 980 }, { start: 1020, end: 1400 }]);
  });

  it('여러 블록이 여러 페이지로 자연스럽게 나뉜다', () => {
    // 페이지 용량 1000
    // p1: 블록A(0~400)+블록B(400~950) — 블록C(950~1300)까지 누적하면 1300>1000이라 C 시작(950)에서 분할, p1은 B의 끝(950)에서 닫힘
    // p2: 블록C(950~1300)+블록D(1300~1900) — 블록E(1900~2100)까지 누적하면 1150>1000이라 E 시작(1900)에서 분할, p2는 D의 끝(1900)에서 닫힘
    // p3: 블록E(1900~2100)
    const blocks = [
      { start: 0, end: 400 },
      { start: 400, end: 950 },
      { start: 950, end: 1300 },
      { start: 1300, end: 1900 },
      { start: 1900, end: 2100 },
    ];
    const pages = computePageBreaks(blocks, 1000, 2100);
    expect(pages).toEqual([
      { start: 0, end: 950 },
      { start: 950, end: 1900 },
      { start: 1900, end: 2100 },
    ]);
  });

  it('블록 하나가 페이지 용량보다 크면 그 블록 내부를 균등 분할한다(예외 상황)', () => {
    // 페이지 용량 1000, 블록 하나가 0~2500
    const blocks = [{ start: 0, end: 2500 }];
    const pages = computePageBreaks(blocks, 1000, 2500);
    expect(pages).toEqual([
      { start: 0, end: 1000 },
      { start: 1000, end: 2000 },
      { start: 2000, end: 2500 },
    ]);
  });

  it('블록이 없으면(빈 컨테이너) 전체 높이를 페이지 용량 기준으로만 분할한다', () => {
    const pages = computePageBreaks([], 1000, 2500);
    expect(pages).toEqual([
      { start: 0, end: 1000 },
      { start: 1000, end: 2000 },
      { start: 2000, end: 2500 },
    ]);
  });

  it('전체 높이가 0이면 빈 페이지 하나를 반환한다', () => {
    expect(computePageBreaks([], 1000, 0)).toEqual([{ start: 0, end: 0 }]);
  });
});

/** 제목·표·차트 한 세트를 그룹으로 만드는 헬퍼 */
const group = (start: number, ...blocks: [number, number][]): GroupRange => ({
  start,
  end: blocks[blocks.length - 1][1],
  blocks: blocks.map(([s, e]) => ({ start: s, end: e })),
});

describe('buildUnits — 제목+표+차트를 한 덩어리로 묶기', () => {
  it('한 페이지에 들어가는 그룹은 통째로 하나의 배치 단위가 된다', () => {
    const g = group(0, [0, 100], [120, 500], [520, 900]); // 제목·표·차트
    expect(buildUnits([g], 1000)).toEqual([{ start: 0, end: 900 }]);
  });

  it('한 페이지보다 큰 그룹만 내부 블록 단위로 쪼갠다', () => {
    const g = group(0, [0, 100], [120, 900], [920, 1800]); // 그룹 높이 1800 > 용량 1000
    expect(buildUnits([g], 1000)).toEqual([
      { start: 0, end: 100 },
      { start: 120, end: 900 },
      { start: 920, end: 1800 },
    ]);
  });

  it('제목만 있고 표·차트가 아직 없는 그룹도 하나의 단위로 유지된다', () => {
    const g = group(0, [0, 100]);
    expect(buildUnits([g], 1000)).toEqual([{ start: 0, end: 100 }]);
  });
});

describe('그룹 단위 페이지 배치 (buildUnits + computePageBreaks)', () => {
  it('제목만 페이지 끝에 남지 않고 그룹 전체가 다음 페이지로 넘어간다', () => {
    // 용량 1000. 그룹1(0~800)은 1페이지에 들어가지만,
    // 그룹2(제목 850~950, 표 970~1300, 차트 1320~1800 — 그룹 높이 950으로 한 페이지에는 들어감)는
    // 그룹1 뒤에 이어 붙이면 1800>1000이라 통째로 다음 페이지로 가야 한다.
    // 블록 단위로만 나눴다면 제목(850~950)이 1페이지 끝에 남아버린다.
    const groups: GroupRange[] = [
      group(0, [0, 100], [120, 800]),
      group(850, [850, 950], [970, 1300], [1320, 1800]),
    ];
    const pages = computePageBreaks(buildUnits(groups, 1000), 1000, 1800);
    expect(pages).toEqual([
      { start: 0, end: 800 },     // 그룹1만
      { start: 850, end: 1800 },  // 그룹2 전체(제목+표+차트)
    ]);
  });

  it('그룹이 남은 공간에 들어가면 같은 페이지에 이어 붙인다', () => {
    const groups: GroupRange[] = [
      group(0, [0, 100], [120, 400]),
      group(450, [450, 550], [570, 900]),
    ];
    const pages = computePageBreaks(buildUnits(groups, 1000), 1000, 900);
    expect(pages).toEqual([{ start: 0, end: 900 }]);
  });
});
