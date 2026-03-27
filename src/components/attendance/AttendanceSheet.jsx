import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Download, Users, CheckCircle, XCircle, Loader2, Calendar, Activity, RefreshCw, Layers, ShieldCheck, Zap, Clock, MoreHorizontal, FileText, ChevronRight, Filter, ArrowLeft, Tag, Trophy, Building2, UserMinus, UserPlus } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import DataTable from '../ui/DataTable';
import { AccreditationsAPI } from '../../lib/storage';
import { AttendanceAPI } from '../../lib/attendanceApi';
import SessionManager from './SessionManager';
import * as XLSX from 'xlsx';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

// Premium High-Luminance Attendance Gauge
const AttendanceStatusGauge = ({ current, total, role }) => {
  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const isCoach = role?.toLowerCase().includes('coach');
  
  // TRUE LUSH GREEN (#10b981) for all participation levels
  const barColor = percentage >= 100 ? "bg-emerald-600 shadow-[0_0_12px_rgba(5,150,105,0.5)]" : "bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]";

  return (
    <div className="w-full space-y-2 py-1">
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${percentage >= 100 ? "text-emerald-400" : "text-slate-500"}`}>
          {isCoach ? 'ENGAGEMENT' : 'PARTICIPATION'}
        </span>
        <div className="flex items-center gap-1 bg-slate-900 border border-white/5 px-2 py-0.5 rounded-sm shadow-inner">
          <span className="text-[11px] font-black text-white tabular-nums">{current}</span>
          <span className="text-[9px] text-slate-600 font-bold">/</span>
          <span className="text-[11px] font-black text-slate-400 tabular-nums">{total}</span>
        </div>
      </div>
      <div className="h-2.5 w-full bg-slate-800/80 rounded-full overflow-hidden border border-white/5 relative shadow-sm">
        <div 
          className={`h-full ${barColor} transition-all duration-1000 ease-out relative z-10 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.4)_50%)] bg-[length:6px_6px] z-20" />
      </div>
    </div>
  );
};

export default function AttendanceSheet({ event, onBack }) {
  const [accreditations, setAccreditations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState([]); 
  const [athleteEventData, setAthleteEventData] = useState([]);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState([]); 
  
  // Tactical Administrative Filters
  const [statusFilter, setStatusFilter] = useState("all"); 
  const [eventFilter, setEventFilter] = useState(""); 
  const [clubFilter, setClubFilter] = useState("all"); 

  const toast = useToast();

  const loadData = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        AccreditationsAPI.getByEventId(event.id),
        AttendanceAPI.getAttendanceForEvent(event.id, targetDate),
        AttendanceAPI.getSessions(event.id), 
        supabase.from('athlete_events').select('*, accreditations!inner(event_id)').eq('accreditations.event_id', event.id).eq("matched", true),
        AttendanceAPI.getEventAttendance(event.id) 
      ]);

      const accs = results[0].status === 'fulfilled' ? results[0].value : [];
      const checks = results[1].status === 'fulfilled' ? results[1].value : [];
      const allSessions = results[2].status === 'fulfilled' ? results[2].value : [];
      const history = results[4].status === 'fulfilled' ? results[4].value : [];

      let athleteMatches = [];
      if (accs.length > 0) {
        const accIds = accs.map(a => a.id);
        const CHUNK_SIZE = 500;
        const aePromises = [];
        for (let i = 0; i < accIds.length; i += CHUNK_SIZE) {
          const chunk = accIds.slice(i, i + CHUNK_SIZE);
          aePromises.push(supabase.from('athlete_events').select('*').in('accreditation_id', chunk).eq("matched", true));
        }
        const aeResults = await Promise.all(aePromises);
        athleteMatches = aeResults.flatMap(res => res.data || []);
      }

      setAccreditations(accs || []);
      setAttendanceRecords(checks || []);
      setSessions(allSessions || []);
      setAthleteEventData(athleteMatches);
      setAllAttendanceRecords(history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [event?.id, targetDate]);

  useEffect(() => {
    if (event?.id) loadData();
  }, [loadData, event?.id]);

  const handleToggleAttendance = async (athlete) => {
    try {
      if (athlete.scanStatus === "Present") {
        const res = await AttendanceAPI.unmarkAttendance(event.id, athlete.id, targetDate);
        if (res.status === "error") {
          toast.error("Database Refusal: " + res.message);
        } else {
          toast.success("Daily Record Purged");
        }
      } else {
        const res = await AttendanceAPI.recordScan({
          eventId: event.id,
          athleteId: athlete.id,
          clubName: athlete.club,
          date: targetDate, 
          scannerLocation: "Registry Management Node"
        });
        if (res.status === "error") {
          toast.error("Check-In Failed: " + res.message);
        } else {
          toast.success("Check-In Verified");
        }
      }
      loadData();
    } catch (err) { 
      toast.error("Operation Aborted");
      console.error(err);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return "-";
    const birthDate = new Date(dob);
    if (isNaN(birthDate)) return "-";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const combinedData = useMemo(() => {
    let eventDays = 1;
    if (event?.startDate && event?.endDate) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      eventDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    const TEAM_ROLES = [
      'athlete', 'coach', 'head coach', 'team coach', 
      'team manager', 'team admin', 'team official', 
      'team doctor', 'team physiotherapist', 'technical director'
    ];

    const filteredAccs = accreditations.filter(a => {
      const role = (a.role || '').toLowerCase().trim();
      const status = (a.status || '').toLowerCase().trim();
      if (status !== 'approved') return false;
      return TEAM_ROLES.some(tr => role === tr || role.includes(tr));
    });

    const currentAttendanceMap = new Map();
    attendanceRecords.forEach(r => currentAttendanceMap.set(r.athlete_id, r));

    return filteredAccs.map((person, idx) => {
      const record = currentAttendanceMap.get(person.id);
      const matchedEvents = athleteEventData.filter(e => e.accreditation_id === person.id);
      const history = allAttendanceRecords.filter(r => r.athlete_id === person.id);
      const isCoach = (person.role || "").toLowerCase().includes("coach");
      
      let numerator = 0;
      let denominator = 0;
      let uiEvents = [];

      if (isCoach) {
        numerator = new Set(history.map(r => r.check_in_date)).size;
        denominator = eventDays;
        uiEvents = [{ label: "FULL EVENT" }];
      } else {
        // ATHLETE DEDUPLICATION STRATEGY
        // 1. Get all session codes that exist manually or automatically
        const manualGeneralSessions = sessions.filter(s => !s.event_number);
        
        // 2. Scheduled Events from Heat Sheet
        const athleteUniqueEventCodes = Array.from(new Set(matchedEvents.map(e => String(e.event_code))));
        
        // 3. Construct unified Requirement List
        // Rule: Match Scheduled with Sessions if they share code. General sessions are unique.
        const requirements = new Set();
        athleteUniqueEventCodes.forEach(code => requirements.add(`EVENT_${code}`));
        manualGeneralSessions.forEach(s => requirements.add(`SESSION_${s.id}`));
        
        denominator = requirements.size || (athleteUniqueEventCodes.length > 0 ? athleteUniqueEventCodes.length : 1);
        
        // Numerator = Scans (Total)
        numerator = history.length;
        if (numerator > denominator) numerator = denominator;

        // UI Representation: Combine Heats with General Sessions
        uiEvents = [
          ...matchedEvents.map(e => ({ type: 'event', code: e.event_code, heat: e.heat, lane: e.lane })),
          ...manualGeneralSessions.map(s => ({ type: 'session', label: s.session_name || 'General' }))
        ];
      }

      return {
        ...person,
        index: idx + 1,
        fullName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
        scanStatus: record ? "Present" : "Absent",
        checkInTime: record ? new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "-",
        events: uiEvents,
        age: calculateAge(person.dob || person.dateOfBirth),
        attendanceCount: numerator,
        attendanceTotal: denominator
      };
    });
  }, [accreditations, attendanceRecords, athleteEventData, event, sessions, allAttendanceRecords]);

  const uniqueClubs = useMemo(() => {
    const clubs = new Set(combinedData.map(d => d.club || 'UNA').filter(Boolean));
    return Array.from(clubs).sort();
  }, [combinedData]);

  const filteredData = useMemo(() => {
    let data = combinedData;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      data = data.filter(a => a.fullName.toLowerCase().includes(s) || (a.club && a.club.toLowerCase().includes(s)));
    }
    if (statusFilter !== "all") {
      data = data.filter(a => a.scanStatus.toLowerCase() === statusFilter);
    }
    if (eventFilter) {
      data = data.filter(a => a.events?.some(e => String(e.code || e.label).includes(eventFilter)));
    }
    if (clubFilter !== "all") {
      data = data.filter(a => (a.club || 'UNA') === clubFilter);
    }
    return data.map((d, i) => ({ ...d, srNo: i + 1 }));
  }, [combinedData, searchTerm, statusFilter, eventFilter, clubFilter]);

  const totalInView = filteredData.length;
  const presentInView = filteredData.filter(a => a.scanStatus === "Present").length;
  const absentInView = totalInView - presentInView;

  const columns = [
    { 
      header: "SR#", 
      key: "srNo",
      className: "w-12 text-center text-slate-500 font-bold",
      render: (row) => <span className="text-[10px] tabular-nums font-black">{row.srNo}</span>
    },
    { 
      header: "ATHLETE NAME", 
      key: "fullName",
      className: "min-w-[200px] px-4",
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/5 overflow-hidden ring-1 ring-white/10 shadow-lg group">
            {row.photoUrl ? <img src={row.photoUrl} className="w-full h-full object-cover" alt="" /> : <Users className="w-4 h-4 text-slate-500 m-auto mt-2" />}
          </div>
          <span className="font-semibold text-slate-100 uppercase text-[12px] tracking-tight">{row.fullName}</span>
        </div>
      )
    },
    { 
      header: "CLUB NAME", 
      key: "club",
      className: "min-w-[150px] px-4",
      render: (row) => <span className="text-[11px] text-slate-400 font-black uppercase tracking-tight">{row.club || 'UNA'}</span>
    },
    { 
      header: "CATEGORY", 
      key: "role",
      className: "w-24 px-2 text-center",
      render: (row) => {
        const role = (row.role || "").toLowerCase();
        let roleStyles = "bg-slate-800/50 text-slate-400";
        if (role.includes("coach")) roleStyles = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
        if (role.includes("athlete")) roleStyles = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        return (
          <div className={`px-2 py-0.5 border ${roleStyles} text-[9px] font-black uppercase tracking-tight rounded-sm`}>
            {row.role || 'Athlete'}
          </div>
        );
      }
    },
    { 
      header: "Scheduled Events", 
      key: "events",
      className: "min-w-[220px] px-4",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5 py-1">
          {row.events?.length > 0 ? (
            row.events.map((e, idx) => (
              <div key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-sm text-[10px] font-bold shadow-sm ${e.type === 'event' ? 'bg-[#0d1321] border-white/5' : 'bg-amber-500/10 border-amber-500/20'}`}>
                {e.type === 'event' ? (
                  <>
                    <span className="text-slate-100 font-black">{e.code}</span>
                    <span className="text-cyan-500/40 font-black text-[8px] mx-0.5">|</span>
                    <span className="text-slate-400 uppercase text-[9px]">H:{e.heat} L:{e.lane}</span>
                  </>
                ) : (
                  <span className="text-amber-500 uppercase text-[9px] font-black">{e.label}</span>
                )}
              </div>
            ))
          ) : (
            <span className="text-[9px] text-[#64748b] bg-slate-900/50 px-2 py-0.5 rounded-sm uppercase font-black tracking-tight">Standby Registry</span>
          )}
        </div>
      )
    },
    { 
      header: "STATUS", 
      key: "status",
      className: "min-w-[150px] px-6",
      render: (row) => (
        <AttendanceStatusGauge current={row.attendanceCount} total={row.attendanceTotal} role={row.role} />
      )
    },
    { 
      header: "ATTENDANCE TIME", 
      key: "checkInTime",
      className: "w-32 text-center px-4",
      render: (row) => (row.scanStatus === "Present" ? (
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-mono font-black tracking-tighter text-white">{row.checkInTime}</span>
          <span className="text-[8px] text-emerald-500/60 font-black uppercase tracking-[0.1em] mt-0.5">Verified</span>
        </div>
      ) : (
        <span className="text-[11px] font-mono font-black tracking-tighter text-slate-800">00:00:00</span>
      ))
    },
    {
      header: "ACTION",
      key: "action",
      className: "w-20 text-center",
      render: (row) => (
        <button onClick={() => handleToggleAttendance(row)} className="group p-2 hover:bg-slate-800 rounded-sm transition-all border border-transparent hover:border-slate-700 active:scale-90 shadow-lg">
          {row.scanStatus === "Present" ? <XCircle className="w-4 h-4 text-rose-500 group-hover:text-rose-400" /> : <CheckCircle className="w-4 h-4 text-emerald-500 group-hover:text-emerald-400" />}
        </button>
      )
    }
  ];

  return (
    <div className="w-full mx-auto bg-[#020617] min-h-screen text-slate-100 font-sans p-6 space-y-8">
      {/* 1. Header Row */}
      <div className="flex items-center gap-4 px-2">
        <button className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all shadow-inner" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[20px] font-black tracking-tighter uppercase leading-none text-white">Event Attendance</h1>
          <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase mt-1">Registry Command / Node 02</p>
        </div>
      </div>

      {/* 2. Session Manager (Global Date Control) */}
      <div className="px-2">
        <SessionManager eventId={event.id} targetDate={targetDate} onRefresh={loadData} onDateChange={setTargetDate} />
      </div>

      {/* 3. Summary Intelligence Tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
        <div className="bg-[#0a0f1a] border border-white/5 p-6 rounded-sm shadow-inner flex items-center justify-between relative overflow-hidden group">
          <div>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Total Team Personnel</p>
            <p className="text-[22px] font-black text-white leading-none tracking-tight tabular-nums">{totalInView || 0}</p>
          </div>
          <Users className="w-6 h-6 text-slate-700 opacity-20 absolute right-6 group-hover:scale-110 transition-transform" />
        </div>
        <div className="bg-[#022c22]/10 border border-emerald-500/10 p-6 rounded-sm shadow-inner flex items-center justify-between relative overflow-hidden">
          <div>
            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-[0.2em] mb-1">Present Today</p>
            <p className="text-[22px] font-black text-emerald-400 leading-none tracking-tight tabular-nums">{presentInView || 0}</p>
          </div>
          <CheckCircle className="w-6 h-6 text-emerald-900 opacity-40 absolute right-6" />
        </div>
        <div className="bg-[#450a0a]/10 border border-rose-500/10 p-6 rounded-sm shadow-inner flex items-center justify-between relative overflow-hidden">
          <div>
            <p className="text-[9px] text-rose-500 font-black uppercase tracking-[0.2em] mb-1">Absent Today</p>
            <p className="text-[22px] font-black text-rose-400 leading-none tracking-tight tabular-nums">{absentInView || 0}</p>
          </div>
          <XCircle className="w-6 h-6 text-rose-900 opacity-40 absolute right-6" />
        </div>
      </div>

      {/* 4. Active Registry Console */}
      <Card className="bg-[#040813] border border-slate-800/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden mx-2">
        
        {/* CONTROL DECK: Search & Date Selection */}
        <div className="p-5 border-b border-slate-800 bg-[#0a0f1a] flex flex-col md:flex-row md:items-center justify-between px-6 gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
              <input
                type="text"
                placeholder="Search registry..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-80 bg-[#020617] border border-slate-800 rounded-sm h-10 pl-10 pr-4 text-[12px] text-white outline-none focus:border-emerald-500/50 font-black tracking-tight"
              />
            </div>

            <div className="relative h-10 px-4 bg-[#1a1f2e]/40 border border-white/5 rounded-sm flex items-center gap-3 group">
              <Calendar className="w-3.5 h-3.5 text-cyan-500/60" />
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="bg-transparent text-[11px] text-white font-black uppercase tracking-widest outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => window.print()} className="h-10 px-6 bg-slate-900 border border-slate-800 rounded-sm text-[10px] text-slate-200 font-black uppercase tracking-widest hover:text-white transition-all shadow-lg active:scale-95">Export Ledger</button>
          </div>
        </div>

        {/* REFINEMENT TRAY: Tactical Filters (As Requested) */}
        <div className="px-6 py-3 border-b border-slate-800/50 flex flex-wrap items-center gap-4 bg-[#070b14]">
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-slate-600" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-sm h-8 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 focus:text-white outline-none">
              <option value="all">Status: All</option>
              <option value="present">Present Only</option>
              <option value="absent">Absent Only</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-slate-600" />
            <input type="text" placeholder="Event #" value={eventFilter} onChange={e => setEventFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-sm h-8 px-3 w-28 text-[10px] font-black uppercase text-white outline-none placeholder:text-slate-700" />
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
            <select value={clubFilter} onChange={e => setClubFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-sm h-8 px-3 max-w-[200px] text-[10px] font-black uppercase tracking-widest text-slate-400 focus:text-white outline-none">
              <option value="all">Club: All Teams</option>
              {uniqueClubs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="ml-auto text-slate-600 text-[9px] font-black uppercase tracking-widest">
            Audit Stream: <span className="text-slate-400">{filteredData.length} Personnel Found</span>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <DataTable
            data={filteredData}
            columns={columns}
            isLoading={loading}
            pageSize={50}
            searchable={false}
            className="border-none [&_thead]:bg-[#0d1321] [&_thead]:text-slate-500 [&_thead_th]:p-4 [&_thead_th]:text-[9px] [&_thead_th]:font-black [&_thead_th]:uppercase [&_thead_th]:tracking-[0.1em] [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-800/20 [&_tbody_tr:nth-child(even)]:bg-[#070b14] hover:[&_tbody_tr]:bg-slate-900/10 cursor-default [&_.sm\:flex-row]:justify-end [&_select]:bg-slate-900 [&_select]:border-slate-800 [&_td]:py-4"
          />
        </div>
      </Card>
    </div>
  );
}
