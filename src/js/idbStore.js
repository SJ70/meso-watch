// Minimal IndexedDB helpers for user-uploaded files (registered alarm sounds,
// background images) - too big for localStorage. Each database holds a
// single object store keyed by "id".

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(dbName, storeName) {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
  return requestResult(request);
}

// Runs action(store) - which returns an IDBRequest - in one transaction and
// resolves with the request's result once the transaction has committed.
export async function withStore(dbName, storeName, mode, action) {
  const db = await openDatabase(dbName, storeName);
  try {
    const transaction = db.transaction(storeName, mode);
    const done = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const result = await requestResult(action(transaction.objectStore(storeName)));
    await done;
    return result;
  } finally {
    db.close();
  }
}

// Ids for uploaded files: prefix + a timestamp/random suffix.
export function createAssetId(prefix) {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Display name from an uploaded file's name: extension dropped, trimmed,
// capped, with a fallback for an empty result.
export function assetLabelFromFile(file, fallback, maxLength = 30) {
  return file.name.replace(/\.[^.]+$/, "").trim().slice(0, maxLength) || fallback;
}
