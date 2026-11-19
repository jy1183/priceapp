'use client';
// 공용 비밀번호 입력 화면(로그인 성공 시 next 경로로 이동)

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = new URLSearchParams(window.location.search).get('next');
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.href = j.next ?? '/';
        return;
      }
      setError(j.error ?? '로그인에 실패했습니다.');
    } catch {
      setError('서버에 연결하지 못했습니다.');
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-bold text-gray-900">주변 가격 분석</h1>
        <p className="mb-4 text-sm text-gray-500">비밀번호를 입력해 주세요.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded border px-3 py-2 text-sm"
          placeholder="비밀번호"
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
