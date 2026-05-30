import React from 'react';
import { Users, CheckCircle, Clock } from 'lucide-react';

export default function AttendanceStats({ analytics }) {
  if (!analytics || analytics.length === 0) return null;

  // Calculate totals across all clubs
  const totalRegistered = analytics.reduce((sum, row) => sum + row.fileRegistered, 0);
  const totalPresent = analytics.reduce((sum, row) => sum + (row.attendanceCount || 0), 0);
  
  // Prevent division by zero
  const percentage = totalRegistered > 0 ? Math.round((totalPresent / totalRegistered) * 100) : 0;
  const totalAbsent = Math.max(0, totalRegistered - totalPresent);

  // SVG parameters for circular progress
  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-xl">
      
      {/* Circular Progress */}
      <div className="flex items-center gap-4 border-r border-slate-800 pr-6">
        <div className="relative" style={{ width: size, height: size }}>
          {/* Background circle */}
          <svg className="transform -rotate-90 w-full h-full">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-slate-800"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-emerald-500 transition-all duration-1000 ease-out"
            />
          </svg>
          {/* Centered text */}
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-sm font-black text-white">{percentage}%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Live Attendance</p>
          <p className="text-white font-medium text-sm">Event Capacity</p>
        </div>
      </div>

      {/* Pill Counters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-emerald-400 font-bold text-sm">{totalPresent} <span className="text-emerald-500/60 font-medium">Present</span></span>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-full">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300 font-bold text-sm">{totalAbsent} <span className="text-slate-500 font-medium">Absent</span></span>
        </div>
      </div>

    </div>
  );
}
