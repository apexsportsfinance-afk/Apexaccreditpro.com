import React, { useState, useEffect } from "react";
import { Settings, GripVertical, Eye, EyeOff } from "lucide-react";
import { FormFieldSettingsAPI } from "../../lib/broadcastApi";

const FIELD_DEFINITIONS = [
  { key: "events", label: "Events (Age-filtered)", defaultLocation: "qr" },
  { key: "heat_sheet_pdf", label: "Heat Sheet PDF", defaultLocation: "both" },
  { key: "event_result_pdf", label: "Event Result PDF", defaultLocation: "both" },
  { key: "global_message", label: "Global Broadcast Message", defaultLocation: "both" },
  { key: "custom_message", label: "Custom Athlete Message", defaultLocation: "both" }
];

const LOCATIONS = [
  { value: "hidden", label: "Hidden" },
  { value: "card", label: "Card only" },
  { value: "qr", label: "QR only" },
  { value: "both", label: "Both (Card + QR)" }
];

export default function FormFieldSettings({ eventId, onToast }) {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (eventId) loadSettings();
  }, [eventId]);

  const loadSettings = async () => {
    const existing = await FormFieldSettingsAPI.getByEventId(eventId);
    const merged = {};
    FIELD_DEFINITIONS.forEach(f => {
      merged[f.key] = existing[f.key] || f.defaultLocation;
    });
    setSettings(merged);
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await FormFieldSettingsAPI.save(eventId, settings);
      onToast?.("Field visibility settings saved", "success");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="form-field-settings" className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-extralight text-white">Form Field Visibility</h3>
      </div>
      <p className="text-gray-400 font-extralight text-lg mb-4">
        Control where each field appears — on the physical card, the QR scan page, both, or hidden.
      </p>

      <div className="space-y-3">
        {FIELD_DEFINITIONS.map(field => (
          <div key={field.key} className="flex items-center gap-4 bg-gray-800 rounded-lg px-4 py-3 border border-gray-700">
            <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-white font-extralight text-lg">{field.label}</span>
            </div>
            <select
              value={settings[field.key] || field.defaultLocation}
              onChange={e => updateSetting(field.key, e.target.value)}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white font-extralight text-lg focus:outline-none focus:border-orange-500 min-w-[160px]"
            >
              {LOCATIONS.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
            <div className="w-8 flex justify-center">
              {settings[field.key] === "hidden"
                ? <EyeOff className="w-4 h-4 text-gray-600" />
                : <Eye className="w-4 h-4 text-gray-400" />
              }
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors mt-4"
      >
        <Settings className="w-4 h-4" />
        {saving ? "Saving..." : "Save Visibility Settings"}
      </button>
    </div>
  );
}
