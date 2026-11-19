// 공용 비밀번호 로그인(POST)과 로그아웃(DELETE) — 서명된 httpOnly 쿠키 발급·삭제
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, SESSION_DAYS, checkPassword, createToken, sanitizeNext } from '@/lib/auth';

export const runtime = 'nodejs';

const FAIL_DELAY_MS = 800; // 무차별 대입 완화용 고정 지연

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return NextResponse.json({ error: 'APP_PASSWORD / AUTH_SECRET 미설정' }, { status: 500 });
  }
  let body: { password?: unknown; next?: unknown } = {};
  try { body = await req.json(); } catch { /* 빈 본문은 실패 처리 */ }
  const input = typeof body.password === 'string' ? body.password : '';

  if (!input || !(await checkPassword(input, password, secret))) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, next: sanitizeNext(typeof body.next === 'string' ? body.next : null) });
  res.cookies.set(COOKIE_NAME, await createToken(password, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
