import React from 'react';
import { CheckCircle2, Clock, MinusCircle } from 'lucide-react';

export default function AttendanceBadge({ athletesCount = 0, coachesCount = 0, time }) {
  const isPresent = athletesCount > 0 || coachesCount > 0;

  if (isPresent) {
    return (
      <div className="flex flex-col items-start gap-1.5 group-hover:-translate-y-0.5 transition-transform duration-300">
        {athletesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold tracking-wide shadow-lg shadow-emerald-900/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {athletesCount} Athlete{athletesCount !== 1 ? 's' : ''} Present
          </span>
        )}
        
        {coachesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-500/20 to-blue-400/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-bold tracking-wide shadow-lg shadow-blue-900/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {coachesCount} Staff Present
          </span>
        )}

        {time && (
          <span className="text-[9px] text-emerald-500/60 font-medium pl-2 uppercase tracking-widest mt-0.5">
            Last Scan: {time}
          </span>
        )}
      </div>
    );
  }

  // default / absent
  return (
    <div className="flex flex-col items-start gap-0.5 group-hover:-translate-y-0.5 transition-transform duration-300 opacity-60">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-transparent border border-dashed border-slate-700 rounded-full text-slate-500 text-xs font-medium tracking-wide">
        <MinusCircle className="w-3.5 h-3.5" />
        Not Arrived
      </span>
    </div>
  );
}
