/**
 * IndexedDB storage for user-uploaded photos and deck configuration.
 * Everything lives on-device so the app works fully offline as a PWA.
 */
import type { DeckConfig, Photo } from './types.ts';

const DB_NAME = 'dobble-pwa';
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';
const META_STORE = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        db.createObjectStore(PHOTOS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

/**
 * Downscales an image file to keep IndexedDB storage compact,
 * returning a JPEG blob capped at maxDim on the longest side.
 */
async function downscaleImage(file: File, maxDim = 900, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Failed to encode image');
  return blob;
}

export async function addPhoto(file: File): Promise<number> {
  const blob = await downscaleImage(file);
  const store = await tx(PHOTOS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add({ blob, name: file.name || 'photo', addedAt: Date.now() });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPhotos(): Promise<Photo[]> {
  const store = await tx(PHOTOS_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as Photo[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id: number): Promise<void> {
  const store = await tx(PHOTOS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearPhotos(): Promise<void> {
  const store = await tx(PHOTOS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key: 'config', value: DeckConfig): Promise<void> {
  const store = await tx(META_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta(key: 'config'): Promise<DeckConfig | undefined> {
  const store = await tx(META_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as DeckConfig) : undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAll(): Promise<void> {
  await clearPhotos();
  const store = await tx(META_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
