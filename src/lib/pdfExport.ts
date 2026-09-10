// 결과 페이지를 A4 다중 페이지 PDF로 내보내기 — 화면을 그대로 찍지 않고 화면 밖 고정폭 복제본을 만들어 캡처하므로
// 브라우저 창 너비와 무관하게 항상 같은 결과가 나온다. 표·차트(data-pdf-block)는 페이지 경계에서 잘리지 않는다.
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;
const CAPTURE_SCALE = 2;
/** 복제본을 올려둘 화면 밖 영역의 폭 — 각 페이지가 자기 max-width(max-w-5xl/6xl) 안에서 데스크톱 레이아웃으로 펼쳐지도록 넉넉히 잡는다 */
const HOST_WIDTH_PX = 1400;
/** 라이브 차트와 복제본 차트를 짝짓기 위한 임시 표시 */
const CHART_MARK = 'data-pdf-chart-index';

export interface BlockRange { start: number; end: number }
export interface PageRange { start: number; end: number }
/** 제목 + 그에 딸린 표·차트를 묶은 한 덩어리 — 통째로 한 페이지에 들어가는 것을 우선한다 */
export interface GroupRange { start: number; end: number; blocks: BlockRange[] }

/** 그룹을 페이지 배치 단위로 변환 — 한 페이지에 들어가는 그룹은 통째로 하나의 단위,
 *  한 페이지보다 큰 그룹만 내부 블록(표·차트) 단위로 쪼갠다.
 *  덕분에 "제목만 남고 표·차트는 다음 장" 같은 분리가 생기지 않는다. */
export function buildUnits(groups: GroupRange[], pageCapacity: number): BlockRange[] {
  const units: BlockRange[] = [];
  for (const g of groups) {
    if (g.blocks.length > 0 && g.end - g.start > pageCapacity) units.push(...g.blocks);
    else units.push({ start: g.start, end: g.end });
  }
  return units;
}

/** 배치 단위(px) 경계만 잘라 페이지를 나누는 순수 함수 — 단위 하나가 페이지 용량보다 크면 부득이 그 안에서 균등 분할한다.
 *  페이지를 나눌 때 다음 단위가 안 들어가면 "직전에 실제로 들어간 내용의 끝"에서 페이지를 닫는다(다음 단위 시작 지점이 아님).
 *  그렇지 않으면 단위 사이의 여백(margin)이 현재 페이지 높이에 얹혀 용량을 근소하게 초과시키고, 그 여백만큼의
 *  거의 빈 페이지가 하나 더 생기는 문제가 생긴다. */
export function computePageBreaks(blocks: BlockRange[], pageCapacity: number, totalHeight: number): PageRange[] {
  if (totalHeight <= 0) return [{ start: 0, end: 0 }];

  const pages: PageRange[] = [];
  let pageStart = 0;
  let contentEnd = 0; // 현재 페이지에 실제로 들어간 내용의 끝(단위와 단위 사이 여백은 제외)
  for (const b of blocks) {
    if (b.start > pageStart && b.end - pageStart > pageCapacity) {
      pages.push({ start: pageStart, end: contentEnd });
      pageStart = b.start;
    }
    contentEnd = b.end;
  }
  pages.push({ start: pageStart, end: totalHeight });

  // 블록 경계로 나눈 페이지가 여전히 용량보다 크면(표 1개가 A4보다 긴 예외 상황) 그 페이지만 균등 분할
  const result: PageRange[] = [];
  for (const p of pages) {
    let s = p.start;
    while (p.end - s > pageCapacity) {
      result.push({ start: s, end: s + pageCapacity });
      s += pageCapacity;
    }
    result.push({ start: s, end: p.end });
  }
  return result;
}

/** 캡처용 화면 밖 복제본 생성 — 조작용 UI 제거, 표 가로 스크롤 해제(잘림 방지), 폭 고정 */
function buildCaptureClone(el: HTMLElement): { host: HTMLElement; root: HTMLElement } {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${HOST_WIDTH_PX}px;background:#ffffff;z-index:-1;`;
  const root = el.cloneNode(true) as HTMLElement;
  host.appendChild(root);
  document.body.appendChild(host);

  root.querySelectorAll('.no-print').forEach((n) => n.remove());
  // 표가 컨테이너보다 넓으면 화면에서는 가로 스크롤로 처리되지만 캡처에서는 오른쪽 열이 잘린 채 찍힌다 → 스크롤을 풀어 전체 폭을 살린다
  root.querySelectorAll<HTMLElement>('.overflow-x-auto').forEach((n) => { n.style.overflow = 'visible'; });

  // 펼친 표가 설계 폭을 넘치면 그만큼 캡처 폭을 넓혀 잘리지 않게 한다
  const designWidth = root.clientWidth;
  const neededWidth = root.scrollWidth;
  if (neededWidth > designWidth) {
    root.style.maxWidth = 'none';
    root.style.width = `${neededWidth}px`;
  } else {
    root.style.width = `${designWidth}px`;
  }
  return { host, root };
}

/** 이미지가 캡처 가능한 상태가 될 때까지 대기.
 *  `img.decode()`는 문서가 화면에 그려지지 않는 상황(백그라운드 탭 등)에서 영영 resolve되지 않을 수 있어 쓰지 않는다.
 *  타임아웃을 둬서 이미지 하나가 준비되지 않더라도 내보내기 전체가 멈추지 않게 한다. */
function imageReady(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) { resolve(); return; }
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, 3000);
  });
}

/** 복제본의 차트 자리를 ECharts가 직접 뽑은 PNG로 교체 — html2canvas는 ECharts 캔버스를 백지로 캡처하기 때문 */
async function swapChartsForImages(
  root: HTMLElement,
  liveCharts: HTMLElement[],
  echarts: typeof import('echarts'),
): Promise<void> {
  const pending: Promise<unknown>[] = [];
  root.querySelectorAll<HTMLElement>(`[${CHART_MARK}]`).forEach((slot) => {
    const live = liveCharts[Number(slot.getAttribute(CHART_MARK))];
    const inst = live ? echarts.getInstanceByDom(live) : undefined;
    if (!inst) return;

    const height = live.clientHeight;
    const liveWidth = live.clientWidth;
    const width = slot.clientWidth || liveWidth;
    // 출력 폭에 맞춰 다시 그린 뒤 이미지를 뽑고 곧바로 원래 크기로 되돌린다(같은 태스크 안이라 화면에는 보이지 않는다)
    if (width > 0 && height > 0) inst.resize({ width, height, animation: { duration: 0 } });
    const url = inst.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' });
    if (width > 0 && height > 0) inst.resize({ width: liveWidth, height, animation: { duration: 0 } });

    const img = document.createElement('img');
    img.style.cssText = `width:${width}px;height:${height}px;display:block;`;
    img.src = url;
    pending.push(imageReady(img));
    slot.replaceChildren(img);
  });
  await Promise.all(pending);
}

/** el(캡처 대상 컨테이너) → A4 다중 페이지 PDF 다운로드. data-pdf-block 요소 경계에서만 페이지를 나눈다. */
export async function exportElementToPdf(el: HTMLElement, fileName: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const echarts = await import('echarts');

  // 라이브 차트에 순번을 붙인 뒤 복제 → 복제본에서 같은 순번으로 짝을 찾는다
  const liveCharts = Array.from(el.querySelectorAll<HTMLElement>('div')).filter((d) => echarts.getInstanceByDom(d));
  liveCharts.forEach((d, i) => d.setAttribute(CHART_MARK, String(i)));

  const { host, root } = buildCaptureClone(el);
  try {
    await swapChartsForImages(root, liveCharts, echarts);

    const rootRect = root.getBoundingClientRect();
    // 제목(data-pdf-group-start)을 기준으로 블록들을 그룹으로 묶는다 — 제목·표·차트가 한 덩어리로 움직이게 하기 위함
    const groupsCss: GroupRange[] = [];
    Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-block]')).forEach((b) => {
      const r = b.getBoundingClientRect();
      const range = { start: r.top - rootRect.top, end: r.bottom - rootRect.top };
      const last = groupsCss[groupsCss.length - 1];
      if (!last || b.hasAttribute('data-pdf-group-start')) {
        groupsCss.push({ ...range, blocks: [range] });
      } else {
        last.blocks.push(range);
        last.end = range.end;
      }
    });

    // 캡처 크기·가상 창 크기를 모두 명시한다 — 지정하지 않으면 html2canvas가 실제 브라우저 창 크기를 참조해
    // 창 크기에 따라 결과가 달라지고, 창이 0×0인 상황(백그라운드 탭 등)에서는 캡처가 멈춘다
    const canvas = await html2canvas(root, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      width: Math.ceil(rootRect.width),
      height: Math.ceil(root.scrollHeight),
      windowWidth: Math.ceil(rootRect.width),
      windowHeight: Math.ceil(root.scrollHeight),
      scrollX: 0,
      scrollY: 0,
    });
    const canvasScale = canvas.width / rootRect.width;
    const scaleRange = (r: BlockRange): BlockRange => ({ start: r.start * canvasScale, end: r.end * canvasScale });
    const groups: GroupRange[] = groupsCss.map((g) => ({ ...scaleRange(g), blocks: g.blocks.map(scaleRange) }));

    const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
    const pageCapacityPx = CONTENT_HEIGHT_MM * pxPerMm;
    const pages = computePageBreaks(buildUnits(groups, pageCapacityPx), pageCapacityPx, canvas.height);

    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < pages.length; i++) {
      const sliceStart = pages[i].start;
      const sliceHeightPx = pages[i].end - sliceStart;
      if (sliceHeightPx <= 0) continue;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, sliceStart, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

      if (i > 0) pdf.addPage();
      // 압축을 지정하지 않으면 무압축 RGB로 들어가 파일이 수십 MB로 불어난다
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, sliceHeightPx / pxPerMm, undefined, 'MEDIUM');
    }
    pdf.save(fileName);
  } finally {
    host.remove();
    liveCharts.forEach((d) => d.removeAttribute(CHART_MARK));
  }
}
