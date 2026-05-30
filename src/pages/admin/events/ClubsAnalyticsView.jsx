import React, { useState, useEffect, useMemo } from "react";
import { Upload, Trash2, Search, Download, Users, Trophy, CheckCircle2 } from "lucide-react";
import Card, { CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import ExportModal from "../../../components/ui/ExportModal";
import AttendanceStats from "../../../components/accreditation/AttendanceStats";
import AttendanceBadge from "../../../components/accreditation/AttendanceBadge";
import StatCard from "./StatCard";
import { useToast } from "../../../components/ui/Toast";
import { AccreditationsAPI } from "../../../lib/storage";
import { GlobalSettingsAPI } from "../../../lib/broadcastApi";
import { AttendanceAPI } from "../../../lib/attendanceApi";
import { generateClubExports } from "../../../lib/exportUtils";
import { extractTextFromPdf as parsePDFText } from "../../../lib/pdfParser";

const toProperCase = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
};

export default function ClubsAnalyticsView({ event }) {
  const [clubs, setClubs] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [event.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clubsData, accs, attendanceData] = await Promise.all([
        GlobalSettingsAPI.getClubs(event.id),
        AccreditationsAPI.getByEventId(event.id),
        AttendanceAPI.getEventAttendance(event.id)
      ]);
      
      setClubs(clubsData);
      const v2Raw = await GlobalSettingsAPI.get(`event_${event.id}_clubs_v2`);
      if (v2Raw) {
        const parsed = JSON.parse(v2Raw);
        if (parsed.metadata) setUploadedFile(parsed.metadata);
      }
      
      setAccreditations(accs || []);
      setAttendanceRecords(attendanceData || []);
    } catch (err) {
      console.error("Failed to load clubs analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setParsing(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        let clubNames = [];
        
        if (file.name.endsWith('.pdf')) {
          const text = await parsePDFText(file);
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          let headIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            const low = lines[i].toLowerCase();
            if (low.includes('registered') && (low.includes('club') || low.includes('team'))) {
              headIdx = i;
              break;
            }
          }

          const dataLines = headIdx !== -1 ? lines.slice(headIdx + 1) : lines;
          
          clubNames = dataLines.map(line => {
            const parts = line.split(/\s+/);
            if (parts.length < 3) return null;
            const firstPartIsNumber = /^\d+$/.test(parts[0]);
            const startIdx = firstPartIsNumber ? 1 : 0;
            const code = parts[startIdx];
            let countStr = "0";
            let nameEndIdx = parts.length - 1;
            for (let i = startIdx + 2; i < parts.length; i++) {
              if (/^\d+$/.test(parts[i])) {
                countStr = parts[i];
                nameEndIdx = i;
                break;
              }
            }
            const fullName = parts.slice(startIdx + 1, nameEndIdx).join(" ");
            if (!fullName || fullName.length < 2) return null;
            return {
              short: code,
              full: toProperCase(fullName),
              fileRegistered: parseInt(countStr) || 0
            };
          }).filter(Boolean);
        } else {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (!jsonData || jsonData.length === 0) {
            toast.error("File appears to be empty");
            setParsing(false);
            return;
          }

          let sIdx = 15, fIdx = 16, rIdx = 18;
          if (jsonData[0] && jsonData[0].length < 17) {
            const header = jsonData[0].map(h => String(h || "").toLowerCase());
            const foundIdx = header.findIndex(h => h.includes("club") || h.includes("team") || h.includes("academy"));
            if (foundIdx !== -1) {
              sIdx = foundIdx; fIdx = foundIdx; rIdx = -1;
            } else {
              sIdx = 0; fIdx = 0; rIdx = -1;
            }
          }

          clubNames = jsonData
            .map(row => {
              const fullRaw = row[fIdx] || row[0] || "";
              const full = String(fullRaw).trim(); 
              if (!full || full.length < 2) return null;
              let regCount = 0;
              if (rIdx !== -1) {
                regCount = parseInt(row[rIdx]) || parseInt(row[rIdx-1]) || parseInt(row[rIdx+1]) || 0;
              }
              return {
                short: String(row[sIdx] || row[0] || "").trim(),
                full: full,
                fileRegistered: regCount
              };
            })
            .filter(Boolean);
        }

        const uniqueClubs = [];
        const seen = new Set();
        for (const club of clubNames) {
          const key = club.full.trim(); 
          if (!seen.has(key)) {
            seen.add(key);
            uniqueClubs.push(club);
          }
        }
        uniqueClubs.sort((a, b) => a.full.localeCompare(b.full));
        
        if (uniqueClubs.length > 0) {
          const metadata = { name: file.name, timestamp: new Date().toISOString() };
          await GlobalSettingsAPI.setClubs(event.id, uniqueClubs, metadata);
          const duplicatesRemoved = clubNames.length - uniqueClubs.length;
          setClubs(uniqueClubs);
          setUploadedFile(metadata);
          if (duplicatesRemoved > 0) {
            toast.success(`Imported ${uniqueClubs.length} clubs (${duplicatesRemoved} duplicates merged)`);
          } else {
            toast.success(`Successfully imported ${uniqueClubs.length} clubs`);
          }
        } else {
          toast.error("No valid club entries detected. Please check file columns.");
        }
      } catch (err) {
        console.error("Clubs Import Error:", err);
        toast.error(`Import Error: ${err.message || "Failed to parse file"}`);
      } finally {
        setParsing(false);
      }
    };

    if (file.name.endsWith('.pdf')) {
      reader.onload();
    } else {
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const clearClubs = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmClearClubs = async () => {
    try {
      await GlobalSettingsAPI.setClubs(event.id, []);
      setClubs([]);
      setUploadedFile(null);
      setShowDeleteConfirm(false);
      toast.success("Clubs list cleared");
    } catch {
      toast.error("Failed to clear list");
    }
  };

  const analytics = useMemo(() => {
    if (!Array.isArray(clubs) || !Array.isArray(accreditations)) return [];

    const rawAnalytics = clubs.map((club, index) => {
      const clubFull = club?.full || (typeof club === 'string' ? club : "");
      const clubShort = club?.short || clubFull || "N/A";
      const clubNameStr = String(clubFull).trim();
      const clubTerm = clubNameStr.toLowerCase();
      const fileRegistered = club?.fileRegistered || 0;

      const clubAccs = accreditations.filter(a => {
        const c = String(a.club || "").trim().toLowerCase();
        return c === clubTerm;
      });
      
      const registeredAthletes = clubAccs.filter(a => String(a.role || "").toLowerCase().includes("athlete"));
      const approvedAthletes = registeredAthletes.filter(a => a.status === "approved");
      
      const clubAttendance = attendanceRecords.filter(record => 
        clubAccs.some(acc => acc.id === record.athlete_id)
      );
      
      const presentAthletesCount = clubAttendance.filter(record => {
        const acc = clubAccs.find(a => a.id === record.athlete_id);
        return acc && String(acc.role || "").toLowerCase().includes("athlete");
      }).length;

      const presentCoachesCount = clubAttendance.filter(record => {
        const acc = clubAccs.find(a => a.id === record.athlete_id);
        const role = String(acc?.role || "").toLowerCase();
        return acc && !role.includes("athlete");
      }).length;
      
      let latestTime = null;
      if (clubAttendance.length > 0) {
        const latestRecord = [...clubAttendance].sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date))[0];
        latestTime = new Date(latestRecord.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      return {
        sr: index + 1,
        short: clubShort,
        full: clubNameStr || "Unknown Club",
        registered: registeredAthletes.length,
        fileRegistered: fileRegistered,
        approved: approvedAthletes.length,
        approvedNames: approvedAthletes.map(a => `${a.firstName || ""} ${a.lastName || ""}`.trim()).join(", "),
        attendanceCount: clubAttendance.length,
        presentAthletes: presentAthletesCount,
        presentCoaches: presentCoachesCount,
        latestTime: latestTime
      };
    }).filter(r => r.full !== "Unknown Club");

    if (!searchTerm.trim()) return rawAnalytics;
    const term = searchTerm.toLowerCase();
    return rawAnalytics.filter(r => 
      String(r.full).toLowerCase().includes(term) || 
      String(r.short).toLowerCase().includes(term)
    );
  }, [clubs, accreditations, searchTerm]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(new Set(analytics.map(r => r.full)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (full, checked) => {
    const newSelected = new Set(selectedRows);
    if (checked) newSelected.add(full);
    else newSelected.delete(full);
    setSelectedRows(newSelected);
  };

  const executeExport = async (selectedClubObjects, format, setProgressMsg) => {
    try {
      const clubNames = selectedClubObjects.map(c => c.full);
      await generateClubExports(event.id, event.name, clubNames, format, setProgressMsg);
      toast.success("Files Archived and Downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile Export");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="p-8 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-main mb-2 tracking-tight">Club Analytics</h3>
              <p className="text-slate-400 font-light max-w-md">Real-time tracking of athlete registrations and approved accreditations per club.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {uploadedFile && (
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active List</span>
                    <span className="text-xs text-white font-mono truncate max-w-[150px]">{uploadedFile.name}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-800 mx-1" />
                  <div className="flex gap-1">
                    <button onClick={() => document.getElementById('club-import').click()} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all" title="Change File">
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={clearClubs} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete File">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search club..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-base-alt border border-border rounded-xl text-main text-lg placeholder:text-muted focus:outline-none focus:border-cyan-500/50 transition-all min-w-[240px]"
                />
              </div>
              <Button variant="secondary" icon={Download} onClick={() => setExportModalOpen(true)} disabled={analytics.length === 0}>Export Data</Button>
              {!uploadedFile && (
                <Button icon={parsing ? undefined : Upload} loading={parsing} onClick={() => document.getElementById('club-import').click()}>
                  Import Club List
                </Button>
              )}
              <input id="club-import" type="file" className="hidden" accept=".csv,.xlsx,.pdf" onChange={handleFileUpload} />
            </div>
          </div>

          <div className="px-6 pt-6">
            <AttendanceStats analytics={analytics} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800">
                  <th className="p-5 w-12 text-center">
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary-500 focus:ring-primary-500/50 focus:ring-offset-slate-950 transition-colors"
                        checked={analytics.length > 0 && selectedRows.size === analytics.length}
                        onChange={handleSelectAll}
                      />
                    </div>
                  </th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide">SR#</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide">Club / Academy</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide text-center">Registered Athletes</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide text-center">Accreditations Issued</th>
                  <th className="p-5 text-xs text-slate-400 font-semibold tracking-wide text-center">Live Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {analytics.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Users className="w-16 h-16 text-slate-500" />
                        <p className="text-xl font-light text-slate-500 italic">No clubs registered for this event yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  analytics.map((row) => (
                    <tr key={row.sr} className={`group border-b border-slate-800/30 transition-all ${selectedRows.has(row.full) ? 'bg-primary-500/5' : 'hover:bg-white/[0.02]'}`}>
                      <td className="p-5 text-center">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary-500 focus:ring-primary-500/50 focus:ring-offset-slate-950 transition-colors cursor-pointer"
                            checked={selectedRows.has(row.full)}
                            onChange={(e) => handleSelectRow(row.full, e.target.checked)}
                          />
                        </div>
                      </td>
                      <td className="p-5 text-muted font-mono text-xs">{String(row.sr).padStart(2, '0')}</td>
                      <td className="p-5">
                        <div className="flex flex-col cursor-pointer" onClick={() => handleSelectRow(row.full, !selectedRows.has(row.full))}>
                          <span className={`font-bold transition-colors tracking-tight ${selectedRows.has(row.full) ? 'text-primary-600 dark:text-primary-300' : 'text-main group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}>
                            {row.full}
                          </span>
                          <span className="text-[10px] text-muted font-mono mt-0.5">{row.short}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base text-muted text-xs font-bold border border-border">
                            {row.fileRegistered} REGISTERED
                          </span>
                          {row.registered > 0 && (
                            <span className="text-[10px] text-muted font-medium uppercase italic">
                              Live: {row.registered}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black tracking-widest ${
                          row.approved > 0 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-slate-800/30 text-slate-600 border border-slate-800"
                        }`}>
                          {row.approved} APPROVED
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <AttendanceBadge 
                          athletesCount={row.presentAthletes}
                          coachesCount={row.presentCoaches}
                          time={row.latestTime} 
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {analytics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Clubs" value={analytics.length} icon={Users} color="from-blue-500 to-cyan-500" />
          <StatCard 
            label="Total Registered Athletes" 
            value={analytics.reduce((sum, r) => sum + r.fileRegistered, 0)} 
            icon={Trophy} 
            color="from-primary-500 to-purple-500" 
          />
          <StatCard 
            label="Total Accreditations Issued" 
            value={analytics.reduce((sum, r) => sum + r.approved, 0)} 
            icon={CheckCircle2} 
            color="from-emerald-500 to-teal-500" 
          />
        </div>
      )}

      {exportModalOpen && (
        <ExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          clubs={clubs.filter(c => selectedRows.size === 0 || selectedRows.has(c.full || c))}
          initialSelectedClubs={Array.from(selectedRows)}
          onExport={executeExport}
        />
      )}
    </div>
  );
}
