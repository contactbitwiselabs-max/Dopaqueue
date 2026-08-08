/**
 * DopaQueue IndexedDB Blob Store
 * Stores large binary content (screenshots, article text, image blobs)
 * in IndexedDB to avoid hitting chrome.storage.local's 10 MB quota.
 *
 * Each QueueItem can reference a blob via its `blobId` field.
 * Blobs are stored in the `dopaqueue_blobs` IndexedDB database.
 */

// @ts-nocheck

const DB_NAME = 'dopaqueue_blobs';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

export type BlobType = 'screenshot' | 'article' | 'image';

export interface BlobEntry {
  id: string;
  itemId: string;
  type: BlobType;
  data: string;       // base64 data URL or plain text
  mimeType?: string;
  createdAt: number;
  sizeBytes?: number;
}

let _db: IDBDatabase | null = null;

/** Opens (and creates if needed) the blob store database. */
async function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('itemId', 'itemId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      _db = (event.target as IDBOpenDBRequest).result;
      _db.onversionchange = () => {
        _db?.close();
        _db = null;
      };
      resolve(_db);
    };

    req.onerror = (event) => {
      console.error('[DopaQueue] IndexedDB open failed:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/**
 * Compress a data URL to JPEG (used for screenshots).
 * Runs only if OffscreenCanvas is available (Chrome service worker, popup).
 */
export async function compressDataUrl(
  dataUrl: string,
  quality = 0.80,
  maxWidthPx = 1200
): Promise<string> {
  try {
    // Attempt OffscreenCanvas (available in service workers + popups)
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const scale = Math.min(1, maxWidthPx / bitmap.width);
    const w = Math.floor(bitmap.width * scale);
    const h = Math.floor(bitmap.height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx!.drawImage(bitmap, 0, 0, w, h);
    const compressed = await canvas.convertToBlob({ type: 'image/jpeg', quality });

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(compressed);
    });
  } catch {
    // Fallback — return as-is (e.g. Firefox where OffscreenCanvas may behave differently)
    return dataUrl;
  }
}

/** Save a blob (data URL, plain text, or Blob object) and return the generated blobId. */
export async function saveBlob(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any
): Promise<string> {
  const db = await openDB();
  const id = `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  let itemId = '';
  let type: BlobType = 'screenshot';
  let dataStr = '';
  let mimeType: string | undefined = undefined;

  if (arg1 instanceof Blob || (typeof arg1 === 'string' && (arg1.startsWith('data:') || arg1.length > 300))) {
    // Called as: saveBlob(blobOrDataUrl, mimeType?, type?, itemId?)
    if (arg1 instanceof Blob) {
      mimeType = (arg2 as string) || arg1.type || 'image/jpeg';
      dataStr = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(arg1);
      });
    } else {
      dataStr = arg1;
      mimeType = (arg2 as string) || 'image/jpeg';
    }
    type = (arg3 as BlobType) || 'screenshot';
    itemId = arg4 || '';
  } else {
    // Called as: saveBlob(itemId, type, data, mimeType?)
    itemId = (arg1 as string) || '';
    type = (arg2 as BlobType) || 'screenshot';
    dataStr = arg3 || '';
    mimeType = arg4;
  }

  const entry: BlobEntry = {
    id,
    itemId,
    type,
    data: dataStr,
    mimeType,
    createdAt: Date.now(),
    sizeBytes: dataStr ? dataStr.length : 0,
  };

  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const req = store.put(entry);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve a blob by its ID. */
export async function getBlob(blobId: string): Promise<BlobEntry | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.get(blobId);
    req.onsuccess = () => resolve((req.result as BlobEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a blob by its ID. */
export async function deleteBlob(blobId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const req = store.delete(blobId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Get all blobs associated with a queue item. */
export async function getBlobsForItem(itemId: string): Promise<BlobEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const index = store.index('itemId');
    const req = index.getAll(itemId);
    req.onsuccess = () => resolve((req.result as BlobEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Get all blobs (for export). */
export async function getAllBlobs(): Promise<BlobEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as BlobEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Delete all blobs for an item (e.g. when the item is hard-deleted). */
export async function deleteBlobsForItem(itemId: string): Promise<void> {
  const blobs = await getBlobsForItem(itemId);
  await Promise.all(blobs.map((b) => deleteBlob(b.id)));
}

/** Get approximate total blob storage usage in bytes. */
export async function getBlobStoreSize(): Promise<number> {
  const blobs = await getAllBlobs();
  return blobs.reduce((sum, b) => sum + (b.sizeBytes ?? 0), 0);
}
