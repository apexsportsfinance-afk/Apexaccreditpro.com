import React from 'react';
import { Building2 } from 'lucide-react';
import Card from '../../ui/Card';

export default function PortalOverviewTab({ team }) {
  if (!team) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-main">Team Overview</h2>
        <p className="text-sm text-muted">Basic information and primary contact for this team.</p>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className="shrink-0">
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="w-32 h-32 rounded-2xl object-cover border border-border bg-base" />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-base border border-border flex items-center justify-center">
                <Building2 className="w-12 h-12 text-muted" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">Team Name</label>
                <div className="text-main font-medium">{team.name}</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">Short Name</label>
                <div className="text-main font-medium">{team.short_name || '-'}</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">City</label>
                <div className="text-main font-medium">{team.city || '-'}</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">Country</label>
                <div className="text-main font-medium">{team.country || '-'}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block">Primary Contact</label>
              <div className="text-main font-medium">{team.contact_name || '-'}</div>
              {team.contact_email && (
                <div className="text-muted text-sm mt-1">{team.contact_email}</div>
              )}
              {team.contact_phone && (
                <div className="text-muted text-sm mt-0.5">{team.contact_phone}</div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
