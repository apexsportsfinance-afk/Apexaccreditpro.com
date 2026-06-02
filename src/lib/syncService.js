import { OfflineDB } from "./offlineDb";
import { AttendanceAPI } from "./attendanceApi";

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = [];
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach(cb => cb(status));
  }

  /**
   * Starts the automatic background sync loop when online
   */
  start() {
    window.addEventListener("online", this.triggerSync.bind(this));
    // Also try syncing periodically just in case
    this.syncInterval = setInterval(this.triggerSync.bind(this), 60000); // Every minute
    
    // Initial check
    if (navigator.onLine) {
      this.triggerSync();
    }
  }

  stop() {
    window.removeEventListener("online", this.triggerSync.bind(this));
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  /**
   * Triggers the sync process manually or automatically
   */
  async triggerSync() {
    if (this.isSyncing || !navigator.onLine) return;

    try {
      this.isSyncing = true;
      this.notifyListeners({ syncing: true });

      const pendingScans = await OfflineDB.getPendingScans();
      
      if (pendingScans.length === 0) {
        this.isSyncing = false;
        this.notifyListeners({ syncing: false, count: 0 });
        return;
      }

      console.log(`[SyncService] Starting sync for ${pendingScans.length} scans...`);

      let successCount = 0;
      let failCount = 0;

      for (const scan of pendingScans) {
        try {
          // Push to Supabase via AttendanceAPI
          const result = await AttendanceAPI.recordScan({
            eventId: scan.eventId,
            athleteId: scan.athleteId,
            clubName: scan.clubName,
            scannerLocation: scan.scannerLocation,
            sessionId: scan.sessionId,
            zoneOnly: scan.zoneOnly,
            scanMode: scan.scanMode,
            ignoreDuplicates: scan.ignoreDuplicates
          });

          // Even if it returns "Already Attended", the request succeeded
          if (result && result.status !== "error") {
            await OfflineDB.removePendingScan(scan.local_id);
            successCount++;
          } else {
            failCount++;
            console.error("[SyncService] Failed to sync scan:", scan, result);
          }
        } catch (err) {
          failCount++;
          console.error("[SyncService] Network/API error syncing scan:", err);
          // Stop syncing the rest if we hit a network error
          if (!navigator.onLine) break;
        }
      }

      console.log(`[SyncService] Sync complete. Success: ${successCount}, Failed: ${failCount}`);
      
      // Update count
      const remaining = await OfflineDB.getPendingScans();
      this.notifyListeners({ syncing: false, count: remaining.length });

    } catch (err) {
      console.error("[SyncService] Critical failure during sync:", err);
      this.notifyListeners({ syncing: false, error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();
