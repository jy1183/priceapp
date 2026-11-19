// 최근 패키지 목록 — 저장·열기 때 받은 폴더 핸들을 IndexedDB에 보관해 다음 접속에서 탐색창 없이 복원
export interface RecentPackage {
  key: string;
  name: string;         // 패키지 이름({이름}.html, {이름}_data)
  projectName: string;
  savedAt: string;      // ISO
  dir: FileSystemDirectoryHandle; // HTML과 _data 폴더가 들어 있는 상위 폴더
}

const DB_NAME = 'priceapp-packages';
const STORE = 'recent';
const MAX_RECENT = 10;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** 저장일시 최신순 목록 — IndexedDB를 쓸 수 없으면 빈 목록 */
export async function listRecentPackages(): Promise<RecentPackage[]> {
  try {
    const db = await openDb();
    const all = await run<RecentPackage[]>(db, 'readonly', (s) => s.getAll());
    db.close();
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch { return []; }
}

/** 같은 폴더·같은 이름이면 갱신, 아니면 추가 (최대 개수 초과 시 오래된 것부터 제거) */
export async function rememberPackage(rec: Omit<RecentPackage, 'key'>): Promise<void> {
  try {
    const existing = await listRecentPackages();
    let key = '';
    for (const e of existing) {
      if (e.name === rec.name && (await e.dir.isSameEntry(rec.dir))) { key = e.key; break; }
    }
    if (!key) key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const db = await openDb();
    await run(db, 'readwrite', (s) => s.put({ ...rec, key }));
    const others = existing.filter((e) => e.key !== key);
    for (const old of others.slice(MAX_RECENT - 1)) await run(db, 'readwrite', (s) => s.delete(old.key));
    db.close();
  } catch { /* 핸들 보관 실패는 저장 결과에 영향 없음 */ }
}

export async function forgetPackage(key: string): Promise<void> {
  try {
    const db = await openDb();
    await run(db, 'readwrite', (s) => s.delete(key));
    db.close();
  } catch { /* 무시 */ }
}
