import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Trash2, 
  Save, 
  Calendar, 
  Clock, 
  Users, 
  Download,
  AlertTriangle,
  Edit2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react";
import { BookingsAPI } from "../../lib/storage";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

const COMMON_CATEGORIES = [
  "Athlete", "Coach", "Team Manager", "Parent", "VIP", "Media", "Official", "Medical", "Volunteer"
];

export default function BookingSetupTab({ eventId, onToast, disabled }) {
  const [config, setConfig] = useState({
    title: "Event Slot Booking",
    description: "Please select your preferred time slot from the available options below.",
    is_active: false,
    allowed_categories: ["Athlete", "Coach"],
    slots: [],
    hidden_dates: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [editingSlotId, setEditingSlotId] = useState(null);
  
  // New slot form state
  const [newSlot, setNewSlot] = useState({
    group_name: "Meeting 1",
    date: new Date().toISOString().split('T')[0],
    start_time: "09:00",
    end_time: "12:00",
    interval: 30,
    time_frame: "09:00 AM - 09:30 AM",
    duration: 30,
    max_capacity: 5
  });
  
  // Accordion states
  const [expandedMeetings, setExpandedMeetings] = useState([]);
  const [expandedDates, setExpandedDates] = useState({});
  
  // Custom Modals State
  const [renameModal, setRenameModal] = useState({ isOpen: false, oldName: "", newName: "" });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, slotId: null });

  const toggleMeeting = (groupName) => {
    setExpandedMeetings(prev => 
      prev.includes(groupName) ? prev.filter(m => m !== groupName) : [...prev, groupName]
    );
  };

  const toggleDate = (groupName, dateStr) => {
    setExpandedDates(prev => {
      const current = prev[groupName] || [];
      return {
        ...prev,
        [groupName]: current.includes(dateStr) ? current.filter(d => d !== dateStr) : [...current, dateStr]
      };
    });
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [configData, bookingsData] = await Promise.all([
          BookingsAPI.getConfig(eventId),
          BookingsAPI.getBookings(eventId)
        ]);
        
        if (configData) {
          setConfig({
            ...configData,
            allowed_categories: configData.allowed_categories || [],
            slots: configData.slots || [],
            hidden_dates: configData.hidden_dates || []
          });
        }
        setBookings(bookingsData || []);
      } catch (err) {
        console.error("Error loading booking setup:", err);
        onToast?.("Failed to load booking configuration", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [eventId, onToast]);

  const handleSave = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await BookingsAPI.saveConfig({
        event_id: eventId,
        ...config
      });
      toast.success(config.is_active ? "✅ Booking Form enabled and saved!" : "✅ Booking Form saved and hidden.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save configuration: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (cat) => {
    if (disabled) return;
    setConfig(prev => {
      const current = prev.allowed_categories || [];
      if (current.includes(cat)) {
        return { ...prev, allowed_categories: current.filter(c => c !== cat) };
      } else {
        return { ...prev, allowed_categories: [...current, cat] };
      }
    });
  };

  const toggleHideDate = (groupName, dateStr) => {
    if (disabled) return;
    const hideKey = `${groupName}_${dateStr}`;
    setConfig(prev => {
      const hidden = prev.hidden_dates || [];
      const isNowHidden = !hidden.includes(hideKey);
      
      if (isNowHidden) {
        toast.success(`Date hidden from QR profile. Don't forget to save!`, { duration: 3000 });
        return { ...prev, hidden_dates: [...hidden, hideKey] };
      } else {
        toast.success(`Date is visible again. Don't forget to save!`, { duration: 3000 });
        return { ...prev, hidden_dates: hidden.filter(k => k !== hideKey) };
      }
    });
  };

  const saveSlot = () => {
    if (disabled) return;
    
    if (editingSlotId) {
      if (!newSlot.time_frame || !newSlot.date || newSlot.max_capacity < 1) {
        toast.error("Please fill all slot fields correctly.");
        return;
      }
      setConfig(prev => ({
        ...prev,
        slots: prev.slots.map(s => s.id === editingSlotId ? { ...s, ...newSlot } : s)
      }));
      setEditingSlotId(null);
      toast.success("Slot updated. Don't forget to save!");
    } else {
      if (!newSlot.start_time || !newSlot.end_time || !newSlot.date || newSlot.interval < 5 || newSlot.max_capacity < 1) {
        toast.error("Please fill all generation fields correctly.");
        return;
      }
      
      const start = new Date(`${newSlot.date}T${newSlot.start_time}`);
      const end = new Date(`${newSlot.date}T${newSlot.end_time}`);
      
      if (start >= end) {
        toast.error("End time must be after start time.");
        return;
      }
      
      const generatedSlots = [];
      let current = start;
      
      while (current < end) {
        const next = new Date(current.getTime() + newSlot.interval * 60000);
        if (next > end) break;
        
        const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        
        generatedSlots.push({
          id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${generatedSlots.length}`,
          group_name: newSlot.group_name,
          date: newSlot.date,
          time_frame: `${formatTime(current)} - ${formatTime(next)}`,
          duration: newSlot.interval,
          max_capacity: newSlot.max_capacity
        });
        
        current = next;
      }
      
      setConfig(prev => ({
        ...prev,
        slots: [...(prev.slots || []), ...generatedSlots]
      }));
      toast.success(`Generated ${generatedSlots.length} slots. Don't forget to save!`);
    }
    
    // Reset form after saving
    setNewSlot(prev => ({
      ...prev,
      time_frame: "09:00 AM - 09:30 AM"
    }));
  };

  const editSlot = (slot) => {
    if (disabled) return;
    setEditingSlotId(slot.id);
    setNewSlot(prev => ({
      ...prev,
      group_name: slot.group_name || "Meeting 1",
      date: slot.date || new Date().toISOString().split('T')[0],
      time_frame: slot.time_frame || "09:00 AM - 10:00 AM",
      duration: slot.duration || 60,
      max_capacity: slot.max_capacity || 10
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingSlotId(null);
    setNewSlot(prev => ({
      ...prev,
      time_frame: "09:00 AM - 09:30 AM"
    }));
  };

  const renameMeeting = (oldName) => {
    if (disabled) return;
    setRenameModal({ isOpen: true, oldName, newName: oldName });
  };

  const handleRenameConfirm = () => {
    if (renameModal.newName && renameModal.newName.trim() !== "" && renameModal.newName !== renameModal.oldName) {
      setConfig(prev => ({
        ...prev,
        slots: prev.slots.map(s => s.group_name === renameModal.oldName ? { ...s, group_name: renameModal.newName.trim() } : s)
      }));
      toast.success("Meeting renamed. Don't forget to save!");
    }
    setRenameModal({ isOpen: false, oldName: "", newName: "" });
  };

  const removeSlot = (slotId) => {
    if (disabled) return;
    
    // Check if slot has bookings
    const occupancy = slotOccupancy[slotId] || 0;
    if (occupancy > 0) {
      setDeleteConfirmModal({ isOpen: true, slotId });
      return;
    }
    
    executeRemoveSlot(slotId);
  };

  const executeRemoveSlot = (slotId) => {
    setConfig(prev => ({
      ...prev,
      slots: prev.slots.filter(s => s.id !== slotId)
    }));
    
    if (editingSlotId === slotId) setEditingSlotId(null);
    toast.success("Slot removed. Don't forget to save!");
    setDeleteConfirmModal({ isOpen: false, slotId: null });
  };

  // Calculate live occupancy
  const slotOccupancy = useMemo(() => {
    const counts = {};
    bookings.forEach(b => {
      counts[b.slot_id] = (counts[b.slot_id] || 0) + 1;
    });
    return counts;
  }, [bookings]);

  // Calculate unique individuals
  const uniqueParticipantsCount = useMemo(() => {
    const pIds = new Set();
    bookings.forEach(b => {
      const pId = b.participant_id || b.accreditations?.id || b.accreditations?.badge_number;
      if (pId) pIds.add(pId);
    });
    return pIds.size;
  }, [bookings]);

  // Group slots by group_name and date
  const groupedSlots = useMemo(() => {
    const groups = {};
    (config.slots || []).forEach(slot => {
      const g = slot.group_name || "General Meeting";
      if (!groups[g]) groups[g] = {};
      const d = slot.date || "Unknown Date";
      if (!groups[g][d]) groups[g][d] = [];
      groups[g][d].push(slot);
    });
    
    // Sort slots within each date by time
    Object.keys(groups).forEach(g => {
      Object.keys(groups[g]).forEach(d => {
        groups[g][d].sort((a, b) => {
          const timeA = new Date(`${a.date} ${a.time_frame.split('-')[0]}`);
          const timeB = new Date(`${b.date} ${b.time_frame.split('-')[0]}`);
          return isNaN(timeA) ? 0 : timeA - timeB;
        });
      });
    });
    
    return groups;
  }, [config.slots]);

  const downloadBookings = () => {
    if (bookings.length === 0) {
      toast.info("No bookings yet to export.");
      return;
    }

    // Get unique meetings
    const meetings = [...new Set((config.slots || []).map(s => s.group_name || "General Meeting"))].sort();

    // Setup headers
    const headers = ["Name", "ID Number", "Badge Number", "Club", "Role"];
    meetings.forEach(m => {
      headers.push(`${m} Date`, `${m} Time`);
    });
    headers.push("Booking Created At");

    // Group bookings by participant
    const participants = {};
    bookings.forEach(b => {
      const pId = b.participant_id || b.accreditations?.id || b.accreditations?.badge_number;
      if (!pId) return;

      if (!participants[pId]) {
        participants[pId] = {
          name: b.accreditations ? `${b.accreditations.first_name || ''} ${b.accreditations.last_name || ''}`.trim() : 'Unknown',
          id_number: b.accreditations?.accreditation_id || b.accreditations?.id || 'N/A',
          badge: b.accreditations?.badge_number || 'N/A',
          club: b.accreditations?.club || 'N/A',
          role: b.accreditations?.role || 'N/A',
          meetings: {},
          booking_created_at: b.created_at || b.createdAt || ""
        };
      } else if (!participants[pId].booking_created_at && (b.created_at || b.createdAt)) {
        participants[pId].booking_created_at = b.created_at || b.createdAt;
      }

      const slot = config.slots.find(s => s.id === b.slot_id);
      if (slot) {
        const gName = slot.group_name || "General Meeting";
        participants[pId].meetings[gName] = {
          date: slot.date || "Unknown",
          time: slot.time_frame || "Unknown"
        };
      }
    });

    // Convert to array and sort by booking time ascending (oldest first)
    const participantsArray = Object.values(participants).sort((a, b) => {
      const timeA = new Date(a.booking_created_at || 0).getTime();
      const timeB = new Date(b.booking_created_at || 0).getTime();
      if (timeA === timeB) {
        return String(a.badge).localeCompare(String(b.badge));
      }
      return timeA - timeB;
    });

    // Build CSV rows
    const rows = participantsArray.map(p => {
      const row = [
        `"${p.name}"`, 
        `"${p.id_number}"`,
        `"${p.badge}"`, 
        `"${p.club}"`, 
        `"${p.role}"`
      ];
      
      meetings.forEach(m => {
        const mData = p.meetings[m];
        row.push(`"${mData ? mData.date : ''}"`, `"${mData ? mData.time : ''}"`);
      });
      
      const formattedTime = p.booking_created_at 
        ? new Date(p.booking_created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
        : "";
      row.push(`"${formattedTime}"`);
      
      return row.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_${eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-12 text-center animate-pulse text-slate-500">Loading configuration...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: General Settings */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Form Title</label>
            <input 
              type="text" 
              value={config.title}
              onChange={(e) => setConfig({...config, title: e.target.value})}
              disabled={disabled}
              className={cn(
                "w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 outline-none transition-all",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Description</label>
            <textarea 
              value={config.description}
              onChange={(e) => setConfig({...config, description: e.target.value})}
              disabled={disabled}
              className={cn(
                "w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 outline-none transition-all h-24 resize-none",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>
          <div className="pt-2">
            <label className={cn("flex items-center gap-3 group", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={config.is_active}
                  onChange={(e) => setConfig({...config, is_active: e.target.checked})}
                  disabled={disabled}
                  className="sr-only peer"
                />
                <div className={cn(
                  "w-11 h-6 bg-slate-800 border border-white/10 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white",
                  !disabled && "group-hover:border-white/20"
                )} />
              </div>
              <div>
                <span className={cn("text-sm font-bold text-white uppercase tracking-widest transition-colors", !disabled && "group-hover:text-emerald-400")}>Enable Booking System</span>
                <p className="text-[10px] text-slate-500 font-medium">Participants will see the booking module on their QR profile.</p>
              </div>
            </label>
          </div>
        </div>
        
        {/* Right Column: Roles & Save */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Allowed Categories</span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white">{config.allowed_categories?.length || 0} selected</span>
            </label>
            <div className="bg-slate-900 border border-white/10 rounded-xl p-4 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {COMMON_CATEGORIES.map(cat => {
                const isActive = (config.allowed_categories || []).includes(cat);
                return (
                  <button
                    key={cat}
                    disabled={disabled}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                      isActive 
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-sm" 
                        : "bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700"
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Only users with these roles will see the booking form.</p>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="outline" 
              icon={Download} 
              onClick={downloadBookings}
              className="w-full md:w-auto border-white/10"
            >
              Export Bookings ({uniqueParticipantsCount})
            </Button>
            <Button 
              variant="primary" 
              icon={Save} 
              loading={saving}
              disabled={disabled}
              onClick={handleSave}
              className="w-full md:w-auto"
            >
              {disabled ? "View Only Mode" : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Slots Manager */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" /> Slot Manager
          </h3>
          <p className="text-sm text-slate-400">Configure time frames and capacities for bookings.</p>
        </div>

        {!disabled && (
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex flex-wrap lg:flex-nowrap gap-4 items-end">
            <div className="space-y-1 w-full lg:w-auto">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Meeting Name</label>
              <input 
                type="text" 
                placeholder="e.g. Meeting 1"
                value={newSlot.group_name}
                onChange={e => setNewSlot({...newSlot, group_name: e.target.value})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div className="space-y-1 w-full lg:w-auto">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
              <input 
                type="date" 
                value={newSlot.date}
                onChange={e => setNewSlot({...newSlot, date: e.target.value})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            {editingSlotId ? (
              <>
                <div className="space-y-1 w-full lg:w-auto flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Time Frame (Label)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 09:00 AM - 10:00 AM"
                    value={newSlot.time_frame}
                    onChange={e => setNewSlot({...newSlot, time_frame: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
                <div className="space-y-1 w-full lg:w-24">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Duration (m)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={newSlot.duration}
                    onChange={e => setNewSlot({...newSlot, duration: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1 w-full lg:w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Start Time</label>
                  <input 
                    type="time" 
                    value={newSlot.start_time}
                    onChange={e => setNewSlot({...newSlot, start_time: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
                <div className="space-y-1 w-full lg:w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">End Time</label>
                  <input 
                    type="time" 
                    value={newSlot.end_time}
                    onChange={e => setNewSlot({...newSlot, end_time: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
                <div className="space-y-1 w-full lg:w-24">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Interval (m)</label>
                  <input 
                    type="number" 
                    min="5"
                    step="5"
                    value={newSlot.interval}
                    onChange={e => setNewSlot({...newSlot, interval: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
              </>
            )}
            <div className="space-y-1 w-full lg:w-24">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Max Slots</label>
              <input 
                type="number" 
                min="1"
                value={newSlot.max_capacity}
                onChange={e => setNewSlot({...newSlot, max_capacity: parseInt(e.target.value) || 0})}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div className="flex gap-2 w-full lg:w-auto">
              <Button onClick={saveSlot} className="flex-1 lg:flex-none h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 font-bold text-sm">
                {editingSlotId ? <Edit2 className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {editingSlotId ? "Update Slot" : "Generate Slots"}
              </Button>
              {editingSlotId && (
                <Button onClick={cancelEdit} className="h-9 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 font-bold text-sm">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {Object.keys(groupedSlots).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedSlots).map(([groupName, groupDates]) => {
              const isMeetingExpanded = expandedMeetings.includes(groupName);
              return (
              <div key={groupName} className="border border-white/5 bg-white/[0.02] rounded-3xl overflow-hidden shadow-sm">
                <button 
                  onClick={() => toggleMeeting(groupName)}
                  className="w-full flex items-center justify-between p-6 bg-slate-900/50 hover:bg-slate-800/50 transition-colors border-b border-white/5"
                >
                  <h4 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-3">
                    {isMeetingExpanded ? <ChevronDown className="w-5 h-5 text-blue-500" /> : <ChevronRight className="w-5 h-5 text-blue-500" />}
                    <span className="w-2 h-6 bg-blue-500 rounded-full inline-block"></span>
                    {groupName}
                  </h4>
                  {!disabled && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); renameMeeting(groupName); }}
                      className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                      title="Rename Meeting"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Name
                    </div>
                  )}
                </button>
                
                <AnimatePresence>
                  {isMeetingExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 space-y-4">
                        {Object.entries(groupDates).map(([dateStr, slots]) => {
                          const isDateExpanded = (expandedDates[groupName] || []).includes(dateStr);
                          return (
                            <div key={dateStr} className="space-y-3 border border-blue-500/10 rounded-xl overflow-hidden bg-slate-900/30">
                              <div className="w-full flex items-center justify-between p-4 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer group" onClick={() => toggleDate(groupName, dateStr)}>
                                <div className="flex items-center gap-2 flex-1">
                                  {isDateExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-blue-400" />}
                                  <h4 className="text-sm font-bold text-blue-400 uppercase flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> {dateStr}
                                  </h4>
                                </div>
                                {!disabled && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHideDate(groupName, dateStr);
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border",
                                      (config.hidden_dates || []).includes(`${groupName}_${dateStr}`)
                                        ? "bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700"
                                        : "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
                                    )}
                                    title={(config.hidden_dates || []).includes(`${groupName}_${dateStr}`) ? "Date is hidden in QR profile" : "Date is visible in QR profile"}
                                  >
                                    {(config.hidden_dates || []).includes(`${groupName}_${dateStr}`) ? (
                                      <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
                                    ) : (
                                      <><Eye className="w-3.5 h-3.5" /> Visible</>
                                    )}
                                  </button>
                                )}
                              </div>
                              
                              <AnimatePresence>
                                {isDateExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-4 pt-0 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                      {slots.map(slot => {
                                        const occupancy = slotOccupancy[slot.id] || 0;
                                        const isFull = occupancy >= slot.max_capacity;
                                        const fillPercentage = Math.min(100, (occupancy / slot.max_capacity) * 100);
                                        
                                        return (
                                          <div 
                                            key={slot.id}
                                            className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col relative group"
                                          >
                                            <div className="p-4 flex-1">
                                              <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                    <Clock className="w-4 h-4 text-blue-400" />
                                                  </div>
                                                  <div>
                                                    <h4 className="text-white font-bold tracking-tight text-sm">{slot.time_frame}</h4>
                                                    <p className="text-xs text-slate-400">{slot.duration} mins</p>
                                                  </div>
                                                </div>
                                                {!disabled && (
                                                  <div className="flex items-center gap-1">
                                                    <button onClick={() => editSlot(slot)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Edit Slot">
                                                      <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => removeSlot(slot.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete Slot">
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                              
                                              <div className="mt-4">
                                                <div className="flex justify-between items-end mb-1.5">
                                                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                                                    <Users className="w-3 h-3" />
                                                    <span>Capacity</span>
                                                  </div>
                                                  <span className={cn("text-xs font-black", isFull ? "text-red-400" : "text-emerald-400")}>
                                                    {occupancy} / {slot.max_capacity}
                                                  </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                  <div 
                                                    className={cn("h-full transition-all duration-500 rounded-full", isFull ? "bg-red-500" : "bg-emerald-500")} 
                                                    style={{ width: `${fillPercentage}%` }}
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )})}
          </div>
        ) : (
          <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Slots Configured</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">Create slots above to define the time frames that participants can book.</p>
          </div>
        )}
      </div>

      {/* RENAME MEETING MODAL */}
      <Modal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ isOpen: false, oldName: "", newName: "" })}
        title="Rename Meeting"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Name</label>
            <input 
              type="text" 
              value={renameModal.newName}
              onChange={e => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <Button variant="secondary" onClick={() => setRenameModal({ isOpen: false, oldName: "", newName: "" })}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm} className="bg-blue-600 hover:bg-blue-500 text-white">
              Save Name
            </Button>
          </div>
        </div>
      </Modal>

      {/* DELETE WARNING MODAL */}
      <Modal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, slotId: null })}
        title="Warning: Existing Bookings"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              <p className="font-bold mb-1">This slot already has existing bookings!</p>
              <p>Deleting this slot will remove it from the system, which may disrupt participants who have already booked this time. Are you absolutely sure you want to proceed?</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <Button variant="secondary" onClick={() => setDeleteConfirmModal({ isOpen: false, slotId: null })}>
              Cancel
            </Button>
            <Button onClick={() => executeRemoveSlot(deleteConfirmModal.slotId)} className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-none">
              Delete Slot
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
