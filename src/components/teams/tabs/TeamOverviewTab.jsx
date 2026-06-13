import React, { useState } from "react";
import { User, Phone, Mail, MapPin, Building2, Save } from "lucide-react";
import Card, { CardContent, CardHeader } from "../../ui/Card";
import Button from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { TeamAPI } from "../../../services/teamApi";

export default function TeamOverviewTab({ team, isAdmin, onTeamUpdate }) {
  const [notes, setNotes] = useState(team?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const handleSaveNotes = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const updated = await TeamAPI.updateTeamNotes(team.id, notes);
      toast.success("Notes saved successfully");
      onTeamUpdate(updated);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  if (!team) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Contact & Location Info */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader title="Contact Information" icon={User} />
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Primary Contact</p>
              <p className="text-main font-medium">{team.contact_name || "Not specified"}</p>
            </div>
            {team.contact_email && (
              <div>
                <p className="text-sm font-medium text-muted mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email
                </p>
                <a href={`mailto:${team.contact_email}`} className="text-primary-500 hover:underline">
                  {team.contact_email}
                </a>
              </div>
            )}
            {team.contact_phone && (
              <div>
                <p className="text-sm font-medium text-muted mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </p>
                <a href={`tel:${team.contact_phone}`} className="text-primary-500 hover:underline">
                  {team.contact_phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Location Details" icon={MapPin} />
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Country</p>
              <p className="text-main">{team.country || "Not specified"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted mb-1">City / Emirate</p>
              <p className="text-main">{team.city || "Not specified"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Internal Notes */}
      <div className="lg:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader title="Internal Admin Notes" icon={Building2} />
          <CardContent className="p-4 flex-1 flex flex-col">
            <p className="text-sm text-muted mb-3">
              These notes are strictly for Global/Event Admin use and are not visible to the team members.
            </p>
            
            {isAdmin ? (
              <div className="flex-1 flex flex-col gap-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add administrative notes here..."
                  className="w-full flex-1 bg-base-alt border border-border rounded-xl p-4 text-main focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none transition-all min-h-[200px]"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveNotes} 
                    loading={isSaving} 
                    icon={Save}
                    disabled={notes === (team.notes || "")}
                  >
                    Save Notes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full flex-1 bg-base-alt/50 border border-border rounded-xl p-4 text-main min-h-[200px] whitespace-pre-wrap">
                {team.notes || <span className="text-muted italic">No notes available.</span>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
