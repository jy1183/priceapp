// 공용 비밀번호 로그인용 쿠키 서명·검증 유틸(Edge·Node 공용, Web Crypto만 사용)

export const COOKIE_NAME = 'priceapp_auth';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 길이가 달라도 전체를 순회하는 상수 시간 문자열 비교 */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** 입력 비밀번호가 맞는지(서명을 통해 길이·내용 무관 상수 시간 비교) */
export async function checkPassword(input: string, password: string, secret: string): Promise<boolean> {
  return safeEqual(await sign(secret, `pw:${input}`), await sign(secret, `pw:${password}`));
}

/** `만료시각(ms).서명` 토큰 발급. 서명에 비밀번호를 포함해 비밀번호 변경 시 기존 토큰이 무효화된다. */
export async function createToken(password: string, secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_DAYS * 86400_000);
  return `${exp}.${await sign(secret, `${exp}:${password}`)}`;
}

export async function verifyToken(token: string | undefined, password: string, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const i = token.indexOf('.');
  if (i < 1) return false;
  const exp = token.slice(0, i);
  if (!/^\d+$/.test(exp) || Number(exp) <= now) return false;
  return safeEqual(token.slice(i + 1), await sign(secret, `${exp}:${password}`));
}

/** 로그인 후 이동 경로. 같은 출처 상대 경로만 허용(open redirect 방지) */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/api/')) return '/';
  return next;
}
