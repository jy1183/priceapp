// 오프라인 뷰어 엔트리 — 스냅샷 주입(저장소 읽기·쓰기 없음) 후 해시 라우터 앱을 렌더
import { createRoot } from 'react-dom/client';
import '../src/app/globals.css';
import { useStore, type SnapshotState } from '@/lib/store';
import App from './App';

// 조회 비활성화 등 뷰어 분기의 기준 플래그 — 렌더 전에 세운다
window.__PRICEAPP_VIEWER__ = true;

// file:// localStorage는 모든 로컬 페이지가 공유하므로 persist의 읽기·쓰기를 완전히 막는다
useStore.persist.setOptions({
  storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
});

const snap = window.__PRICEAPP_SNAPSHOT__ as SnapshotState | undefined;
if (snap) useStore.getState().loadSnapshot(snap);

(window as unknown as { __PRICEAPP_VIEWER_READY__?: boolean }).__PRICEAPP_VIEWER_READY__ = true;
createRoot(document.getElementById('root')!).render(<App meta={window.__PRICEAPP_META__} hasSnapshot={!!snap} />);
