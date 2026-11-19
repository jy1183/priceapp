// next/dynamic 대체 — React.lazy 래퍼(단일 번들에 인라인된 import()를 그대로 사용)
import { lazy, Suspense, type ComponentType } from 'react';

type Loader = () => Promise<{ default: ComponentType<any> } | ComponentType<any>>;

export default function dynamic(loader: Loader, _opts?: unknown): ComponentType<any> {
  const Lazy = lazy(async () => {
    const mod: any = await loader();
    return { default: (mod && mod.default) ?? mod };
  });
  return function Dynamic(props: any) {
    return <Suspense fallback={null}><Lazy {...props} /></Suspense>;
  };
}
