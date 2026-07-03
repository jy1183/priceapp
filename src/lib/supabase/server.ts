/** 서버 전용 Supabase 클라이언트 (service_role) — RLS 우회, 절대 클라이언트 노출 금지 */
import { createClient } from '@supabase/supabase-js';

export function adminAvailable() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
