import React, { useState, useEffect } from "react";
import { Save, ShieldAlert } from "lucide-react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import { useToast } from "../../ui/Toast";
import { TeamPortalAPI } from "../../../services/teamPortalApi";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const COMMON_SPORTS = ["Swimming", "Football", "Basketball", "Volleyball", "Athletics", "Table Tennis", "Tennis", "Badminton"];

const AMENITIES = [
  { key: "changing_rooms", label: "Changing Rooms" },
  { key: "parking", label: "Parking Available" },
  { key: "medical_room", label: "Medical Room" },
  { key: "lighting", label: "Lighting Available" },
];

const DEFAULT_ANSWERS = {
  has_facility: false,
  facility_name: "",
  facility_location: "",
  facility_type: "indoor",
  sports_can_host: [],
  capacity_count: "",
  capacity_unit: "",
  seating_capacity: "",
  changing_rooms: false,
  parking: false,
  medical_room: false,
  lighting: false,
  available_days: [],
  available_timings: "",
  restrictions: "",
  contact_name: "",
  contact_phone: "",
};

export default function PortalFacilityTab({ teamId, eventId, userRole }) {
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  const canEdit = userRole === "admin" || userRole === "manager";

  useEffect(() => {
    if (teamId) load();
  }, [teamId]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await TeamPortalAPI.getPortalFacilityAnswers(teamId);
      if (data?.answers) {
        setAnswers({ ...DEFAULT_ANSWERS, ...data.answers });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load facility information.");
    } finally {
      setLoading(false);
    }
  };

  const update = (field, value) => setAnswers((prev) => ({ ...prev, [field]: value }));

  const toggleArrayValue = (field, value) => {
    setAnswers((prev) => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...answers,
        capacity_count: answers.capacity_count === "" ? null : Number(answers.capacity_count),
        seating_capacity: answers.seating_capacity === "" ? null : Number(answers.seating_capacity),
      };
      await TeamPortalAPI.saveFacilityAnswers(teamId, eventId, payload);
      setAnswers(payload);
      toast.success("Facility information saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save facility information");
    } finally {
      setSaving(false);
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
      <div>
        <h2 className="text-lg font-bold text-main">Facility Hosting</h2>
        <p className="text-sm text-muted">
          Tell us whether your organization can host events, and provide details about your facilities.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!answers.has_facility}
            disabled={!canEdit}
            onChange={(e) => update("has_facility", e.target.checked)}
            className="w-5 h-5 rounded border-border accent-primary-500"
          />
          <span className="text-main font-medium">
            Our organization has sports facilities available to host events
          </span>
        </label>

        {answers.has_facility && (
          <div className="space-y-6 pt-2 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <Input
                label="Facility Name"
                value={answers.facility_name}
                disabled={!canEdit}
                onChange={(e) => update("facility_name", e.target.value)}
              />
              <Input
                label="Facility Location / Address"
                value={answers.facility_location}
                disabled={!canEdit}
                onChange={(e) => update("facility_location", e.target.value)}
              />
              <Select
                label="Indoor / Outdoor"
                value={answers.facility_type}
                disabled={!canEdit}
                onChange={(e) => update("facility_type", e.target.value)}
                options={[
                  { value: "indoor", label: "Indoor" },
                  { value: "outdoor", label: "Outdoor" },
                  { value: "both", label: "Both" },
                ]}
              />
              <Input
                label="Seating Capacity"
                type="number"
                min="0"
                value={answers.seating_capacity}
                disabled={!canEdit}
                onChange={(e) => update("seating_capacity", e.target.value)}
              />
              <Input
                label="Number of Courts / Fields / Pools"
                type="number"
                min="0"
                value={answers.capacity_count}
                disabled={!canEdit}
                onChange={(e) => update("capacity_count", e.target.value)}
              />
              <Input
                label="Unit Type (e.g. Courts, Fields, Pools)"
                value={answers.capacity_unit}
                disabled={!canEdit}
                onChange={(e) => update("capacity_unit", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-main mb-2">Sports This Facility Can Host</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SPORTS.map((sport) => (
                  <button
                    type="button"
                    key={sport}
                    disabled={!canEdit}
                    onClick={() => toggleArrayValue("sports_can_host", sport)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      answers.sports_can_host?.includes(sport)
                        ? "bg-primary-500/10 border-primary-500 text-primary-500"
                        : "border-border text-muted hover:text-main"
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AMENITIES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!answers[key]}
                    disabled={!canEdit}
                    onChange={(e) => update(key, e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary-500"
                  />
                  <span className="text-sm text-main">{label}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-lg font-medium text-main mb-2">Available Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    type="button"
                    key={day}
                    disabled={!canEdit}
                    onClick={() => toggleArrayValue("available_days", day)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      answers.available_days?.includes(day)
                        ? "bg-primary-500/10 border-primary-500 text-primary-500"
                        : "border-border text-muted hover:text-main"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Available Timings"
                placeholder="e.g. 4 PM - 10 PM"
                value={answers.available_timings}
                disabled={!canEdit}
                onChange={(e) => update("available_timings", e.target.value)}
              />
              <Input
                label="Facility Contact Person"
                value={answers.contact_name}
                disabled={!canEdit}
                onChange={(e) => update("contact_name", e.target.value)}
              />
              <Input
                label="Facility Contact Phone"
                value={answers.contact_phone}
                disabled={!canEdit}
                onChange={(e) => update("contact_phone", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-main mb-2">Restrictions / Notes</label>
              <textarea
                value={answers.restrictions}
                disabled={!canEdit}
                onChange={(e) => update("restrictions", e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border text-lg bg-base border-border text-main focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none disabled:opacity-60"
              />
            </div>

            <p className="text-sm text-muted">
              To upload facility photos or supporting documents, use the <strong>Documents</strong> tab.
            </p>
          </div>
        )}

        {canEdit ? (
          <div className="flex justify-end pt-2 border-t border-border">
            <Button onClick={handleSave} loading={saving} icon={Save}>
              Save Facility Information
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted italic">Only Team Admins and Managers can edit facility information.</p>
        )}
      </Card>
    </div>
  );
}
