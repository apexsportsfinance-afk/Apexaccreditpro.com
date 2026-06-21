import React, { useState } from "react";
import { Calendar, Search, X } from "lucide-react";

export default function EventScheduleDropdown({ sportEvents, selectedSportEvents, setSelectedSportEvents }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = sportEvents.filter(ev =>
    ev.eventName.toLowerCase().includes(search.toLowerCase()) ||
    (ev.eventCode && ev.eventCode.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleEvent = (ev) => {
    const isSelected = selectedSportEvents.some(s => s.eventCode === ev.eventCode);
    setSelectedSportEvents(prev =>
      isSelected
        ? prev.filter(s => s.eventCode !== ev.eventCode)
        : [...prev, ev]
    );
  };

  return (
    <div className="space-y-3 relative z-[1]">
      <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-primary-500" />
        Event Schedule
      </h2>
      <p className="text-lg text-muted font-extralight">
        Select the events you want to participate in:
      </p>

      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border-2 border-border bg-base text-left flex items-center justify-between transition-all hover:border-primary-500/50 focus:ring-2 focus:ring-primary-500/30"
      >
        <span className="text-main font-medium text-lg">
          {selectedSportEvents.length > 0
            ? `${selectedSportEvents.length} event${selectedSportEvents.length !== 1 ? "s" : ""} selected`
            : "Tap to select events"
          }
        </span>
        <div className="flex items-center gap-2">
          {selectedSportEvents.length > 0 && (
            <span className="bg-primary-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
              {selectedSportEvents.length}
            </span>
          )}
          <svg className={`w-5 h-5 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="border-2 border-border rounded-xl bg-base overflow-hidden shadow-xl">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-base-alt">
            <Search className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-lg text-main placeholder-muted focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-1 text-muted hover:text-main">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Event List */}
          <div className="relative">
            <div className="max-h-52 overflow-y-auto overscroll-contain divide-y divide-border">
              {filtered.length > 0 ? filtered.map((ev, i) => {
                const isSelected = selectedSportEvents.some(s => s.eventCode === ev.eventCode);
                return (
                  <div
                    key={ev.id || i}
                    onClick={() => toggleEvent(ev)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-primary-500/10 ${
                      isSelected
                        ? "bg-primary-500/5"
                        : "hover:bg-base-alt"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary-500 bg-primary-500"
                        : "border-border bg-base"
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {ev.eventCode && (
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">{ev.eventCode}</span>
                        )}
                        <span className={`text-lg truncate ${isSelected ? "text-primary-600 dark:text-primary-400 font-medium" : "text-main font-normal"}`}>
                          {ev.eventName}
                        </span>
                      </div>
                      {(ev.gender || ev.date) && (
                        <p className="text-sm text-muted mt-0.5">
                          {[ev.gender, ev.date].filter(Boolean).join(" • ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="px-4 py-6 text-center text-muted text-lg">
                  No events matching "{search}"
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-base-alt flex items-center justify-between">
            <span className="text-sm text-muted">
              {filtered.length} event{filtered.length !== 1 ? "s" : ""} available
            </span>
            {selectedSportEvents.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSportEvents([])}
                className="text-sm text-red-500 hover:text-red-600 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Events Chips */}
      {selectedSportEvents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSportEvents.map(ev => (
            <span
              key={ev.eventCode}
              className="inline-flex items-center gap-1 bg-primary-500/10 text-primary-700 dark:text-primary-400 text-sm font-medium pl-3 pr-1.5 py-1.5 rounded-full border border-primary-500/20"
            >
              {ev.eventCode ? `${ev.eventCode} – ` : ""}{ev.eventName}
              <button
                type="button"
                onClick={() => toggleEvent(ev)}
                className="p-0.5 rounded-full hover:bg-primary-500/20 transition-colors ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
