import React, { useState } from "react";
import { MessageSquare, Calendar, FileText } from "lucide-react";
import CustomMessagePanel from "./CustomMessagePanel";
import AthleteEventsSelector from "./AthleteEventsSelector";
import DualPdfSlots from "./DualPdfSlots";

const TABS = [
  { id: "events", label: "Events", icon: Calendar },
  { id: "message", label: "QR Message", icon: MessageSquare },
  { id: "pdfs", label: "PDFs", icon: FileText }
];

export default function AthleteV3Fields({
  accreditation,
  eventId,
  meetFirstDay,
  onFieldUpdate,
  onToast,
  isAthleteRole = true
}) {
  const [activeTab, setActiveTab] = useState(isAthleteRole ? "events" : "message");
  const [localData, setLocalData] = useState(accreditation || {});

  const handleUpdate = (updates) => {
    setLocalData(prev => ({ ...prev, ...updates }));
    onFieldUpdate?.(updates);
  };

  const tabs = isAthleteRole ? TABS : TABS.filter(t => t.id !== "events");

  return (
    <div id="athlete-v3-fields" className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {tabs.map(tab => {
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

      {/* Events tab — Athlete only */}
      {activeTab === "events" && isAthleteRole && (
        <AthleteEventsSelector
          accreditationId={localData.id}
          eventId={eventId}
          dateOfBirth={localData.date_of_birth}
          meetFirstDay={meetFirstDay}
          selectedEvents={localData.selected_events}
          onUpdated={evs => handleUpdate({ selected_events: evs })}
          onToast={onToast}
        />
      )}

      {/* Custom message tab */}
      {activeTab === "message" && (
        <CustomMessagePanel
          accreditationId={localData.id}
          initialMessage={localData.custom_message}
          onSaved={msg => handleUpdate({ custom_message: msg })}
          onToast={onToast}
        />
      )}

      {/* PDFs tab */}
      {activeTab === "pdfs" && (
        <DualPdfSlots
          accreditationId={localData.id}
          heatSheetUrl={localData.heat_sheet_url}
          heatSheetUpdatedAt={localData.heat_sheet_updated_at}
          eventResultUrl={localData.event_result_url}
          eventResultUpdatedAt={localData.event_result_updated_at}
          onUpdated={updates => handleUpdate(updates)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
