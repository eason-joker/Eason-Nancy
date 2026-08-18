import type { GlossaryTerm, TranslationSegment, TranslationToken } from './types';

const DB_NAME = 'ArtTrans_Local';
const DB_VERSION = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookMeta {
  id: string;
  title: string;
  filename: string;
  totalChapters: number;
  totalSegments: number;
  lastModified: number;
}

export interface SegmentRecord {
  id: string;            // `${bookId}-${chapterIndex}-${segmentIndex}`
  bookId: string;
  chapterIndex: number;
  segmentIndex: number;
  chapterTitle: string;
  source: string;
  translation: string;
  status: 'pending' | 'translating' | 'translated' | 'reviewed';
  tokens: TranslationToken[];
  isCustomEdited: boolean;
  customText: string;
  editMode: 'interactive' | 'text';
  rawTranslation: string;
  translationStructure: Array<{ type: 'text' | 'token'; value: string }>;
}

export interface GlossaryMeta {
  filename: string;
  lastModified: number;
  termCount: number;
  hash: string;
}

// ─── DB Open ─────────────────────────────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Glossary stores
      if (!db.objectStoreNames.contains('glossary')) {
        const store = db.createObjectStore('glossary', { keyPath: 'id' });
        store.createIndex('source', 'source', { unique: false });
        store.createIndex('lang', 'lang', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('glossary_meta')) {
        db.createObjectStore('glossary_meta', { keyPath: 'filename' });
      }

      // Translation stores
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('translations')) {
        const store = db.createObjectStore('translations', { keyPath: 'id' });
        store.createIndex('bookId', 'bookId', { unique: false });
        store.createIndex('chapterIndex', 'chapterIndex', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// ─── Glossary Operations ──────────────────────────────────────────────────────

export async function queryGlossary(
  search: string,
  page: number = 0,
  pageSize: number = 200
): Promise<{ terms: GlossaryTerm[]; total: number }> {
  const db = await openDB();
  const transaction = db.transaction('glossary', 'readonly');
  const store = transaction.objectStore('glossary');
  const searchTerm = search.trim().toLowerCase();

  return new Promise((resolve, reject) => {
    const results: GlossaryTerm[] = [];
    let totalCount = 0;
    const offset = page * pageSize;
    let skipped = 0;

    const cursorReq = store.openCursor(null, 'prev');

    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const term = cursor.value as GlossaryTerm;
        // Case-insensitive fuzzy match on source field
        const matches = !searchTerm || term.source.toLowerCase().includes(searchTerm);

        if (matches) {
          totalCount++;
          if (skipped < offset) {
            skipped++;
          } else if (results.length < pageSize) {
            results.push(term);
          }
        }
        cursor.continue();
      } else {
        resolve({ terms: results, total: totalCount });
      }
    };

    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function importGlossaryBatch(
  terms: GlossaryTerm[],
  batchSize: number = 500
): Promise<{ imported: number; merged: number; errors: string[] }> {
  const db = await openDB();
  const transaction = db.transaction('glossary', 'readwrite');
  const store = transaction.objectStore('glossary');

  let imported = 0;
  let merged = 0;
  const errors: string[] = [];

  // Process in batches to avoid memory issues
  for (let i = 0; i < terms.length; i += batchSize) {
    const batch = terms.slice(i, i + batchSize);
    for (const term of batch) {
      try {
        const getReq = store.get(term.id);
        const existing = await new Promise<GlossaryTerm | undefined>((res, rej) => {
          getReq.onsuccess = () => res(getReq.result);
          getReq.onerror = () => rej(getReq.error);
        });

        if (existing) {
          // Merge: combine translations, keep longer note/provenance
          const mergedTranslations = Array.from(
            new Set([...existing.translations, ...term.translations])
          );
          store.put({
            ...existing,
            translations: mergedTranslations,
            note: term.note?.length > existing.note?.length ? term.note : existing.note,
            provenance: term.provenance?.length > existing.provenance?.length ? term.provenance : existing.provenance,
            updatedAt: Date.now(),
          });
          merged++;
        } else {
          store.put(term);
          imported++;
        }
      } catch (e) {
        errors.push(`Failed to import ${term.source}: ${e}`);
      }
    }
  }

  return { imported, merged, errors };
}

export async function addGlossaryTerm(term: Omit<GlossaryTerm, 'id' | 'updatedAt'>): Promise<{ term: GlossaryTerm; merged: boolean }> {
  const db = await openDB();
  const transaction = db.transaction('glossary', 'readwrite');
  const store = transaction.objectStore('glossary');

  const id = `${term.source}-${term.lang}-${Date.now()}`;
  const newTerm: GlossaryTerm = {
    ...term,
    id,
    updatedAt: Date.now(),
  };

  // Check for duplicate by source+lang
  const index = store.index('source');
  const cursorReq = index.openCursor(IDBKeyRange.bound(term.source, term.source + '￿'));

  return new Promise((resolve, reject) => {
    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const existing = cursor.value as GlossaryTerm;
        if (existing.source === term.source && existing.lang === term.lang) {
          // Merge
          const mergedTranslations = Array.from(
            new Set([...existing.translations, ...term.translations])
          );
          const updated: GlossaryTerm = {
            ...existing,
            translations: mergedTranslations,
            note: term.note?.length > existing.note?.length ? term.note : existing.note,
            provenance: term.provenance?.length > existing.provenance?.length ? term.provenance : existing.provenance,
            updatedAt: Date.now(),
          };
          store.put(updated);
          resolve({ term: updated, merged: true });
        } else {
          cursor.continue();
        }
      } else {
        store.put(newTerm);
        resolve({ term: newTerm, merged: false });
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function deleteGlossaryTerm(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('glossary', 'readwrite');
  const store = transaction.objectStore('glossary');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearGlossary(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('glossary', 'readwrite');
  const store = transaction.objectStore('glossary');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveGlossaryMeta(meta: GlossaryMeta): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('glossary_meta', 'readwrite');
  const store = transaction.objectStore('glossary_meta');
  return new Promise((resolve, reject) => {
    const req = store.put(meta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getGlossaryMeta(filename: string): Promise<GlossaryMeta | undefined> {
  const db = await openDB();
  const transaction = db.transaction('glossary_meta', 'readonly');
  const store = transaction.objectStore('glossary_meta');
  return new Promise((resolve, reject) => {
    const req = store.get(filename);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Book / Translation Operations ───────────────────────────────────────────

export async function saveBook(book: BookMeta): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('books', 'readwrite');
  const store = transaction.objectStore('books');
  return new Promise((resolve, reject) => {
    const req = store.put(book);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getBook(id: string): Promise<BookMeta | undefined> {
  const db = await openDB();
  const transaction = db.transaction('books', 'readonly');
  const store = transaction.objectStore('books');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllBooks(): Promise<BookMeta[]> {
  const db = await openDB();
  const transaction = db.transaction('books', 'readonly');
  const store = transaction.objectStore('books');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();

  // Delete all translations for this book
  const transTransaction = db.transaction('translations', 'readwrite');
  const transStore = transTransaction.objectStore('translations');
  const index = transStore.index('bookId');
  const cursorReq = index.openCursor(IDBKeyRange.only(id));

  return new Promise((resolve, reject) => {
    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    const bookTransaction = db.transaction('books', 'readwrite');
    const bookStore = bookTransaction.objectStore('books');
    const delReq = bookStore.delete(id);

    bookTransaction.oncomplete = () => resolve();
    bookTransaction.onerror = () => reject(bookTransaction.error);
  });
}

export async function saveSegment(segment: SegmentRecord): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('translations', 'readwrite');
  const store = transaction.objectStore('translations');
  return new Promise((resolve, reject) => {
    const req = store.put(segment);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSegment(id: string): Promise<SegmentRecord | undefined> {
  const db = await openDB();
  const transaction = db.transaction('translations', 'readonly');
  const store = transaction.objectStore('translations');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSegmentsByBook(
  bookId: string,
  chapterIndex?: number
): Promise<SegmentRecord[]> {
  const db = await openDB();
  const transaction = db.transaction('translations', 'readonly');
  const store = transaction.objectStore('translations');
  const index = store.index('bookId');

  return new Promise((resolve, reject) => {
    const results: SegmentRecord[] = [];
    const cursorReq = index.openCursor(IDBKeyRange.only(bookId));

    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const seg = cursor.value as SegmentRecord;
        if (chapterIndex === undefined || seg.chapterIndex === chapterIndex) {
          results.push(seg);
        }
        cursor.continue();
      } else {
        // Sort by chapterIndex then segmentIndex
        results.sort((a, b) =>
          a.chapterIndex !== b.chapterIndex
            ? a.chapterIndex - b.chapterIndex
            : a.segmentIndex - b.segmentIndex
        );
        resolve(results);
      }
    };

    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function getBookProgress(bookId: string): Promise<{
  total: number;
  translated: number;
  reviewed: number;
  firstPendingIndex: number | null; // chapterIndex-segmentIndex of first pending
}> {
  const segments = await getSegmentsByBook(bookId);
  const total = segments.length;
  const translated = segments.filter(s => s.status === 'translated' || s.status === 'reviewed').length;
  const reviewed = segments.filter(s => s.status === 'reviewed').length;

  // Find first pending
  const pending = segments.find(s => s.status === 'pending');
  const firstPendingIndex = pending
    ? pending.chapterIndex * 10000 + pending.segmentIndex
    : null;

  return { total, translated, reviewed, firstPendingIndex };
}

export async function getNextPendingSegment(bookId: string): Promise<SegmentRecord | null> {
  const segments = await getSegmentsByBook(bookId);
  return segments.find(s => s.status === 'pending') || null;
}

export async function saveGlossaryMetaFile(meta: GlossaryMeta): Promise<void> {
  return saveGlossaryMeta(meta);
}

// ─── Quick Translate Session ─────────────────────────────────────────────────────

const QUICK_TRANSLATE_KEY = 'arttrans_quick_translate';

export async function saveQuickTranslateSession(segments: SegmentRecord[]): Promise<void> {
  // Clear existing first
  await clearQuickTranslateSession();

  // Save each segment individually
  for (const seg of segments) {
    const record = { ...seg, bookId: 'quick-translate' };
    await saveSegment(record);
  }

  localStorage.setItem(QUICK_TRANSLATE_KEY, 'true');
}

export async function getQuickTranslateSession(): Promise<SegmentRecord[]> {
  const hasSession = localStorage.getItem(QUICK_TRANSLATE_KEY);
  if (!hasSession) return [];
  return getSegmentsByBook('quick-translate');
}

export async function clearQuickTranslateSession(): Promise<void> {
  const segments = await getSegmentsByBook('quick-translate');
  const db = await openDB();
  const transaction = db.transaction('translations', 'readwrite');
  const store = transaction.objectStore('translations');

  for (const seg of segments) {
    store.delete(seg.id);
  }
  localStorage.removeItem(QUICK_TRANSLATE_KEY);
}
