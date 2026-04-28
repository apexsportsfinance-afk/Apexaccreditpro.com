import React, { useState, useEffect } from "react";
import { MessageSquare, Save, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function CustomMessagePanel({ accreditationId, initialMessage, onSaved, onToast }) {
  const [message, setMessage] = useState(initialMessage || "");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMessage(initialMessage || "");
  }, [initialMessage, accreditationId]);

  const save = async () => {
    if (message.length > 1000) {
      onToast?.("Message exceeds 1000 characters", "error");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("accreditations")
        .update({
          custom_message: message || null,
          custom_message_updated_at: now
        })
        .eq("id", accreditationId);
      if (error) throw error;
      setUpdatedAt(now);
      onSaved?.(message);
      onToast?.("Custom message saved", "success");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const formatUTC = (ts) => ts ? new Date(ts).toUTCString().replace(" GMT", " UTC") : null;

  return (
    <div id="custom-message-panel" className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-extralight text-white">Custom QR Message</h3>
      </div>
      <p className="text-gray-400 font-extralight text-lg">
        Displayed on the QR scan page for this athlete only, above the global broadcast.
        Supports emoji and line breaks.
      </p>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        maxLength={1000}
        rows={5}
        placeholder="Enter a personal message for this athlete (optional)..."
        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white font-extralight text-lg resize-none focus:outline-none focus:border-purple-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-gray-500 font-extralight text-lg">{message.length}/1000</span>
        {updatedAt && (
          <span className="text-gray-500 font-extralight text-lg flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatUTC(updatedAt)}
          </span>
        )}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-extralight text-lg transition-colors"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving..." : "Save Message"}
      </button>
    </div>
  );
}
