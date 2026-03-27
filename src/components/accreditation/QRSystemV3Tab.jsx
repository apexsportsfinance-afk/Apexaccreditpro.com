import React, { useState } from "react";
import { MessageSquare, Calendar, Settings, FileText, ClipboardList } from "lucide-react";
import GlobalBroadcastPanel from "./GlobalBroadcastPanel";
import SportEventsManager from "./SportEventsManager";
import FormFieldSettings from "./FormFieldSettings";
import EventPdfSlots from "./EventPdfSlots";
import AttendanceSheet from "../attendance/AttendanceSheet";

const TABS = [
  { id: "attendance", label: "Attendance Registry", icon: ClipboardList },
  { id: "broadcast", label: "Broadcast Message", icon: MessageSquare },
  { id: "event_pdfs", label: "Event Result PDF", icon: FileText },
  { id: "events", label: "Sport Events", icon: Calendar },
  { id: "pdf_fields", label: "Field Visibility", icon: Settings }
];

export default function QRSystemV3Tab({ eventId, onToast }) {
  const [activeTab, setActiveTab] = useState("attendance");

  return (
    <div id="qr-system-v3-tab" className="space-y-6">
      {/* Optimized Tab Navigation - High-Density Admin Layout */}
      <div className="flex gap-1 bg-gray-900/50 backdrop-blur-md border border-white/5 rounded-xl p-1.5 shadow-2xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2.5 flex-1 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all duration-300 ${
                isActive
                  ? "bg-slate-700 text-white shadow-lg shadow-white/5 border border-white/10"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Content Engine */}
      <div className="transition-all duration-500">
        {activeTab === "attendance" && (
          <AttendanceSheet 
            event={{ id: eventId }} 
            onBack={() => {}} // Internal tab navigation handles this
          />
        )}
        {activeTab === "broadcast" && (
          <GlobalBroadcastPanel eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "events" && (
          <SportEventsManager eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "pdf_fields" && (
          <FormFieldSettings eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "event_pdfs" && (
          <EventPdfSlots eventId={eventId} onToast={onToast} />
        )}
      </div>
    </div>
  );
}
