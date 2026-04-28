import React, { useState, useEffect } from 'react';
import { Pencil, X, Clock, Calendar, Plus, Save, Activity, Check, Trash2, Layers, MoreVertical, Briefcase } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { AttendanceAPI } from '../../lib/attendanceApi';
import { useToast } from '../ui/Toast';

export default function SessionManager({ eventId, targetDate, onRefresh, onDateChange }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    sessionName: "",
    eventName: "",
    startTime: "12:00",
    endTime: "13:00",
    date: targetDate || new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadSessions();
  }, [eventId, targetDate]);

  useEffect(() => {
     if (editingId) {
        const s = sessions.find(x => x.id === editingId);
        if (s) {
           setFormData({
              sessionName: s.session_name,
              eventName: s.event_name || "",
              startTime: s.start_time,
              endTime: s.end_time,
              date: s.session_date
           });
           setShowAddForm(true); 
        }
     }
  }, [editingId, sessions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
         await AttendanceAPI.updateSession({ id: editingId, ...formData });
         toast.success("Updated");
         setEditingId(null);
      } else {
         await AttendanceAPI.createSession({ eventId, ...formData });
         toast.success("Published");
      }
      setShowAddForm(false);
      loadSessions();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await AttendanceAPI.getSessions(eventId, targetDate);
      setSessions(data || []);
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await AttendanceAPI.deleteSession(id);
      toast.success("Deleted");
      loadSessions();
      if (onRefresh) onRefresh();
    } catch (err) {}
  };

  return (
    <div className="space-y-4">
      {/* 1. Header (Reference Style with Right-Aligned Button) */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
           <Calendar className="w-5 h-5 text-cyan-500" />
           <h2 className="text-[14px] font-black tracking-tight text-white/90">Daily Session Schedule</h2>
        </div>
        <button 
           onClick={() => {
              setEditingId(null);
              setShowAddForm(!showAddForm);
           }}
           className="h-8 px-4 bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg"
        >
           {showAddForm ? <X className="w-3.5 h-3.5 text-red-500" /> : <><Plus className="w-3.5 h-3.5" /> Add Session</>}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
         {/* 2. LEFT: COMMAND FORM (Visibility toggled by Add/Edit) */}
         {showAddForm && (
            <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-[#0a1428]/60 border border-white/5 backdrop-blur-3xl rounded-lg p-5 space-y-5 shadow-2xl animate-in slide-in-from-left-4 duration-300">
               <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[9px] text-cyan-500 font-black uppercase tracking-widest">Event Full Name</label>
                     <input type="text" placeholder="e.g. National Qualifiers" value={formData.eventName} onChange={e => setFormData({...formData, eventName: e.target.value})} className="w-full bg-[#020617] border border-slate-800 rounded-sm h-10 px-3 text-[11px] text-white outline-none focus:border-cyan-500/50" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Session Name</label>
                     <input type="text" placeholder="206" value={formData.sessionName} onChange={e => setFormData({...formData, sessionName: e.target.value})} className="w-full bg-[#020617] border border-slate-800 rounded-sm h-10 px-3 text-[12px] text-white font-black uppercase tracking-tight" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Edit Date</label>
                     <input type="date" value={formData.date} onChange={e => {
                        setFormData({...formData, date: e.target.value});
                        if (!editingId && onDateChange) onDateChange(e.target.value); 
                     }} className="w-full bg-[#020617] border border-slate-800 rounded-sm h-10 px-3 text-[11px] text-white cursor-pointer" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Start</label>
                        <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="w-full bg-[#020617] border border-slate-800 rounded-sm h-10 px-2 text-[11px] text-white" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">End</label>
                        <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="w-full bg-[#020617] border border-slate-800 rounded-sm h-10 px-2 text-[11px] text-white" />
                     </div>
                  </div>
                  <div className="pt-2">
                     <button type="submit" className="w-full h-11 bg-cyan-600 text-white font-black uppercase text-[10px] tracking-widest rounded-sm hover:bg-cyan-500 flex items-center justify-center gap-2 shadow-xl">
                        <Check className="w-4 h-4" /> {editingId ? 'Update' : 'Publish'}
                     </button>
                  </div>
               </form>
            </div>
         )}

         {/* 3. RIGHT: SESSION CARDS (Blueprint Resync) */}
         <div className={`col-span-12 ${showAddForm ? 'md:col-span-8 lg:col-span-9' : 'md:col-span-12'} flex gap-5 overflow-x-auto pb-4 scrollbar-hide`}>
            {sessions.map(s => (
               <div key={s.id} className="min-w-[240px] h-[190px] bg-[#1a1f2e]/10 border border-white/5 backdrop-blur-3xl rounded-lg p-5 flex flex-col relative group transition-all hover:bg-[#1a1f2e]/20 hover:border-cyan-500/20 shadow-2xl">
                  {/* Quick Controls */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => { setEditingId(s.id); setShowAddForm(true); }} className="p-1.5 bg-[#020617] rounded-sm hover:text-cyan-400 border border-slate-800 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                     <button onClick={() => handleDelete(s.id)} className="p-1.5 bg-[#020617] rounded-sm hover:text-red-400 border border-slate-800 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  
                  {/* Session Header */}
                  <h3 className="text-[18px] font-black text-white uppercase tracking-tight leading-none mb-4">{s.session_name}</h3>
                  
                  {/* Temporal Data List */}
                  <div className="space-y-2.5 mt-auto">
                     <div className="flex items-center gap-3">
                        <Calendar className="w-3.5 h-3.5 text-cyan-500/80" />
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{s.session_date}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <Clock className="w-3.5 h-3.5 text-cyan-500/80" />
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                           {s.start_time.includes(':') ? s.start_time : `${s.start_time}:00`} - {s.end_time.includes(':') ? s.end_time : `${s.end_time}:00`}
                        </span>
                     </div>
                  </div>

                  {/* Separator Line */}
                  <div className="w-full h-[1px] bg-white/5 my-4" />

                  {/* Event Name Footer */}
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest truncate">
                    {s.event_name || "Registry Module"}
                  </p>
               </div>
            ))}
            
            {sessions.length === 0 && !showAddForm && (
               <div className="flex flex-col items-center justify-center w-full h-[190px] border border-dashed border-slate-800 rounded-lg opacity-40">
                  <Layers className="w-8 h-8 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Void Modules</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
