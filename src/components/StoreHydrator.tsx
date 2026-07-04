'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/** 클라이언트 마운트 후 localStorage에서 스토어 복원 (SSR 불일치 방지) */
export default function StoreHydrator() {
  useEffect(() => { useStore.persist.rehydrate(); }, []);
  return null;
}
