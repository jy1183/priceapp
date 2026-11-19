// next/navigation 대체 — usePathname을 해시 라우터 경로로 제공
import { useHashPath } from '../hashRouter';

export function usePathname(): string {
  return useHashPath();
}
