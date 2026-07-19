/**
 * IndexedDB storage for user-uploaded photos and deck configuration.
 * Everything lives on-device so the app works fully offline as a PWA.
 */
const DobbleStorage = (() => {
    const DB_NAME = 'dobble-pwa';
    const DB_VERSION = 1;
    const PHOTOS_STORE = 'photos';
    const META_STORE = 'meta';

    let dbPromise = null;

    function openDB() {
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

    async function tx(storeName, mode) {
        const db = await openDB();
        return db.transaction(storeName, mode).objectStore(storeName);
    }

    /**
     * Downscales an image file to keep IndexedDB storage compact,
     * returning a JPEG blob capped at maxDim on the longest side.
     */
    async function downscaleImage(file, maxDim = 900, quality = 0.85) {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close && bitmap.close();

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        return blob;
    }

    async function addPhoto(file) {
        const blob = await downscaleImage(file);
        const store = await tx(PHOTOS_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.add({ blob, name: file.name || 'photo', addedAt: Date.now() });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllPhotos() {
        const store = await tx(PHOTOS_STORE, 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deletePhoto(id) {
        const store = await tx(PHOTOS_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function clearPhotos() {
        const store = await tx(PHOTOS_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function setMeta(key, value) {
        const store = await tx(META_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function getMeta(key) {
        const store = await tx(META_STORE, 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
            req.onerror = () => reject(req.error);
        });
    }

    async function clearAll() {
        await clearPhotos();
        const store = await tx(META_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    return {
        addPhoto,
        getAllPhotos,
        deletePhoto,
        clearPhotos,
        setMeta,
        getMeta,
        clearAll,
    };
})();
