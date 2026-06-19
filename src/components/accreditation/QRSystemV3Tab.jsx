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
import BookingSetupTab from "./BookingSetupTab";
import ZoneScannerTab from "./ZoneScannerTab";
import LiveScoresTab from "./LiveScoresTab";
import EventPhotosTab from "./EventPhotosTab";
import { Activity, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const TABS = [
  { id: "broadcast", label: "Broadcast Message", icon: MessageSquare },
  { id: "event_pdfs", label: "Hy-Tek Documents", icon: FileText },
  { id: "official_docs", label: "Official Documents", icon: Files },
  { id: "technical_docs", label: "Result Documents", icon: ClipboardList },
  { id: "safety_docs", label: "Safety Documents", icon: ShieldAlert },
  { id: "events", label: "Sport Events", icon: Calendar },
  { id: "live_scores", label: "Live Scores", icon: Activity },
  { id: "feedback", label: "Feedback Form", icon: MessageSquare },
  { id: "booking", label: "Booking Form", icon: Calendar },
  { id: "pdf_fields", label: "Field Visibility", icon: Settings },
  { id: "photos", label: "Event Photos", icon: ImageIcon },
  { id: "scanner_control", label: "Scanner Control", icon: ShieldAlert }
];

export default function QRSystemV3Tab({ eventId, onToast }) {
  const { isSuperAdmin, isViewer, hasExactModuleAccess } = useAuth();

  // Filter tabs based on administrative tier and exact module permissions
  const filteredTabs = TABS.filter(tab => {
    const restrictedTabs = ["events", "pdf_fields", "scanner_control"];
    if (!isSuperAdmin && restrictedTabs.includes(tab.id)) return false;
    
    // Full access to QR System grants access to everything not restricted above
    if (hasExactModuleAccess("/admin/qr-system")) return true;
    
    // Check specific sub-module permissions
    if (tab.id === "booking" && hasExactModuleAccess("/admin/qr-system/booking")) return true;
    if (tab.id === "live_scores" && hasExactModuleAccess("/admin/qr-system/live-scores")) return true;
    if (tab.id === "photos" && (isSuperAdmin || hasExactModuleAccess("/admin/events"))) return true;
    
    return false;
  });

  const [activeTab, setActiveTab] = useState(filteredTabs.length > 0 ? filteredTabs[0].id : "");

  React.useEffect(() => {
    if (filteredTabs.length > 0 && !filteredTabs.find(t => t.id === activeTab)) {
      setActiveTab(filteredTabs[0].id);
    }
  }, [filteredTabs, activeTab]);

  return (
    <div id="qr-system-v3-tab" className="space-y-6">
      {/* Optimized Tab Navigation - High-Density Admin Layout */}
      <div className="flex gap-1 bg-base-alt backdrop-blur-md border border-border rounded-xl p-1.5 shadow-2xl overflow-x-auto">
        {filteredTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2.5 flex-1 px-4 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all duration-300 ${
                isActive
                  ? "bg-primary-600 text-white shadow-lg border border-primary-500/30"
                  : "text-muted hover:text-main hover:bg-base"
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
          <GlobalBroadcastPanel eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "events" && isSuperAdmin && (
          <SportEventsManager eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "pdf_fields" && isSuperAdmin && (
          <FormFieldSettings eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "event_pdfs" && (
          <EventPdfSlots eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "official_docs" && (
          <OfficialDocumentsTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "technical_docs" && (
          <TechnicalDocumentsTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "safety_docs" && (
          <EmergencyDocumentsTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        { activeTab === "feedback" && (
          <FeedbackSetupTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "booking" && (
          <BookingSetupTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "photos" && (
          <EventPhotosTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "scanner_control" && isSuperAdmin && (
          <ZoneScannerTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
        {activeTab === "live_scores" && (
          <LiveScoresTab eventId={eventId} onToast={onToast} disabled={isViewer} />
        )}
      </div>
    </div>
  );
}
