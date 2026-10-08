// ==========================================
// INDEXEDDB OFFLINE KUYRUK YÖNETİCİSİ
// ==========================================

export interface PendingUpload {
  id: string;
  roomId: string;
  fileBlob: Blob;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploaderTag: string;
  deviceModel?: string;
  takenAt: string;
  createdAt: number;
}

const DB_NAME = 'SnapRoomOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB desteklenmiyor'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addOfflineUpload(item: PendingUpload): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Offline kayıt hatası:', err);
  }
}

export async function getOfflineUploads(roomId?: string): Promise<PendingUpload[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all: PendingUpload[] = req.result || [];
        if (roomId) {
          resolve(all.filter((item) => item.roomId === roomId));
        } else {
          resolve(all);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Offline okuma hatası:', err);
    return [];
  }
}

export async function removeOfflineUpload(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Offline silme hatası:', err);
  }
}
