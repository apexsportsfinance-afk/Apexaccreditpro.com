import React, { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Check } from "lucide-react";
import { SportEventsAPI } from "../../lib/broadcastApi";
import { supabase } from "../../lib/supabase";

export default function AthleteEventsSelector({ accreditationId, eventId, dateOfBirth,
  meetFirstDay, selectedEvents, onUpdated, onToast, readOnly = false }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState(selectedEvents || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (eventId) loadEligible();
  }, [eventId, dateOfBirth, meetFirstDay]);

  useEffect(() => {
    setSelected(selectedEvents || []);
  }, [selectedEvents]);

  const loadEligible = async () => {
    setLoading(true);
    try {
      const evs = await SportEventsAPI.getEligibleForAthlete(eventId, dateOfBirth, meetFirstDay);
      setAvailable(evs);
    } catch { /* silent */ }
    setLoading(false);
  };

  const toggleEvent = (ev) => {
    if (readOnly) return;
    const exists = selected.find(s => s.eventCode === ev.eventCode);
    const updated = exists
      ? selected.filter(s => s.eventCode !== ev.eventCode)
      : [...selected, ev];
    setSelected(updated);
  };

  const saveSelections = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("accreditations")
        .update({ selected_events: selected })
        .eq("id", accreditationId);
      if (error) throw error;
      onUpdated?.(selected);
      onToast?.("Event selections saved", "success");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const isSelected = (ev) => selected.some(s => s.eventCode === ev.eventCode);

  if (loading) return <div className="text-gray-400 font-extralight text-lg py-2">Loading eligible events...</div>;
  if (available.length === 0) return (
    <div className="text-gray-500 font-extralight text-lg py-2">
      No events available. Upload events in the Admin panel first.
    </div>
  );

  return (
    <div id="athlete-events-selector" className="space-y-3">
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {available.map(ev => {
          const sel = isSelected(ev);
          return (
            <button
              key={ev.eventCode}
              onClick={() => toggleEvent(ev)}
              disabled={readOnly}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                sel
                  ? "bg-blue-900/40 border-blue-500"
                  : "bg-gray-800 border-gray-700 hover:border-gray-500"
              } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                sel ? "bg-blue-500" : "bg-gray-700"
              }`}>
                {sel && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-blue-300 font-extralight text-lg">{ev.eventCode}</span>
                  <span className="text-white font-extralight text-lg">{ev.eventName}</span>
                  {ev.gender && <span className="text-gray-400 font-extralight text-lg">({ev.gender})</span>}
                </div>
                <div className="flex flex-wrap gap-3 mt-1">
                  {ev.date && (
                    <span className="flex items-center gap-1 text-gray-400 font-extralight text-lg">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(ev.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                  {ev.startTime && (
                    <span className="flex items-center gap-1 text-gray-400 font-extralight text-lg">
                      <Clock className="w-3.5 h-3.5" /> {ev.startTime}
                    </span>
                  )}
                  {ev.session && (
                    <span className="text-gray-400 font-extralight text-lg">Session {ev.session}</span>
                  )}
                  {ev.venue && (
                    <span className="flex items-center gap-1 text-gray-400 font-extralight text-lg">
                      <MapPin className="w-3.5 h-3.5" /> {ev.venue}
                    </span>
                  )}
                  {(ev.ageMin !== null || ev.ageMax !== null) && (
                    <span className="text-gray-500 font-extralight text-lg">
                      Age {ev.ageMin || 0}–{ev.ageMax || "∞"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!readOnly && (
        <button
          onClick={saveSelections}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
        >
          {saving ? "Saving..." : `Save ${selected.length} Event${selected.length !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
