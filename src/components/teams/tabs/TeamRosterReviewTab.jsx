import React from 'react';
import AdminRosterList from '../roster/AdminRosterList';

export default function TeamRosterReviewTab({ teamId }) {
  return (
    <div className="space-y-6">
      <div className="bg-base border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border bg-base-alt/50">
          <h2 className="text-xl font-bold text-main">Team Roster Review</h2>
          <p className="text-muted text-sm mt-1">
            Review and approve roster mappings submitted by team managers.
          </p>
        </div>
        
        <div className="p-6">
          <AdminRosterList teamId={teamId} />
        </div>
      </div>
    </div>
  );
}
