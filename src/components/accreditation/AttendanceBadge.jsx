import React from 'react';
import { CheckCircle2, Clock, MinusCircle } from 'lucide-react';

export default function AttendanceBadge({ athletesCount = 0, coachesCount = 0, time }) {
  const isPresent = athletesCount > 0 || coachesCount > 0;

  if (isPresent) {
    return (
      <div className="flex flex-col items-start gap-1.5 group-hover:-translate-y-0.5 transition-transform duration-300">
        {athletesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-emerald-400 to-emerald-600 border border-white/20 rounded-full text-white text-[10px] font-black tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_15px_rgba(16,185,129,0.4),0_2px_4px_rgba(0,0,0,0.3)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {athletesCount} ATHLETE{athletesCount !== 1 ? 'S' : ''} PRESENT
          </span>
        )}
        
        {coachesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-b from-blue-400 to-blue-600 border border-white/20 rounded-full text-white text-[10px] font-black tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_12px_rgba(59,130,246,0.3),0_2px_4px_rgba(0,0,0,0.3)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {coachesCount} STAFF PRESENT
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
