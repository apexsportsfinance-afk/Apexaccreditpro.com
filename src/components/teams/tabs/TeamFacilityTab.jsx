import React, { useState, useEffect } from "react";
import { Building2, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import EmptyState from "../../ui/EmptyState";
import { TeamAPI } from "../../../services/teamApi";

const AMENITY_LABELS = {
  changing_rooms: "Changing Rooms",
  parking: "Parking Available",
  medical_room: "Medical Room",
  lighting: "Lighting Available",
};

export default function TeamFacilityTab({ teamId }) {
  const [answers, setAnswers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId) load();
  }, [teamId]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await TeamAPI.getTeamFacilityAnswers(teamId);
      setAnswers(data?.answers || null);
    } catch (err) {
      console.error(err);
      setError("Failed to load facility information.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading facility information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading facility information</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-main">Facility Hosting</h2>
          <p className="text-sm text-muted">Facility hosting answers submitted by the team.</p>
        </div>
        <Badge variant={answers?.has_facility ? "success" : "muted"}>
          {answers?.has_facility ? "Can Host Events" : "Cannot Host Events"}
        </Badge>
      </div>

      <Card className="p-6">
        {!answers || !answers.has_facility ? (
          <EmptyState
            icon={Building2}
            title="No Facility Information"
            description="This team has not indicated that they can host events, or has not yet submitted facility details."
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Facility Name" value={answers.facility_name} />
              <Field label="Location" value={answers.facility_location} />
              <Field label="Indoor / Outdoor" value={capitalize(answers.facility_type)} />
              <Field label="Seating Capacity" value={answers.seating_capacity} />
              <Field
                label="Courts / Fields / Pools"
                value={[answers.capacity_count, answers.capacity_unit].filter(Boolean).join(" ")}
              />
              <Field label="Available Timings" value={answers.available_timings} />
              <Field label="Facility Contact" value={answers.contact_name} />
              <Field label="Contact Phone" value={answers.contact_phone} />
            </div>

            {answers.sports_can_host?.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">
                  Sports This Facility Can Host
                </label>
                <div className="flex flex-wrap gap-2">
                  {answers.sports_can_host.map((sport) => (
                    <Badge key={sport} variant="muted">{sport}</Badge>
                  ))}
                </div>
              </div>
            )}

            {answers.available_days?.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">
                  Available Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {answers.available_days.map((day) => (
                    <Badge key={day} variant="muted">{day}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Amenities</label>
              <div className="flex flex-wrap gap-3">
                {Object.entries(AMENITY_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5 text-sm">
                    {answers[key] ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted" />
                    )}
                    <span className="text-main">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {answers.restrictions && (
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">
                  Restrictions / Notes
                </label>
                <p className="text-main whitespace-pre-wrap">{answers.restrictions}</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">{label}</label>
      <div className="text-main font-medium">{value || "-"}</div>
    </div>
  );
}

function capitalize(s) {
  if (!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
