import React, { useState } from "react";
import { MessageSquare, Calendar, Settings, FileText } from "lucide-react";
import GlobalBroadcastPanel from "./GlobalBroadcastPanel";
import SportEventsManager from "./SportEventsManager";
import FormFieldSettings from "./FormFieldSettings";
import EventPdfSlots from "./EventPdfSlots";

const TABS = [
  { id: "broadcast", label: "Broadcast Message", icon: MessageSquare },
  { id: "event_pdfs", label: "Event Result PDF", icon: FileText },
  { id: "events", label: "Sport Events", icon: Calendar },
  { id: "pdf_fields", label: "Field Visibility", icon: Settings }
];

export default function QRSystemV3Tab({ eventId, onToast }) {
  const [activeTab, setActiveTab] = useState("broadcast");

  return (
    <div id="qr-system-v3-tab" className="space-y-4">
      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 flex-1 px-3 py-2 rounded font-extralight text-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
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
  );
}
