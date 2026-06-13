import React from 'react';
import TeamRosterList from '../roster/TeamRosterList';

export default function PortalRosterTab({ teamId, userRole }) {
  return (
    <div className="space-y-6">
      <div className="bg-base border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border bg-base-alt/50">
          <h2 className="text-lg font-bold text-main">Team Roster</h2>
          <p className="text-muted text-sm mt-1">
            Manage your team's assigned athletes and staff members.
          </p>
        </div>
        
        <div className="p-6">
          <TeamRosterList teamId={teamId} userRole={userRole} />
        </div>
      </div>
    </div>
  );
}
