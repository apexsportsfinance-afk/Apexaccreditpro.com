import React, { useState } from "react";
import { MessageSquare, Calendar, Settings, FileText, ClipboardList, Files, ShieldAlert } from "lucide-react";
import GlobalBroadcastPanel from "./GlobalBroadcastPanel";
import SportEventsManager from "./SportEventsManager";
import FormFieldSettings from "./FormFieldSettings";
import EventPdfSlots from "./EventPdfSlots";
import OfficialDocumentsTab from "./OfficialDocumentsTab";
import EmergencyDocumentsTab from "./EmergencyDocumentsTab";
import TechnicalDocumentsTab from "./TechnicalDocumentsTab";
import FeedbackSetupTab from "./FeedbackSetupTab";
import ZoneScannerTab from "./ZoneScannerTab";
import { useAuth } from "../../contexts/AuthContext";

const TABS = [
  { id: "broadcast", label: "Broadcast Message", icon: MessageSquare },
  { id: "event_pdfs", label: "Hy-Tek Documents", icon: FileText },
  { id: "official_docs", label: "Official Documents", icon: Files },
  { id: "technical_docs", label: "Result Documents", icon: ClipboardList },
  { id: "safety_docs", label: "Safety Documents", icon: ShieldAlert },
  { id: "events", label: "Sport Events", icon: Calendar },
  { id: "feedback", label: "Feedback Form", icon: MessageSquare },
  { id: "pdf_fields", label: "Field Visibility", icon: Settings },
  { id: "scanner_control", label: "Scanner Control", icon: ShieldAlert }
];

export default function QRSystemV3Tab({ eventId, onToast }) {
  const [activeTab, setActiveTab] = useState("broadcast");
  const { isSuperAdmin } = useAuth();

  // Filter tabs based on administrative tier
  const filteredTabs = TABS.filter(tab => {
    const restrictedTabs = ["events", "pdf_fields", "scanner_control"];
    if (!isSuperAdmin && restrictedTabs.includes(tab.id)) return false;
    return true;
  });

  return (
    <div id="qr-system-v3-tab" className="space-y-6">
      {/* Optimized Tab Navigation - High-Density Admin Layout */}
      <div className="flex gap-1 bg-gray-900/50 backdrop-blur-md border border-white/5 rounded-xl p-1.5 shadow-2xl overflow-x-auto">
        {filteredTabs.map(tab => {
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
        {activeTab === "broadcast" && (
          <GlobalBroadcastPanel eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "events" && isSuperAdmin && (
          <SportEventsManager eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "pdf_fields" && isSuperAdmin && (
          <FormFieldSettings eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "event_pdfs" && (
          <EventPdfSlots eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "official_docs" && (
          <OfficialDocumentsTab eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "technical_docs" && (
          <TechnicalDocumentsTab eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "safety_docs" && (
          <EmergencyDocumentsTab eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "feedback" && (
          <FeedbackSetupTab eventId={eventId} onToast={onToast} />
        )}
        {activeTab === "scanner_control" && isSuperAdmin && (
          <ZoneScannerTab eventId={eventId} onToast={onToast} />
        )}
      </div>
    </div>
  );
}
