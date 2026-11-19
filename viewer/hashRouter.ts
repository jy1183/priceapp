// 뷰어 전용 해시 라우터 — location.hash(#/sise 등)를 경로로 읽는 훅
import { useSyncExternalStore } from 'react';

export const DEFAULT_PATH = '/summary';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function currentPath(): string {
  const p = window.location.hash.replace(/^#/, '');
  return p.startsWith('/') && p.length > 1 ? p : DEFAULT_PATH;
}

/** 현재 해시 경로 (#/sise → '/sise'), 비어 있으면 기본 화면 */
export function useHashPath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => DEFAULT_PATH);
}
