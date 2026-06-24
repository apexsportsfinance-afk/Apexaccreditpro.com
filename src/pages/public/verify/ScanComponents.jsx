import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Paperclip, Download, AlertTriangle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { usePublicAssetUrls } from "../../../lib/storage/publicAssets";

export function ExpandableMessageGroup({ title, messages, icon, isPersonal, isTargeted, isGeneral, accreditationId, onRead }) {
  const [hasUnread, setHasUnread] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const latestMessage = messages && messages.length > 0 ? messages[0] : null;
  // Broadcast attachments sign under the same profile-scoped allowlist.
  const { urls: attachmentUrls } = usePublicAssetUrls(
    latestMessage?.attachmentUrl ? [latestMessage.attachmentUrl] : [],
    { accreditationId, scope: "profile" }
  );
  const attachmentHref = latestMessage?.attachmentUrl ? attachmentUrls[latestMessage.attachmentUrl] : null;

  useEffect(() => {
    if (!latestMessage) return;
    const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
    setHasUnread(latestMessage.id && !readIds.includes(latestMessage.id));
  }, [latestMessage]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && hasUnread && latestMessage?.id) {
      markRead();
    }
  };

  const markRead = () => {
    if (hasUnread && latestMessage?.id) {
      const readIds = JSON.parse(localStorage.getItem('qr_read_msgs') || "[]");
      if (!readIds.includes(latestMessage.id)) {
        readIds.push(latestMessage.id);
        localStorage.setItem('qr_read_msgs', JSON.stringify(readIds));
        setHasUnread(false);
        if (onRead) onRead();
      }
    }
  };

  const theme = isPersonal
    ? { border: "border-indigo-500/20", text: "text-indigo-300", bg: "bg-indigo-500/5" }
    : isTargeted
      ? { border: "border-blue-500/20", text: "text-blue-300", bg: "bg-blue-500/5" }
      : { border: "border-emerald-500/20", text: "text-emerald-300", bg: "bg-emerald-500/5" };

  if (!latestMessage) return null;

  return (
    <motion.div
      className={cn("w-full bg-white/[0.03] border rounded-[2rem] overflow-hidden transition-all", theme.border)}
    >
      <button
        onClick={toggleExpand}
        className="w-full flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left outline-none group"
      >
        <div className="flex items-center gap-4">
          <div className="relative p-3 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors">
            {React.cloneElement(icon, { className: cn("w-5 h-5", theme.text) })}
            {hasUnread && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-[#050b18] rounded-full" />}
          </div>
          <div>
            <h3 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", theme.text)}>{title}</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase mt-0.5">LATEST UPDATE</p>
          </div>
        </div>
        <div className={cn("p-2 rounded-xl bg-white/5 transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-2 space-y-4">
              <div className={cn("p-6 rounded-3xl border border-white/10", theme.bg)}>
                <div className="flex justify-between mb-4 border-b border-white/5 pb-3">
                  <div>
                    <span className="text-[9px] text-white/30 font-black uppercase block mb-1">Timestamp</span>
                    <span className="text-[10px] text-white/60 font-black">{latestMessage.createdAt ? new Date(latestMessage.createdAt).toLocaleString() : 'Recent'}</span>
                  </div>
                  {latestMessage.attachmentUrl && attachmentHref && (
                    <a href={attachmentHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-all">
                      <Paperclip className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase">View File</span>
                    </a>
                  )}
                </div>
                <p dir="auto" style={{ textAlign: 'start' }} className="text-white font-medium leading-relaxed whitespace-pre-wrap">{latestMessage.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


export function DownloadButton({ url, visible, label, color }) {
  if (!url || !visible) return null;
  const colors = { blue: "from-blue-600 to-blue-700", emerald: "from-emerald-600 to-emerald-700" };
  return (<a href={url} target="_blank" rel="noopener noreferrer" className={`group flex items-center justify-between gap-4 bg-gradient-to-br ${colors[color]} p-4 pl-6 rounded-2xl text-white font-bold shadow-lg`}><div className="flex flex-col"><span className="text-[10px] text-white/40 uppercase font-black">Download</span><span className="text-sm">{label}</span></div><div className="p-3 bg-black/20 rounded-xl"><Download className="w-4 h-4" /></div></a>);
}

export function ScanSkeleton({ id, phase }) {
  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-t-2 border-cyan-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-cyan-500 font-black text-xs uppercase tracking-[0.4em] animate-pulse mb-2">{phase || "Loading Profile"}</p>
          <p className="text-white/20 text-[10px] font-mono tracking-widest uppercase">ID: {id || "Resolving..."}</p>
        </div>
      </div>
    </div>
  );
}

export function ScanError({ error }) {
  return (<div className="min-h-screen bg-[#050b18] flex items-center justify-center p-6 text-center"><div className="max-w-md"><div className="inline-flex p-5 bg-red-500/10 border border-red-500/20 rounded-[2rem] mb-8"><AlertTriangle className="w-12 h-12 text-red-500" /></div><h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Verification Failed</h2><p className="text-white/40 font-medium mb-12">{error || "The scanned accreditation code is invalid."}</p><button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase text-xs">Retry Scan</button></div></div>);
}
