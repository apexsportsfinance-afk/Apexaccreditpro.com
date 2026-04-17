import React, { useState, useEffect } from "react";
import { Gift, Save, Trash2, Users, Search, CheckCircle, Paperclip } from "lucide-react";

import { BroadcastV2API } from "../../lib/broadcastApi";
import { AccreditationsAPI } from "../../lib/storage";
import { uploadToStorage } from "../../lib/uploadToStorage";
import Button from "../ui/Button";

export default function BirthdayBroadcastPage({ eventId, onToast, draft, setDraft }) {
  const { message = "", file: attachmentFile = null } = draft || {};

  const setMessage = (m) => setDraft({ message: m });
  const setAttachmentFile = (f) => setDraft({ file: f });

  const [loading, setLoading] = useState(false);
  const [birthdayPeople, setBirthdayPeople] = useState([]);
  const [sending, setSending] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (eventId) {
      loadBirthdayPeople();
    }
  }, [eventId]);

  const loadBirthdayPeople = async () => {
    setLoading(true);
    try {
      // 1. Fetch all accreditations for the event
      const participants = await AccreditationsAPI.getByEventId(eventId);
      
      // 2. Clear out participants with status 'approved' and birthday matching today
      const today = new Date().toLocaleDateString('en-CA').slice(5); // MM-DD
      
      const filtered = participants.filter(p => {
        if (p.status !== "approved" || !p.dateOfBirth) return false;
        // Handle YYYY-MM-DD or MM-DD-YYYY formats if necessary, but slice(5) fits YYYY-MM-DD
        return p.dateOfBirth.slice(5) === today;
      });

      setBirthdayPeople(filtered);
      
      // 3. Pre-fill message if empty
      if (!message && filtered.length > 0) {
        setMessage("Happy Birthday from the Apex Sports Team! 🎉 We hope you have a fantastic day at the event!");
      }
    } catch (err) {
      console.error(err);
      onToast?.("Failed to load birthday data", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveMessage = async () => {
    if (!message.trim()) { onToast?.("Please enter a message", "error"); return; }
    if (birthdayPeople.length === 0) { onToast?.("No birthday people to message", "warning"); return; }
    
    setSending(true);
    try {
      let attachmentUrl = null, attachmentName = null;
      if (attachmentFile) {
        const { url, filename } = await uploadToStorage(attachmentFile, "broadcast-attachments");
        attachmentUrl = url; attachmentName = attachmentFile.name || filename;
      }
      
      const recipientIds = birthdayPeople.map(p => p.id);
      await BroadcastV2API.sendToAthletes(eventId, message, recipientIds, attachmentUrl, attachmentName);
      
      setSuccessInfo(`Birthday wishes sent to ${birthdayPeople.length} participant(s)!`);
      setMessage("");
      setAttachmentFile(null);
    } catch (err) { 
      onToast?.("Failed: " + err.message, "error"); 
    }
    finally { setSending(false); }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl space-y-6">
      {successInfo && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setSuccessInfo(null)}>
          <div className="bg-gray-800 border border-emerald-500/30 rounded-3xl p-8 max-w-sm mx-4 text-center shadow-2xl animate-bounce-in">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Wishes Sent!</h3>
            <p className="text-gray-400 text-sm font-medium mb-6">{successInfo}</p>
            <button onClick={() => setSuccessInfo(null)} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all w-full">Done</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-pink-400" />
        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Birthday Broadcast</h3>
      </div>


      <div className="p-4 bg-pink-500/10 rounded-2xl border border-pink-500/20">
        <div className="flex justify-between items-center">
          <p className="text-pink-400 text-xs font-black uppercase tracking-widest">
            Audience: {birthdayPeople.length} Approved Participants with Birthdays Today ({new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })})
          </p>
          <button onClick={loadBirthdayPeople} className="text-[10px] text-pink-400 hover:text-pink-300 font-bold uppercase underline transition-colors">Refresh List</button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-300">
          <div className="w-8 h-8 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium animate-pulse tracking-wide opacity-70">Detecting celebrations...</p>
        </div>
      ) : birthdayPeople.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-inner">
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-800">
              {birthdayPeople.map((p, idx) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-800/80 transition-colors group">
                  <div>
                    <p className="font-bold text-white group-hover:text-pink-200 transition-colors">
                       <span className="text-pink-500/50 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">🎂</span>
                       {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-6">{p.role} • {p.club}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-[10px] font-black text-pink-400 uppercase tracking-tighter shadow-sm">Today</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-end px-1">
              <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest">Customize Celebration Message</label>
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{message?.length || 0}/1000</span>
            </div>
            <textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              rows={4} 
              maxLength={1000}
              placeholder="Write a personalized happy birthday message..." 
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-white font-medium focus:border-pink-500 outline-none transition-all resize-none shadow-xl" 
            />
            
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer px-5 py-3 bg-gray-900 border border-gray-700 hover:border-pink-500/50 hover:bg-pink-500/5 rounded-xl text-sm font-bold text-gray-300 transition-all group">
                <Paperclip className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="truncate max-w-[200px]">{attachmentFile ? attachmentFile.name : "Attach Image/PDF"}</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />
              </label>
              
              <Button onClick={saveMessage} variant="primary" loading={sending} icon={Gift} className="bg-gradient-to-br from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 border-none px-8 py-3.5 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-2xl shadow-pink-900/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex-1 md:flex-none">
                Send Birthday Wishes
              </Button>


              {attachmentFile && (
                <button onClick={() => setAttachmentFile(null)} className="p-3 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 bg-gray-900/40 rounded-3xl border border-gray-700/50 border-dashed text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-5 rotate-3 border border-gray-700/50">
            <Users className="w-8 h-8 text-gray-700 opacity-50" />
          </div>
          <h4 className="text-white font-black uppercase tracking-widest text-sm mb-1">No Active Celebrations</h4>
          <p className="text-gray-500 font-medium text-xs">No approved participants have a birthday on this date.</p>
          <div className="mt-6 px-4 py-2 bg-gray-800/50 rounded-full border border-gray-700/50 text-[10px] text-gray-600 font-black uppercase tracking-widest">
            Scan Complete
          </div>
        </div>
      )}
    </div>
  );
}
