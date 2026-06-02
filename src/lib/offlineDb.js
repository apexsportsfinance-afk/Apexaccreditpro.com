const DB_NAME = "ApexOfflineDB";
const DB_VERSION = 2;

const STORES = {
  ACCREDITATIONS: "accreditations",
  PENDING_SCANS: "pending_scans",
};

/**
 * Initializes the IndexedDB database.
 */
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("[OfflineDB] Database error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for Accreditations (Key: id)
      if (!db.objectStoreNames.contains(STORES.ACCREDITATIONS)) {
        const accStore = db.createObjectStore(STORES.ACCREDITATIONS, { keyPath: "id" });
        accStore.createIndex("accreditation_id", "accreditation_id", { unique: true });
      }

      // Store for Pending Scans (Key: auto-incrementing ID)
      if (!db.objectStoreNames.contains(STORES.PENDING_SCANS)) {
        const scanStore = db.createObjectStore(STORES.PENDING_SCANS, { 
          keyPath: "local_id", 
          autoIncrement: true 
        });
        scanStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
};

/**
 * Accreditations API
 */
export const OfflineDB = {
  /**
   * Replaces the local cache of accreditations with a new set.
   */
  cacheAccreditations: async (accreditations) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ACCREDITATIONS], "readwrite");
      const store = transaction.objectStore(STORES.ACCREDITATIONS);

      // Clear existing first
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        accreditations.forEach(acc => {
          store.put(acc); // Using put which inserts or updates
        });
      };

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Retrieves a specific accreditation by ID or accreditation_id.
   */
  getAccreditation: async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ACCREDITATIONS], "readonly");
      const store = transaction.objectStore(STORES.ACCREDITATIONS);
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let request;
      if (isUUID) {
        request = store.get(id);
      } else {
        const index = store.index("accreditation_id");
        request = index.get(id);
      }

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Gets the total count of cached accreditations.
   */
  getAccreditationCount: async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ACCREDITATIONS], "readonly");
      const store = transaction.objectStore(STORES.ACCREDITATIONS);
      const request = store.count();

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Pending Scans API
   */
  
  /**
   * Saves a scan performed offline to the queue.
   */
  savePendingScan: async (scanData) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_SCANS], "readwrite");
      const store = transaction.objectStore(STORES.PENDING_SCANS);
      
      const payload = {
        ...scanData,
        timestamp: new Date().toISOString()
      };

      const request = store.add(payload);

      request.onsuccess = (event) => resolve(event.target.result); // Returns local_id
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Retrieves all pending scans.
   */
  getPendingScans: async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_SCANS], "readonly");
      const store = transaction.objectStore(STORES.PENDING_SCANS);
      const request = store.getAll();

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Removes a pending scan after successful sync.
   */
  removePendingScan: async (localId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_SCANS], "readwrite");
      const store = transaction.objectStore(STORES.PENDING_SCANS);
      const request = store.delete(localId);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }
};
