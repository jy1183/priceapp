// 오프라인 뷰어(file://) 여부와 패키지 메타 정보를 제공 — 조회 3종 비활성화에 사용
export interface PackageMeta {
  name: string;       // 패키지 이름(HTML 파일명)
  savedAt: string;    // 저장일시(ISO)
  appOrigin: string;  // 저장 시점의 본앱 주소(location.origin)
}

declare global {
  interface Window {
    __PRICEAPP_VIEWER__?: boolean;
    __PRICEAPP_SNAPSHOT__?: unknown;
    __PRICEAPP_META__?: PackageMeta;
  }
}

/** 뷰어 번들에서만 true — 뷰어 엔트리(viewer/main.tsx)가 렌더 전에 플래그를 세운다 */
export function isViewerMode(): boolean {
  return typeof window !== 'undefined' && window.__PRICEAPP_VIEWER__ === true;
}

/** 훅 형태 — 뷰어 여부는 렌더 도중 바뀌지 않으므로 단순 조회 */
export function useViewerMode(): boolean {
  return isViewerMode();
}

export const VIEWER_QUERY_NOTICE = '오프라인 보기에서는 조회 기능을 사용할 수 없습니다. 저장된 결과만 표시됩니다.';
