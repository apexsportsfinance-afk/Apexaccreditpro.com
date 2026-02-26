import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Shield,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  MapPin,
  Flag,
  Building,
  Loader2,
  Waves
} from "lucide-react";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import { AccreditationsAPI, EventsAPI, ZonesAPI } from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import { getCountryName, calculateAge, formatDate, isExpired } from "../../lib/utils";

export default function VerifyAccreditation() {
  const { id } = useParams();
  const [accreditation, setAccreditation] = useState(null);
  const [event, setEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        let acc = null;

        const { data: byAccId } = await supabase
          .from("accreditations")
          .select("*")
          .eq("accreditation_id", id)
          .maybeSingle();

        if (byAccId) {
          acc = mapFromDB(byAccId);
        } else {
          const { data: byBadge } = await supabase
            .from("accreditations")
            .select("*")
            .eq("badge_number", id)
            .maybeSingle();

          if (byBadge) {
            acc = mapFromDB(byBadge);
          } else {
            const { data: byUuid } = await supabase
              .from("accreditations")
              .select("*")
              .eq("id", id)
              .maybeSingle();

            if (byUuid) {
              acc = mapFromDB(byUuid);
            }
          }
        }

        if (!acc) {
          setError("Accreditation not found. The QR code may be invalid.");
          setLoading(false);
          return;
        }

        setAccreditation(acc);

        if (acc.eventId) {
          const eventData = await EventsAPI.getById(acc.eventId);
          setEvent(eventData);
          const zonesData = await ZonesAPI.getByEventId(acc.eventId);
          setZones(zonesData);
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError("Failed to verify accreditation. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const mapFromDB = (db) => ({
    id: db.id,
    eventId: db.event_id,
    firstName: db.first_name,
    lastName: db.last_name,
    gender: db.gender,
    dateOfBirth: db.date_of_birth,
    nationality: db.nationality,
    club: db.club,
    role: db.role,
    email: db.email,
    photoUrl: db.photo_url,
    status: db.status,
    zoneCode: db.zone_code,
    badgeNumber: db.badge_number,
    accreditationId: db.accreditation_id,
    expiresAt: db.expires_at,
    createdAt: db.created_at
  });

  const expired = accreditation ? isExpired(accreditation.expiresAt) : false;
  const zoneCodes = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
  const countryName = accreditation ? getCountryName(accreditation.nationality) : "";
  const age = accreditation?.dateOfBirth && event?.ageCalculationYear
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
    : null;

  if (loading) {
    return (
      <SwimmingBackground>
        <div id="verify_loading" className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
            <p className="text-lg text-cyan-600">Verifying accreditation...</p>
          </div>
        </div>
      </SwimmingBackground>
    );
  }

  if (error || !accreditation) {
    return (
      <SwimmingBackground>
        <div id="verify_error" className="min-h-screen flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Verification Failed</h1>
            <p className="text-lg text-slate-500">{error || "Accreditation not found."}</p>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  const isApproved = accreditation.status === "approved";

  return (
    <SwimmingBackground>
      <div id="verify_page" className="min-h-screen py-8 px-4">
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className={`rounded-2xl overflow-hidden shadow-2xl border-2 ${expired ? "border-red-400" : isApproved ? "border-emerald-400" : "border-amber-400"}`}>
              <div className={`p-6 text-center text-white ${expired ? "bg-gradient-to-r from-red-600 to-red-700" : isApproved ? "bg-gradient-to-r from-emerald-600 to-cyan-600" : "bg-gradient-to-r from-amber-500 to-orange-500"}`}>
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  {expired ? (
                    <AlertCircle className="w-8 h-8 text-white" />
                  ) : isApproved ? (
                    <CheckCircle className="w-8 h-8 text-white" />
                  ) : (
                    <Shield className="w-8 h-8 text-white" />
                  )}
                </div>
                <h1 className="text-2xl font-bold">
                  {expired ? "EXPIRED" : isApproved ? "VERIFIED" : accreditation.status?.toUpperCase()}
                </h1>
                <p className="text-lg text-white/80 mt-1">Accreditation {expired ? "has expired" : isApproved ? "is valid" : "is " + accreditation.status}</p>
              </div>

              <div className="bg-white p-6 space-y-5">
                <div className="flex items-center gap-4">
                  {accreditation.photoUrl ? (
                    <img src={accreditation.photoUrl} alt="Photo" className="w-20 h-24 rounded-lg object-cover border-2 border-slate-200" />
                  ) : (
                    <div className="w-20 h-24 rounded-lg bg-slate-100 flex items-center justify-center">
                      <User className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {accreditation.firstName} {accreditation.lastName}
                    </h2>
                    <span className="inline-block mt-1 px-3 py-1 rounded-full text-lg font-bold text-white bg-blue-600">
                      {accreditation.role}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={Building} label="Club" value={accreditation.club} />
                  <InfoRow icon={Flag} label="Country" value={countryName} />
                  {age !== null && <InfoRow icon={User} label="Age" value={`${age} years`} />}
                  <InfoRow icon={User} label="Gender" value={accreditation.gender} />
                  <InfoRow icon={Calendar} label="ID" value={accreditation.accreditationId || "---"} />
                  <InfoRow icon={Shield} label="Badge" value={accreditation.badgeNumber || "---"} />
                </div>

                {event && (
                  <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Waves className="w-5 h-5 text-cyan-600" />
                      <h3 className="text-lg font-bold text-cyan-800">Event</h3>
                    </div>
                    <p className="text-lg font-medium text-slate-800">{event.name}</p>
                    <p className="text-lg text-slate-500">{event.location}</p>
                    <p className="text-lg text-slate-500">{formatDate(event.startDate)} - {formatDate(event.endDate)}</p>
                  </div>
                )}

                {zoneCodes.length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Access</h3>
                    <div className="flex flex-wrap gap-2">
                      {zoneCodes.map((code, i) => {
                        const zoneInfo = zones.find(z => z.code === code);
                        return (
                          <span key={i} className="px-3 py-1 rounded-md text-lg font-bold text-white bg-slate-700">
                            {code}{zoneInfo ? ` - ${zoneInfo.name}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {accreditation.expiresAt && (
                  <p className={`text-lg text-center font-medium ${expired ? "text-red-600" : "text-emerald-600"}`}>
                    {expired ? "Expired: " : "Valid until: "}{formatDate(accreditation.expiresAt)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SwimmingBackground>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
      <div>
        <p className="text-lg text-slate-400">{label}</p>
        <p className="text-lg font-medium text-slate-800">{value || "---"}</p>
      </div>
    </div>
  );
}
