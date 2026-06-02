import React, { useState, useEffect } from "react";
import { LogOut, MapPin, Settings2, DownloadCloud, Wifi, WifiOff, Loader2 } from "lucide-react";
import { syncService } from "../../lib/syncService";
import { OfflineDB } from "../../lib/offlineDb";
import { supabase } from "../../lib/supabase";

export default function StaffSettings() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState({ syncing: false, count: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);

  useEffect(() => {
    // Network listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync listeners
    const unsubscribe = syncService.subscribe((status) => {
      setSyncState(prev => ({ ...prev, ...status }));
    });

    // Initial check
    OfflineDB.getPendingScans().then(scans => {
      setSyncState(prev => ({ ...prev, count: scans.length }));
    });
    OfflineDB.getAccreditationCount().then(setCachedCount);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  const handleDownloadData = async () => {
    if (!navigator.onLine) {
      alert("You must be online to download offline data.");
      return;
    }

    try {
      setIsDownloading(true);
      // Fetch all accreditations (in a real app, filter by active event)
      const { data, error } = await supabase
        .from('accreditations')
        .select('id, first_name, last_name, status, role');
      
      if (error) throw error;
      
      await OfflineDB.cacheAccreditations(data || []);
      setCachedCount((data || []).length);
      alert("Offline data downloaded successfully! You can now scan without internet.");
    } catch (err) {
      console.error(err);
      alert("Failed to download offline data.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/";
  };

  return (
    <div className="p-6 space-y-8 h-full pb-32 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
          Settings
        </h2>
        <p className="text-slate-400 font-medium text-sm">
          Configure your operational profile.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest pl-2">Current Zone</h3>
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-2xl">
              <MapPin className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Main Gate 1</p>
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-wider">Active</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-colors">
            Change
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest pl-2">Offline Mode</h3>
        
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${isOnline ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{isOnline ? 'Online' : 'Offline'}</p>
                <p className="text-slate-400 text-xs font-medium">
                  {syncState.count > 0 
                    ? `${syncState.count} scans pending sync`
                    : "All data synced"}
                </p>
              </div>
            </div>
            {syncState.syncing && (
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            )}
          </div>

          <div className="h-px w-full bg-white/5" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Cached Accreditations</p>
              <p className="text-xs text-slate-400">{cachedCount} records saved locally</p>
            </div>
            <button 
              onClick={handleDownloadData}
              disabled={isDownloading || !isOnline}
              className="px-4 py-2 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest pl-2">Account</h3>
        
        <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-white/70" />
            </div>
            <span className="text-white font-bold">Preferences</span>
          </div>
        </button>

        <button 
          onClick={handleLogout}
          className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-red-400 font-bold">Sign Out</span>
          </div>
        </button>
      </div>
    </div>
  );
}
