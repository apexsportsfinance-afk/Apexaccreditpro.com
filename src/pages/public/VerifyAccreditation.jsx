import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Shield, Calendar, MapPin, User, Building, Flag, Award } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getCountryName, COUNTRIES, calculateAge, isExpired } from "../../lib/utils";
import SwimmingBackground from "../../components/ui/SwimmingBackground";

const InfoRow = ({ icon: Icon, label, value }) => {
  if (!value || value === "---") return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
      <div>
        <p className="text-lg text-slate-400">{label}</p>
        <p className="text-lg font-medium text-slate-800">{value || "---"}</p>
      </div>
    </div>
  );
};

export default function VerifyAccreditation() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [accreditation, setAccreditation] = useState(null);
  const [event, setEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState("loading");

  useEffect(() => {
    const verify = async () => {
      if (!id) {
        setError("No accreditation ID provided");
        setVerificationStatus("invalid");
        setLoading(false);
        return;
      }

      try {
        // First try by accreditation_id and badge_number (string columns)
        let accData = null;
        let accError = null;

        const { data: d1, error: e1 } = await supabase
          .from("accreditations")
          .select("*")
          .or(`accreditation_id.eq.${id},badge_number.eq.${id}`)
          .limit(1)
          .maybeSingle();

        if (d1) {
          accData = d1;
        } else {
          // If not found, try by UUID id (only if it looks like a valid UUID)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(id)) {
            const { data: d2, error: e2 } = await supabase
              .from("accreditations")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            accData = d2;
            accError = e2;
          } else {
            accError = e1;
          }
        }

        if (accError || !accData) {
          setError("Accreditation not found");
          setVerificationStatus("invalid");
          setLoading(false);
          return;
        }

        const formattedAcc = {
          id: accData.id,
          firstName: accData.first_name,
          lastName: accData.last_name,
          email: accData.email,
          dateOfBirth: accData.date_of_birth,
          gender: accData.gender,
          nationality: accData.nationality,
          club: accData.club,
          role: accData.role,
          zoneCode: accData.zone_code,
          photoUrl: accData.photo_url,
          status: accData.status,
          accreditationId: accData.accreditation_id,
          badgeNumber: accData.badge_number,
          eventId: accData.event_id,
          expiresAt: accData.expires_at,
          createdAt: accData.created_at,
        };

        setAccreditation(formattedAcc);

        if (formattedAcc.eventId) {
          const { data: eventData } = await supabase
            .from("events")
            .select("*")
            .eq("id", formattedAcc.eventId)
            .single();

          if (eventData) {
            setEvent({
              id: eventData.id,
              name: eventData.name,
              location: eventData.location,
              startDate: eventData.start_date,
              endDate: eventData.end_date,
              logoUrl: eventData.logo_url,
              ageCalculationYear: eventData.age_calculation_year,
            });
          }

          const { data: zonesData } = await supabase
            .from("zones")
            .select("*")
            .eq("event_id", formattedAcc.eventId);

          if (zonesData) {
            setZones(
              zonesData.map((z) => ({
                id: z.id,
                code: z.code,
                name: z.name,
                description: z.description,
                color: z.color,
              }))
            );
          }
        }

        if (formattedAcc.status === "revoked" || formattedAcc.status === "suspended") {
          setVerificationStatus("revoked");
        } else if (isExpired(formattedAcc.expiresAt)) {
          setVerificationStatus("expired");
        } else if (formattedAcc.status === "active" || formattedAcc.status === "approved") {
          setVerificationStatus("valid");
        } else {
          setVerificationStatus("pending");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError("An error occurred during verification");
        setVerificationStatus("invalid");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [id]);

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "valid":
        return {
          icon: CheckCircle,
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30",
          title: "Valid Accreditation",
          description: "This accreditation is active and verified.",
        };
      case "expired":
        return {
          icon: AlertTriangle,
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/30",
          title: "Expired Accreditation",
          description: "This accreditation has expired.",
        };
      case "revoked":
        return {
          icon: XCircle,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          title: "Revoked Accreditation",
          description: "This accreditation has been revoked or suspended.",
        };
      case "pending":
        return {
          icon: AlertTriangle,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/30",
          title: "Pending Accreditation",
          description: "This accreditation is pending approval.",
        };
      default:
        return {
          icon: XCircle,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          title: "Invalid Accreditation",
          description: error || "This accreditation could not be verified.",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const countryData = accreditation?.nationality
    ? COUNTRIES.find((c) => c.code === accreditation.nationality)
    : null;

  const age =
    accreditation?.dateOfBirth && event?.ageCalculationYear
      ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear)
      : null;

  const zoneCodes = accreditation?.zoneCode
    ? accreditation.zoneCode.split(",").map((z) => z.trim()).filter(Boolean)
    : [];

  if (loading) {
    return (
      <SwimmingBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
            <p className="text-lg text-slate-300">Verifying accreditation...</p>
          </div>
        </div>
      </SwimmingBackground>
    );
  }

  return (
    <SwimmingBackground>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Shield className="w-8 h-8 text-cyan-400" />
                <span className="text-2xl font-bold text-white">AccreditPro</span>
              </div>
            </Link>
            <h1 className="text-xl font-semibold text-white">Accreditation Verification</h1>
          </div>

          <div className={`rounded-2xl border ${statusConfig.borderColor} ${statusConfig.bgColor} p-6 mb-6`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full ${statusConfig.bgColor} flex items-center justify-center`}>
                <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${statusConfig.color}`}>{statusConfig.title}</h2>
                <p className="text-lg text-slate-300">{statusConfig.description}</p>
              </div>
            </div>
          </div>

          {accreditation && (
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden">
              {event?.logoUrl && (
                <div className="h-24 bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center p-4">
                  <img
                    src={event.logoUrl}
                    alt={event.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-24 h-28 rounded-lg overflow-hidden border-2 border-slate-200 flex-shrink-0">
                    {accreditation.photoUrl ? (
                      <img
                        src={accreditation.photoUrl}
                        alt="Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <User className="w-10 h-10 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900">
                      {accreditation.firstName} {accreditation.lastName}
                    </h3>
                    <div className="inline-block mt-2 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-lg font-medium">
                      {accreditation.role || "Participant"}
                    </div>
                    <p className="mt-2 text-lg text-slate-500">
                      ID: {accreditation.badgeNumber || accreditation.accreditationId?.split("-")?.pop() || "---"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 border-t border-slate-100 pt-4">
                  <InfoRow icon={Building} label="Club/Organization" value={accreditation.club} />
                  <InfoRow icon={User} label="Age" value={age ? `${age} years` : null} />
                  <InfoRow icon={User} label="Gender" value={accreditation.gender} />
                  <InfoRow
                    icon={Flag}
                    label="Nationality"
                    value={
                      countryData ? (
                        <span className="flex items-center gap-2">
                          <img
                            src={`https://flagcdn.com/w40/${countryData.flag}.png`}
                            alt=""
                            className="w-5 h-4 rounded"
                          />
                          {getCountryName(accreditation.nationality)}
                        </span>
                      ) : (
                        getCountryName(accreditation.nationality)
                      )
                    }
                  />
                  {event && (
                    <>
                      <InfoRow icon={Award} label="Event" value={event.name} />
                      <InfoRow icon={MapPin} label="Location" value={event.location} />
                      <InfoRow
                        icon={Calendar}
                        label="Event Dates"
                        value={
                          event.startDate && event.endDate
                            ? `${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`
                            : null
                        }
                      />
                    </>
                  )}
                </div>

                {zoneCodes.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <p className="text-lg text-slate-500 mb-3">Access Zones</p>
                    <div className="flex flex-wrap gap-2">
                      {zoneCodes.map((code, idx) => {
                        const zoneInfo = zones.find((z) => z.code === code);
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white"
                          >
                            <span className="font-bold text-lg">{code}</span>
                            {zoneInfo?.name && (
                              <span className="text-lg text-slate-300">- {zoneInfo.name}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {accreditation.expiresAt && (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <p className="text-lg text-slate-500">
                      {isExpired(accreditation.expiresAt) ? "Expired" : "Valid Until"}:{" "}
                      <span className="font-medium text-slate-700">
                        {new Date(accreditation.expiresAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center mt-8">
            <p className="text-lg text-slate-400">
              Verified at {new Date().toLocaleString()}
            </p>
            <Link to="/" className="text-lg text-cyan-400 hover:text-cyan-300 mt-2 inline-block">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </SwimmingBackground>
  );
}
