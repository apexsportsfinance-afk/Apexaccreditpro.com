import React, { useState, useEffect } from "react";
import { Gift, Save, Trash2, Users, Search, CheckCircle, Paperclip } from "lucide-react";

import { BroadcastV2API, GlobalSettingsAPI } from "../../lib/broadcastApi";
import { AccreditationsAPI } from "../../lib/storage";
import { uploadToStorage } from "../../lib/uploadToStorage";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";

export default function BirthdayBroadcastPage({ eventId, onToast, draft, setDraft, disabled }) {
  const { message = "", file: attachmentFile = null } = draft || {};

  const setMessage = (m) => setDraft({ message: m });
  const setAttachmentFile = (f) => setDraft({ file: f });

  const [loading, setLoading] = useState(false);
  const [birthdayPeople, setBirthdayPeople] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (eventId) {
      loadBirthdayPeople();
      loadTemplate();
    }
  }, [eventId]);

  const loadTemplate = async () => {
    try {
      const saved = await GlobalSettingsAPI.get(`birthday_template_event_${eventId}`);
      if (saved && !message) {
        setMessage(saved);
      }
    } catch (err) { console.error("Template load failed", err); }
  };

  const saveTemplate = async () => {
    if (!message.trim() || disabled) return;
    setSavingTemplate(true);
    try {
      await GlobalSettingsAPI.set(`birthday_template_event_${eventId}`, message);
      onToast?.("Default birthday template saved", "success");
    } catch (err) { 
      onToast?.("Failed to save template: " + err.message, "error"); 
    } finally { setSavingTemplate(false); }
  };

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
      setSelectedIds(new Set(filtered.map(p => p.id)));
      
      // 3. Pre-fill message if empty and no saved template
      if (!message && filtered.length > 0) {
        const saved = await GlobalSettingsAPI.get(`birthday_template_event_${eventId}`);
        if (saved) {
          setMessage(saved);
        } else {
          setMessage("Happy Birthday from the Apex Sports Team! 🎉 We hope you have a fantastic day at the event!");
        }
      }
    } catch (err) {
      console.error(err);
      onToast?.("Failed to load birthday data", "error");
    } finally {
      setLoading(false);
    }
  };

  const replacePlaceholders = (text, person) => {
    if (!text) return "";
    return text
      .replace(/\{firstName\}/g, person.firstName || "")
      .replace(/\{lastName\}/g, person.lastName || "")
      .replace(/\{fullName\}/g, `${person.firstName || ""} ${person.lastName || ""}`.trim())
      .replace(/\{name\}/g, `${person.firstName || ""} ${person.lastName || ""}`.trim())
      .replace(/\{club\}/g, person.club || "");
  };

  const saveMessage = async () => {
    if (disabled) return;
    if (!message.trim()) { onToast?.("Please enter a message", "error"); return; }
    if (selectedIds.size === 0) { onToast?.("Please select at least one person", "warning"); return; }
    
    setSending(true);
    try {
      let attachmentUrl = null, attachmentName = null;
      if (attachmentFile) {
        const { url, filename } = await uploadToStorage(attachmentFile, "broadcast-attachments");
        attachmentUrl = url; attachmentName = attachmentFile.name || filename;
      }
      
      // APX-DYNAMIC: Send personalized message to each selected person
      const selectedPeople = birthdayPeople.filter(p => selectedIds.has(p.id));
      const sendPromises = selectedPeople.map(person => {
        const personalizedMsg = replacePlaceholders(message, person);
        return BroadcastV2API.sendToAthletes(eventId, personalizedMsg, [person.id], attachmentUrl, attachmentName);
      });

      await Promise.all(sendPromises);
      
      setSuccessInfo(`Personalized birthday wishes sent to ${selectedPeople.length} participant(s)!`);
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
            Audience: {selectedIds.size}/{birthdayPeople.length} Selected — Birthdays Today ({new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })})
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedIds.size === birthdayPeople.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(birthdayPeople.map(p => p.id)));
                }
              }}
              disabled={disabled}
              className="text-[10px] text-pink-400 hover:text-pink-300 font-bold uppercase underline transition-colors disabled:opacity-50"
            >
              {selectedIds.size === birthdayPeople.length ? "Deselect All" : "Select All"}
            </button>
            <button onClick={loadBirthdayPeople} className="text-[10px] text-pink-400 hover:text-pink-300 font-bold uppercase underline transition-colors">Refresh</button>
          </div>
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
              {birthdayPeople.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (disabled) return;
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                        return next;
                      });
                    }}
                    className={cn(
                      "px-5 py-3.5 flex items-center justify-between transition-colors group cursor-pointer",
                      isSelected ? "bg-pink-500/5 hover:bg-pink-500/10" : "hover:bg-gray-800/80 opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                        isSelected ? "bg-pink-500 border-pink-500" : "border-gray-600 bg-transparent"
                      )}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-pink-200 transition-colors">
                          <span className="text-pink-500/50 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">🎂</span>
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest ml-6">{p.role} • {p.club}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-[10px] font-black text-pink-400 uppercase tracking-tighter shadow-sm">Today</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-end px-1">
              <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest">Customize Celebration Message</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={saveTemplate}
                  disabled={savingTemplate || !message.trim() || disabled}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] text-pink-400 hover:text-white transition-colors uppercase font-black tracking-widest disabled:opacity-50",
                    disabled && "cursor-not-allowed"
                  )}
                  title={disabled ? "View Only" : "Make this the permanent template for this event"}
                >
                  <Save className={`w-3 h-3 ${savingTemplate ? 'animate-spin' : ''}`} />
                  Set as Default
                </button>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{message?.length || 0}/1000</span>
              </div>
            </div>
            
            <div className="relative group">
              <textarea 
                value={message} 
                onChange={e => setMessage(e.target.value)} 
                rows={4} 
                maxLength={1000}
                placeholder={disabled ? "View only" : "Write a personalized happy birthday message..."}
                disabled={disabled}
                className={cn(
                  "w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-white font-medium focus:border-pink-500 outline-none transition-all resize-none shadow-xl",
                  disabled && "opacity-50 cursor-not-allowed"
                )} 
              />
              <div className="mt-2 flex flex-wrap gap-2 px-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Dynamic Tags:</span>
                {['{firstName}', '{lastName}', '{fullName}', '{club}'].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => !disabled && setMessage(message + tag)}
                    disabled={disabled}
                    className={cn(
                      "text-[9px] bg-gray-900 border border-gray-700 text-pink-400 px-2 py-0.5 rounded transition-all font-mono",
                      !disabled ? "hover:border-pink-500" : "opacity-30 cursor-not-allowed"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <label className={cn(
                "flex items-center gap-2 px-5 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm font-bold text-gray-300 transition-all group",
                !disabled ? "hover:border-pink-500/50 hover:bg-pink-500/5 cursor-pointer" : "opacity-30 cursor-not-allowed"
              )}>
                <Paperclip className={cn("w-4 h-4 text-pink-400 transition-transform", !disabled && "group-hover:scale-110")} />
                <span className="truncate max-w-[200px]">{attachmentFile ? attachmentFile.name : "Attach Image/PDF"}</span>
                {!disabled && <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />}
              </label>
              
              <Button 
                onClick={saveMessage} 
                variant="primary" 
                loading={sending} 
                icon={Gift} 
                disabled={disabled}
                className={cn(
                  "bg-gradient-to-br from-pink-600 to-rose-500 border-none px-8 py-3.5 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-2xl shadow-pink-900/20 transform transition-all flex-1 md:flex-none",
                  !disabled ? "hover:from-pink-500 hover:to-rose-400 hover:-translate-y-0.5 active:translate-y-0" : "opacity-50 cursor-not-allowed"
                )}
              >
                Send to {selectedIds.size} Selected
              </Button>

              {attachmentFile && !disabled && (
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
