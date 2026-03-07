import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle, XCircle, Download, Calendar,
  MessageSquare, Globe, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GlobalSettingsAPI, EventSettingsAPI, FormFieldSettingsAPI } from "../../lib/broadcastApi";
import { computeExpiryStatus, formatEventDateTime } from "../../lib/expiryUtils";

export default function VerifyAccreditation() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [eventSettings, setEventSettings] = useState({});
  const [fieldSettings, setFieldSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extraExpanded, setExtraExpanded] = useState(false);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Determine if the id param looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      let accData, accErr;

      if (isUUID) {
        // Could be a real UUID — try accreditation_id first (text), then id (uuid)
        const byAcc = await supabase
          .from("accreditations")
          .select("*, events:event_id(name, start_date, logo_url)")
          .eq("accreditation_id", id)
          .limit(1)
          .maybeSingle();
        if (byAcc.data) {
          accData = byAcc.data;
        } else {
          const byId = await supabase
            .from("accreditations")
            .select("*, events:event_id(name, start_date, logo_url)")
            .eq("id", id)
            .limit(1)
            .maybeSingle();
          accData = byId.data;
          accErr = byId.error;
        }
      } else {
        // Non-UUID string (e.g. ACC-2025-31763C07) — query only the text accreditation_id column
        const result = await supabase
          .from("accreditations")
          .select("*, events:event_id(name, start_date, logo_url)")
          .eq("accreditation_id", id)
          .limit(1)
          .maybeSingle();
        accData = result.data;
        accErr = result.error;
      }
      if (accErr) throw accErr;
      if (!accData) throw new Error("Accreditation not found");

      const [eSettings, fieldSets] = await Promise.all([
        accData?.event_id
          ? EventSettingsAPI.getAll(accData.event_id)
          : Promise.resolve({}),
        accData?.event_id
          ? FormFieldSettingsAPI.getByEventId(accData.event_id)
          : Promise.resolve({})
      ]);

      setData(accData);
      setEventSettings(eSettings);
      setFieldSettings(fieldSets || {});
    } catch (err) {
      setError(err.message || "Accreditation not found");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ScanSkeleton />;
  if (error || !data) return <ScanError error={error} />;

  const expiry = computeExpiryStatus(data);
  const selectedEvents = Array.isArray(data.selected_events) ? data.selected_events : [];
  const customMessage = data.custom_message;

  // Use athlete-specific broadcast if they are an athlete, otherwise use the general event broadcast
  const eventBroadcast = data.role === "Athlete"
    ? (eventSettings["athlete_qr_broadcast_message"] || eventSettings["broadcast_message"])
    : eventSettings["broadcast_message"];

  const eventPdfUrl = eventSettings["pdf_url"];
  const eventResultPdfUrl = eventSettings["event_result_pdf_url"];

  const showForQR = (key) => {
    const loc = fieldSettings[key] || "both";
    return loc === "both" || loc === "qr";
  };

  const visibleEvents = extraExpanded ? selectedEvents : selectedEvents.slice(0, 5);
  const hasMoreEvents = selectedEvents.length > 5;

  return (
    <div id="verify-accreditation-page" className="min-h-screen bg-gray-950 flex items-start justify-center py-4 px-3">
      <div className="w-full max-w-lg space-y-3">

        {data.events?.banner_url && (
          <div className="rounded-lg overflow-hidden w-full" style={{ maxHeight: 120 }}>
            <img src={data.events.banner_url} alt="Event banner" className="w-full object-cover" />
          </div>
        )}

        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
          expiry.isExpired
            ? "bg-red-900/30 border-red-600"
            : "bg-green-900/30 border-green-600"
        }`}>
          <div className="flex items-center gap-2">
            {expiry.isExpired
              ? <XCircle className="w-6 h-6 text-red-400" />
              : <CheckCircle className="w-6 h-6 text-green-400" />
            }
            <span className={`text-xl font-extralight ${expiry.isExpired ? "text-red-300" : "text-green-300"}`}>
              {expiry.label}
            </span>
            {data.force_live && (
              <span className="text-yellow-400 font-extralight text-lg ml-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Override
              </span>
            )}
          </div>
          <span className="text-gray-400 font-extralight text-lg">{data.events?.name || "Unknown Event"}</span>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <div className="flex gap-4">
            {data.photo_url && (
              <div className="relative flex-shrink-0">
                <img
                  src={data.photo_url}
                  alt={data.first_name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                {expiry.isExpired && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-900/40">
                    <span className="text-red-400 font-bold border-2 border-red-500 px-1.5 py-0.5 rotate-[-25deg] text-lg">
                      EXPIRED
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-white text-xl font-extralight">
                {data.first_name} {data.last_name}
              </h1>
              <div className="mt-2 space-y-1">
                <InfoRow label="Role" value={data.role} />
                <InfoRow label="ID" value={data.badge_number} mono />
                {data.club && <InfoRow label="Club" value={data.club} />}
                {data.nationality && <InfoRow label="Country" value={data.nationality} />}
                {data.date_of_birth && (
                  <InfoRow label="DOB" value={new Date(data.date_of_birth).toLocaleDateString("en-GB")} />
                )}
              </div>
            </div>
            {data.events?.logo_url && (
              <img src={data.events.logo_url} alt="Event logo" className="w-16 h-16 object-contain flex-shrink-0 self-start" />
            )}
          </div>

          {/* Zone codes from zone_code field (comma-separated like "A,B,C") */}
          {data.zone_code && (() => {
            const codes = data.zone_code.split(",").map(z => z.trim()).filter(Boolean);
            return codes.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {codes.map((code, i) => (
                  <span key={i} className="px-3 py-1 rounded font-extralight text-lg text-white bg-gray-700">
                    {code}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        {data.role === "Athlete" && selectedEvents.length > 0 && showForQR("events") && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h2 className="text-white font-extralight text-lg mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Events ({selectedEvents.length})
            </h2>
            <div className="space-y-2">
              {visibleEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 bg-gray-800 rounded px-3 py-2">
                  <span className="text-blue-300 font-extralight text-lg flex-shrink-0">{ev.eventCode}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-extralight text-lg">{ev.eventName}</span>
                    {formatEventDateTime(ev) && (
                      <p className="text-gray-400 font-extralight text-lg mt-0.5">{formatEventDateTime(ev)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hasMoreEvents && (
              <button
                onClick={() => setExtraExpanded(!extraExpanded)}
                className="mt-2 flex items-center gap-1 text-gray-400 hover:text-white font-extralight text-lg transition-colors"
              >
                {extraExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {extraExpanded ? "Show less" : `+${selectedEvents.length - 5} more events`}
              </button>
            )}
          </div>
        )}

        {customMessage && showForQR("custom_message") && (
          <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 font-extralight text-lg">Personal Message</span>
            </div>
            <p className="text-white font-extralight text-lg whitespace-pre-wrap">{customMessage}</p>
          </div>
        )}

        {eventBroadcast && showForQR("global_message") && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-extralight text-lg">Broadcast</span>
            </div>
            <p className="text-white font-extralight text-lg whitespace-pre-wrap">{eventBroadcast}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {data.heat_sheet_url && showForQR("heat_sheet_pdf") && (
            <a
              href={data.heat_sheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-extralight text-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Heat Sheet
            </a>
          )}
          {data.event_result_url && showForQR("event_result_pdf") && (
            <a
              href={data.event_result_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-extralight text-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Event Result
            </a>
          )}
          {eventPdfUrl && showForQR("global_pdf") && (
            <a
              href={eventPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-extralight text-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Official Document
            </a>
          )}
          {eventResultPdfUrl && showForQR("global_pdf") && (
            <a
              href={eventResultPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-extralight text-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Event Results
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 font-extralight text-lg w-16 flex-shrink-0">{label}</span>
      <span className={`text-gray-200 font-extralight text-lg ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ScanSkeleton() {
  return (
    <div id="verify-skeleton" className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 font-extralight text-xl animate-pulse">Loading accreditation...</div>
    </div>
  );
}

function ScanError({ error }) {
  return (
    <div id="verify-error" className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-white text-xl font-extralight mb-2">Accreditation not found</h2>
        <p className="text-gray-400 font-extralight text-lg">{error || "Please check the QR code and try again."}</p>
      </div>
    </div>
  );
}
