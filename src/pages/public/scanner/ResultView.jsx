import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, LogOut, ShieldAlert, Ticket, Trophy, User } from "lucide-react";
import { getCountryFlag, getCountryCode3 } from "../../../lib/utils";
import { usePublicAssetUrls } from "../../../lib/storage/publicAssets";

// Renders a scanned athlete's photo, resolving it through the public-verify-assets
// edge function (scope=profile). Flag OFF: synchronous public URL (unchanged).
// Flag ON: short-lived signed URL the anonymous scanner can't mint itself; falls
// back to the supplied placeholder while resolving or if unavailable.
function ScannerAthletePhoto({ athlete, placeholder }) {
  const { urls } = usePublicAssetUrls(
    athlete?.photoUrl ? [athlete.photoUrl] : [],
    { accreditationId: athlete?.id, scope: "profile" }
  );
  const src = athlete?.photoUrl ? urls[athlete.photoUrl] : null;
  if (src) return <img src={src} alt="" className="w-full h-full object-cover" />;
  return placeholder;
}


function ResultView({ config, result, onResume, onRedeem, isPublic, zoneConfig }) {
  // Theme Helper: Map zone color or mode to a specific color palette
  const themeColor = zoneConfig?.color || (config.mode === 'spectator' ? '#3b82f6' : '#10b981');

  if (result.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black">
        <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none" />
        <ShieldAlert className="w-48 h-48 text-red-500 mb-8 drop-shadow-[0_0_40px_rgba(239,68,68,0.7)]" />
        <h2 className="text-6xl font-black text-white uppercase tracking-tighter mb-4 text-center">{result.title || "Access Denied"}</h2>
        <div className="px-12 py-6 bg-red-500/20 border border-red-500/40 rounded-[2.5rem]">
          <p className="text-red-200 text-2xl font-black text-center max-w-lg uppercase tracking-tight">{result.message}</p>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent z-50">
          <button onClick={onResume} className="w-full py-6 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-[0.3em] rounded-3xl transition-all border border-white/10 text-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] active:scale-[0.98]">Skip and Resume</button>
        </div>
      </div>
    );
  }

  // --- SPECTATOR SUCCESS HUD ---
  if (result.type === 'spectator_success') {
    const isExit = result.status === 'exit';
    const accentColor = isExit ? '#ef4444' : themeColor;
    const Icon = isExit ? LogOut : CheckCircle;

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black animate-in fade-in zoom-in duration-300">
        <div className="absolute inset-0 opacity-40 overflow-hidden pointer-events-none" style={{ backgroundColor: `${accentColor}20` }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] border-[60px] border-white/10 rounded-full animate-ping" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-3xl">
          <div className="w-56 h-56 rounded-full flex items-center justify-center mb-12 border-8 shadow-[0_0_80px_-10px_rgba(255,255,255,0.3)]" style={{ backgroundColor: `${accentColor}40`, borderColor: accentColor }}>
            <Icon className="w-32 h-32 text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]" />
          </div>

          <h1 className="text-8xl font-black text-white uppercase tracking-tighter mb-8 drop-shadow-2xl">
            {result.message || (isExit ? "Checked Out" : "Access Granted")}
          </h1>

          <div className="bg-white/10 backdrop-blur-2xl px-16 py-10 rounded-[4rem] border-2 shadow-2xl w-full" style={{ borderColor: `${accentColor}40` }}>
            <p className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-4">
              {result.order?.customer_name || "Spectator"}
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border" style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }}>
               <Ticket className="w-5 h-5 text-white" />
               <span className="text-xs font-black text-white uppercase tracking-[0.3em]">Valid Ticket</span>
            </div>
          </div>

          <button onClick={onResume} className="mt-12 w-full max-w-sm py-5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-black uppercase tracking-[0.3em] rounded-3xl transition-all border border-white/20 text-lg shadow-xl">
            Scan Next
          </button>
          <p className="mt-6 text-white/40 font-black uppercase tracking-[0.5em] text-xs animate-pulse italic">
            Auto-resume in 8s...
          </p>
        </div>
      </div>
    );
  }

  // --- ATHLETE ENTRY HUD (Redesigned for Mobile Excellence) ---
  if (result.type === 'athlete_entry') {
    const athlete = result.athlete;
    const isApproved = athlete.status === 'approved';
    const accentColor = isApproved ? themeColor : '#f59e0b';
    const isSuspended = athlete.status === 'suspended' || athlete.status === 'rejected';
    const isPending = athlete.status === 'pending';
    const isFlagged = isSuspended || isPending;
    const athleteEvents = result.competitionData || [];

    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-[#020617] animate-in fade-in zoom-in duration-300 overflow-hidden font-sans">
        {/* Animated Background Pulse */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] rounded-full blur-[100px]"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {isFlagged && (
           <div className={`shrink-0 p-4 flex items-center justify-center gap-3 ${isSuspended ? 'bg-red-600' : 'bg-amber-600'} shadow-2xl z-50`}>
              <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">
                {isSuspended ? 'SUSPENDED PROFILE' : 'PENDING APPROVAL'}
              </h2>
           </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-start p-4 pt-6 relative z-10 overflow-y-auto custom-scrollbar">
          {/* Identity Hub (Compact) */}
          <div className="flex flex-col items-center gap-4 mb-6 w-full">
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 shadow-2xl overflow-hidden bg-slate-900 ring-4 ring-white/10" style={{ borderColor: isFlagged ? '#ef4444' : accentColor }}>
                 <ScannerAthletePhoto athlete={athlete} placeholder={
                   <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <User className="w-16 h-16 text-white/20" />
                   </div>
                 } />
              </div>
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full border-2 shadow-2xl z-20 whitespace-nowrap ${isFlagged ? 'bg-red-600 border-white' : (result.isPermanentCompletion ? 'bg-emerald-600 border-white ring-4 ring-emerald-500/30' : 'bg-emerald-600 border-white')}`}>
                 <div className="flex flex-col items-center">
                   <span className="text-xs font-black text-white uppercase tracking-[0.2em]">
                     {result.message || (isFlagged ? athlete.status : (result.isPermanentCompletion ? 'COMPLETED' : 'ACCESS GRANTED'))}
                   </span>
                   {result.debug && <span className="text-[8px] font-bold text-white/50 uppercase tracking-tighter mt-0.5">{result.debug}</span>}
                 </div>
              </div>
            </div>

            <div className="text-center mt-2">
               <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-1">
                 {athlete.firstName} {athlete.lastName}
               </h1>
               <div className="flex items-center justify-center gap-2">
                 <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{athlete.club || "Independent"}</span>
                 <div className="w-1 h-1 bg-white/20 rounded-full" />
                 <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{athlete.role || "Participant"}</span>
               </div>
            </div>
          </div>

          {/* Details Grid (Highly Compact) */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
             <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Sector / Zone</span>
                <p className="text-lg font-black text-white uppercase truncate">{config.zone || "Main"}</p>
             </div>
             <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Badge ID</span>
                <p className="text-lg font-black text-white uppercase">#{athlete.badge_number || athlete.accreditationId?.split("-")?.pop() || "---"}</p>
             </div>
          </div>

          {/* Athlete Activity / Competition Schedule (Premium Addition) */}
          {athleteEvents.length > 0 && (
            <div className="w-full max-w-md mt-6 space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Event Schedule</span>
                <span className="text-[10px] font-bold text-blue-400 uppercase">{athleteEvents.length} Entries</span>
              </div>
              <div className="space-y-2">
                {athleteEvents.map((evt, i) => (
                  <div key={i} className="bg-white/5 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-[10px] font-black text-blue-400 border border-blue-500/20">
                        {evt.event_code}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white uppercase leading-none mb-1">{evt.event_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-medium text-white/40 uppercase tracking-tighter">
                            {evt.round}
                          </p>
                          {(evt.heat || evt.lane) && (
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">
                              HEAT {evt.heat || '---'} • LANE {evt.lane || '---'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {evt.rank ? (
                      <div className="px-2 py-1 bg-emerald-500/20 rounded-md text-[9px] font-black text-emerald-400 border border-emerald-500/20">
                        POS: {evt.rank}
                      </div>
                    ) : evt.result_time ? (
                      <div className="px-2 py-1 bg-blue-500/20 rounded-md text-[9px] font-black text-blue-400 border border-blue-500/20">
                        {evt.result_time}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resume Footer (Floating Style) */}
          <div className="mt-auto pt-8 pb-4 text-center w-full px-6">
             <button onClick={onResume} className="w-full py-5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-black uppercase tracking-[0.3em] rounded-3xl transition-all border border-white/20 text-lg shadow-xl mb-4">
               Scan Next
             </button>
             <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] animate-pulse">
               Auto-resume in 8s
             </p>
          </div>
        </div>
      </div>
    );
  }

  // --- ATHLETE INFO/VERIFY HUD ---
  if (result.type === 'athlete_info' || result.type === 'athlete_verify') {
    const { athlete, competitionData } = result;
    const isInfoMode = config.mode === 'info';
    
    // For Info Mode, we use a cleaner, simpler white-card layout as requested
    if (isInfoMode) {
      return (
        <div className="scanner-info-hub flex-1 flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar bg-slate-100/50">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            
            {/* CLEAN WHITE CARD HEADER */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-white">
              <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="w-32 h-32 rounded-3xl overflow-hidden bg-slate-50 border-4 border-slate-50 shadow-inner shrink-0">
                  <ScannerAthletePhoto athlete={athlete} placeholder={
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-slate-200" />
                    </div>
                  } />
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-1">
                    {athlete.firstName} {athlete.lastName}
                  </h1>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 items-center">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{athlete.club || "Independent"}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">•</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{athlete.role || "Athlete"}</span>
                    {athlete.nationality && (
                      <>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">•</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{getCountryCode3(athlete.nationality)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-1">Accreditation ID</span>
                    <span className="text-lg font-mono font-black text-slate-800 tracking-tighter">#{athlete.accreditationId?.split("-")?.pop() || "---"}</span>
                  </div>
                </div>
              </div>
              
              {/* ACCESSIBLE ZONES */}
              {athlete.zoneCode && (
                <div className="bg-slate-50/50 border-t border-slate-100 p-6 flex flex-wrap justify-center gap-3">
                  {athlete.zoneCode.split(",").map((code, i) => (
                    <div key={i} className="px-6 py-2 bg-white rounded-xl border border-slate-200 shadow-sm text-sm font-black text-slate-700">
                      ZONE {code.trim()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EVENT LIST - MATCHING THE VERIFY PAGE STYLE */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Competition Schedule</h3>
                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{competitionData.length} Entries Found</span>
              </div>
              
              <div className="divide-y divide-slate-50">
                {competitionData.map((evt, i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-6">
                      <span className="text-lg font-black text-slate-900 w-10">{evt.event_code}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{evt.event_name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{evt.round}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      {(evt.heat || evt.lane) && (
                        <div className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">
                          HEAT {evt.heat || '---'} • LANE {evt.lane || '---'}
                        </div>
                      )}
                      
                      <div className="text-right min-w-[60px]">
                        {evt.result_time ? (
                          <span className="text-xl font-mono font-black text-slate-900">{evt.result_time}</span>
                        ) : (
                          <span className="text-xl font-mono font-black text-slate-200">NT</span>
                        )}
                        {evt.rank && (
                          <p className="text-[10px] font-black text-emerald-600 uppercase">Rank #{evt.rank}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-100 via-slate-100/90 to-transparent z-50">
              <button onClick={onResume} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white text-xl font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-200 active:scale-[0.98]">
                Next Participant
              </button>
            </div>
            
            {/* Spacer for bottom bar */}
            <div className="h-32"></div>
          </div>
        </div>
      );
    }

    // --- VERIFICATION MODE (Keep original for security/guards) ---
    const isSuspended = athlete.status === 'suspended' || athlete.status === 'rejected';
    const isPending = athlete.status === 'pending';
    const isFlagged = isSuspended || isPending;
    const accentColor = isFlagged ? '#ef4444' : (isPending ? '#f59e0b' : themeColor);

    return (
      <div className="flex-1 flex flex-col p-4 md:p-12 overflow-y-auto custom-scrollbar bg-black relative">
        {/* Urgent Alert Banner for Flagged Profiles */}
        {isFlagged && (
           <div className={`mb-8 p-6 rounded-3xl flex items-center gap-6 ${isSuspended ? 'bg-red-600' : 'bg-amber-600'} shadow-2xl z-20`}>
              <ShieldAlert className="w-12 h-12 text-white animate-pulse" />
              <div>
                 <h2 className="text-2xl font-black text-white uppercase tracking-tighter">FLAGGED PROFILE</h2>
                 <p className="text-white/80 font-bold uppercase text-xs leading-none mt-1">DO NOT ADMIT: {athlete.status.toUpperCase()}</p>
              </div>
           </div>
        )}

        <div className="max-w-5xl mx-auto w-full space-y-10 relative z-10">
          {/* PROFILE HEADER FOR VERIFICATION */}
          <div className="flex flex-col md:flex-row items-center gap-12">
             <div className="w-64 h-80 rounded-[3rem] border-8 shadow-2xl overflow-hidden bg-white/5 border-white/10 shrink-0" style={{ borderColor: accentColor }}>
                <ScannerAthletePhoto athlete={athlete} placeholder={
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                     <User className="w-32 h-32 text-white/10" />
                  </div>
                } />
             </div>

             <div className="flex-1 text-center md:text-left space-y-4">
                <div className="inline-flex items-center gap-4 px-6 py-2 bg-white/5 rounded-full border border-white/10 mb-4">
                   <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
                   <span className="text-xs font-black text-white uppercase tracking-[0.3em]">{athlete.role || "ATHLETE"} ID #{athlete.accreditationId?.split("-")?.pop() || "---"}</span>
                </div>
                <h1 className="text-8xl font-black text-white uppercase tracking-tighter leading-none">
                  {athlete.firstName}
                </h1>
                <h2 className="text-7xl font-black text-white/40 uppercase tracking-tighter leading-none">
                  {athlete.lastName}
                </h2>
                <div className="flex flex-wrap gap-4 mt-8">
                   <div className="px-5 py-2 bg-white/10 rounded-xl border border-white/10">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{athlete.club || "INDEPENDENT"}</span>
                   </div>
                   {athlete.nationality && (
                      <div className="px-5 py-2 bg-white/10 rounded-xl border border-white/10 flex items-center gap-2">
                        {getCountryFlag(athlete.nationality) && <img src={getCountryFlag(athlete.nationality)} className="w-6 h-4 rounded-sm" />}
                        <span className="text-xs font-black text-white uppercase tracking-widest">{getCountryCode3(athlete.nationality)}</span>
                      </div>
                   )}
                </div>
             </div>
          </div>

          {/* SECURITY ZONES */}
          {athlete.zoneCode && (() => {
            const visibleZoneCodes = athlete.zoneCode.split(",")
              .map(c => c.trim())
              .filter(code => {
                if (!code) return false;
                const zoneInfo = result.zones?.find?.(z => String(z.code) === code);
                return !zoneInfo?.settings?.isHidden;
              });
            return visibleZoneCodes.length > 0 ? (
               <div className="space-y-4">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] block text-center">Security Access Clusters</span>
                  <div className="flex flex-wrap justify-center gap-4">
                     {visibleZoneCodes.map((code, i) => (
                        <div key={i} className="px-10 py-5 rounded-2xl border-2 bg-white/5 text-3xl font-black text-white uppercase tracking-tighter shadow-2xl" style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                           {code.trim()}
                        </div>
                     ))}
                  </div>
               </div>
            ) : null;
          })()}

          {/* TARGETED EVENT SCHEDULE */}
          {competitionData && competitionData.length > 0 && (
            <div className="w-full space-y-6">
               <div className="flex items-center justify-between px-4">
                 <div className="flex items-center gap-3">
                    <Trophy className="w-4 h-4 text-primary-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Tactical Schedule Overview</span>
                 </div>
                 <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-3 py-1 rounded-lg border border-primary-500/20">
                   {competitionData.length} ACTIVE ENTRIES
                 </span>
               </div>
               
               <div className="space-y-3">
                 {competitionData.map((evt, i) => (
                   <motion.div 
                     key={i} 
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: i * 0.05 }}
                     className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 p-5 rounded-[2rem] flex items-center justify-between group transition-all backdrop-blur-3xl"
                   >
                     <div className="flex items-center gap-8 flex-1 min-w-0">
                       <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex flex-col items-center justify-center text-blue-400 border border-blue-500/20 group-hover:border-blue-400/50 transition-all shrink-0">
                         <span className="text-[10px] font-black uppercase opacity-40 leading-none mb-1">Evt</span>
                         <span className="text-xl font-black leading-none">{evt.event_code}</span>
                       </div>
                       
                       <div className="flex-1 min-w-0">
                         <p className="text-xl font-black text-white uppercase tracking-tight truncate mb-1">
                           {evt.event_name}
                         </p>
                         <div className="flex items-center gap-6">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{evt.round}</span>
                            {(evt.heat || evt.lane) && (
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-1 bg-white/10 rounded-full" />
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                                  HEAT {evt.heat || '---'} • LANE {evt.lane || '---'}
                                </span>
                              </div>
                            )}
                         </div>
                       </div>
                     </div>

                     <div className="flex items-center gap-8 shrink-0 pl-6 border-l border-white/5">
                        {evt.result_time ? (
                          <div className="text-right">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-0.5">Final Time</span>
                            <span className="text-3xl font-mono font-black text-emerald-400 tracking-tighter leading-none">{evt.result_time}</span>
                          </div>
                        ) : (
                          <div className="text-right opacity-20">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-0.5">Time</span>
                            <span className="text-3xl font-mono font-black text-white tracking-tighter leading-none">NT</span>
                          </div>
                        )}
                        
                        {evt.rank && (
                          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                            <span className="text-[8px] font-black text-emerald-400 uppercase leading-none mb-0.5">Rank</span>
                            <span className="text-xl font-black text-white leading-none">#{evt.rank}</span>
                          </div>
                        )}
                     </div>
                   </motion.div>
                 ))}
               </div>
            </div>
          )}

          {/* Spacer for bottom bar */}
          <div className="h-40"></div>

          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent z-50">
            <button onClick={onResume} className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white text-3xl font-black uppercase tracking-[0.2em] rounded-[2.5rem] transition-all shadow-[0_40px_80px_-20px_rgba(37,99,235,0.4)] hover:scale-[1.01] active:scale-[0.98]">
              Scan Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default ResultView;
