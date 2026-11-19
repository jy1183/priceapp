// 로그인 쿠키 서명·만료·변조·이동경로 검증 테스트
import { describe, it, expect } from 'vitest';
import { createToken, verifyToken, checkPassword, sanitizeNext, safeEqual, SESSION_DAYS } from '@/lib/auth';

const PW = 'correct horse battery';
const SECRET = 'test-secret-0123456789abcdef0123456789';
const NOW = 1_800_000_000_000;

describe('토큰', () => {
  it('발급한 토큰은 검증을 통과한다', async () => {
    const t = await createToken(PW, SECRET, NOW);
    expect(await verifyToken(t, PW, SECRET, NOW + 1000)).toBe(true);
  });
  it('만료되면 거부한다', async () => {
    const t = await createToken(PW, SECRET, NOW);
    expect(await verifyToken(t, PW, SECRET, NOW + SESSION_DAYS * 86400_000 + 1)).toBe(false);
  });
  it('만료시각을 늘려 변조하면 거부한다', async () => {
    const t = await createToken(PW, SECRET, NOW);
    const [exp, sig] = t.split('.');
    expect(await verifyToken(`${Number(exp) + 999999999}.${sig}`, PW, SECRET, NOW)).toBe(false);
  });
  it('비밀번호나 비밀키가 바뀌면 기존 토큰이 무효화된다', async () => {
    const t = await createToken(PW, SECRET, NOW);
    expect(await verifyToken(t, 'other', SECRET, NOW)).toBe(false);
    expect(await verifyToken(t, PW, 'other-secret', NOW)).toBe(false);
  });
  it('없거나 형식이 틀린 토큰은 거부한다', async () => {
    for (const bad of [undefined, '', 'abc', '.abc', 'x.y', '123']) {
      expect(await verifyToken(bad, PW, SECRET, NOW)).toBe(false);
    }
  });
});

describe('비밀번호 확인', () => {
  it('일치할 때만 true', async () => {
    expect(await checkPassword(PW, PW, SECRET)).toBe(true);
    expect(await checkPassword(PW + 'x', PW, SECRET)).toBe(false);
    expect(await checkPassword('', PW, SECRET)).toBe(false);
  });
  it('safeEqual은 길이가 다르면 false', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abc')).toBe(true);
  });
});

describe('sanitizeNext', () => {
  it('같은 출처 상대 경로만 허용한다', () => {
    expect(sanitizeNext('/summary?a=1')).toBe('/summary?a=1');
    expect(sanitizeNext('//evil.com')).toBe('/');
    expect(sanitizeNext('https://evil.com')).toBe('/');
    expect(sanitizeNext('/\\evil.com')).toBe('/');
    expect(sanitizeNext('/login')).toBe('/');
    expect(sanitizeNext('/api/molit')).toBe('/');
    expect(sanitizeNext(null)).toBe('/');
  });
});
