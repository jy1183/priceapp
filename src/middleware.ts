// 로그인 쿠키가 없으면 페이지는 /login으로, /api/*는 401로 막는 접근 보호 middleware
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyToken } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // 로그인 화면과 로그인·로그아웃 API는 항상 허용
  if (pathname === '/login' || pathname === '/api/auth') return NextResponse.next();

  const password = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    // 운영에서 설정이 없으면 접근 차단(fail closed), 개발에서는 보호 없이 통과
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('APP_PASSWORD / AUTH_SECRET 환경변수가 설정되지 않았습니다.', { status: 503 });
    }
    return NextResponse.next();
  }

  if (await verifyToken(req.cookies.get(COOKIE_NAME)?.value, password, secret)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}
