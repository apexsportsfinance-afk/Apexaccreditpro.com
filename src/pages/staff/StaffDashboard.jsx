import React, { useState, useEffect } from "react";
import { Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";

// Relative "x ago" label. Date.now() is fine here (regular app code).
function timeAgo(ts) {
  if (!ts) return "";
  const mins = Math.max(0, (Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const isDenied = (mode) => /deny|denied|reject|fail/i.test(mode || "");

export default function StaffDashboard() {
  const [stats, setStats] = useState({ totalScans: 0, approved: 0, denied: 0 });
  const [recent, setRecent] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Today's scans. unified_scan_logs.event_id means RLS scopes this to the
      // user's own events automatically — a client sees only theirs (0 until they
      // run events), Apex staff see Apex's. No mock data.
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("unified_scan_logs")
        .select("id, scan_mode, created_at, accreditations:athlete_id (first_name, last_name, badge_number)")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      const rows = error ? [] : (data || []);
      const denied = rows.filter((r) => isDenied(r.scan_mode)).length;
      setStats({ totalScans: rows.length, approved: rows.length - denied, denied });
      setRecent(rows.slice(0, 5));
      setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
          Operations
        </h2>
        <p className="text-slate-400 font-medium">
          Real-time metrics for your sector.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-start col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Users className="w-24 h-24 text-white" />
          </div>
          <div className="p-3 bg-blue-500/20 rounded-2xl mb-4">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-1">
            Total Scans Today
          </p>
          <p className="text-5xl font-black text-white tracking-tighter">
            {stats.totalScans}
          </p>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 flex flex-col">
          <div className="p-2 bg-emerald-500/20 rounded-xl mb-3 w-max">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-1">
            Approved
          </p>
          <p className="text-3xl font-black text-emerald-400 tracking-tighter">
            {stats.approved}
          </p>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 flex flex-col">
          <div className="p-2 bg-red-500/20 rounded-xl mb-3 w-max">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest mb-1">
            Denied
          </p>
          <p className="text-3xl font-black text-red-400 tracking-tighter">
            {stats.denied}
          </p>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-white/10">
        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Recent Activity</h3>
        {loaded && recent.length === 0 ? (
          <p className="text-white/30 text-sm font-medium">No scans yet today.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((r) => {
              const a = r.accreditations;
              const name = a
                ? (`${a.first_name || ""} ${a.last_name || ""}`.trim() || `#${a.badge_number || ""}`)
                : "Scan";
              const denied = isDenied(r.scan_mode);
              return (
                <div key={r.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${denied ? "bg-red-500" : "bg-emerald-500"}`} />
                    <div>
                      <p className="text-sm font-bold text-white uppercase">{name}</p>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                        {(r.scan_mode || "scan").replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-white/30">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{timeAgo(r.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
