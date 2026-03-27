import React from "react";
import { Calendar, MapPin, Sparkles } from "lucide-react";

export const SpectatorTicketCard = ({ order, event, qrCodeUrl, idSuffix = "" }) => {
  const getEventDatesCount = () => {
    if (!event?.startDate || !event?.endDate) return 0;
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const isFullEvent = order?.selected_dates?.length === getEventDatesCount() && getEventDatesCount() > 1;

  return (
    <div 
      id={`spectator-ticket-card${idSuffix}`}
      className="relative w-[360px] bg-white rounded-[2.5rem] overflow-hidden flex flex-col"
      style={{ minHeight: '600px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '40px' }}
    >
      <div 
        className="h-52 relative bg-slate-950 overflow-hidden shrink-0" 
        style={{ 
          backgroundColor: '#020617',
          borderTopLeftRadius: '40px',
          borderTopRightRadius: '40px'
        }}
      >
         <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0V0zm20 20h20v20H20V20zM0 20h10v10H0V20zm10 10h10v10H10V30zM20 0h10v10H20V0zm10 10h10v10H30V10z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />
         
         {event?.bannerUrl ? (
           <img crossOrigin="anonymous" src={event.bannerUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" alt="Banner" />
         ) : (
           <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-950/50 to-cyan-900" style={{ background: 'linear-gradient(to bottom right, #0f172a, #083344)' }} />
         )}
         
         <div className="absolute top-0 right-0 w-32 h-64 bg-cyan-500/10 -skew-x-12 translate-x-16" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)' }} />
         <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" style={{ background: 'linear-gradient(to top, #020617, transparent)' }} />
         
         <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
            <div className="px-3 py-1 bg-cyan-600 text-white rounded-md transform -skew-x-12 shadow-lg shadow-cyan-900/40" style={{ backgroundColor: '#06b6d4', padding: '6px 12px' }}>
              <span className="text-[10px] font-black italic uppercase tracking-[0.2em] block skew-x-12 text-white" style={{ fontFamily: 'sans-serif' }}>Spectator Pass</span>
            </div>
            {event?.logoUrl && (
              <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-lg border border-white/10" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img crossOrigin="anonymous" src={event.logoUrl} className="h-8 object-contain" alt="Logo" style={{ height: '32px' }} />
              </div>
            )}
         </div>

         <div className="absolute bottom-6 left-8 right-8 z-10">
            <h2 className="text-xl font-[900] text-white uppercase mb-4 tracking-tight truncate transform -skew-x-2" style={{ fontFamily: 'sans-serif', fontSize: '20px', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', marginBottom: '16px', lineHeight: '1.2', paddingTop: '4px' }}>
              {event?.name || 'TEST EVENT'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px' }}>
                <Calendar className="w-3 h-3 text-cyan-400" size={12} color="#22d3ee" style={{ marginRight: '6px' }} />
                <span className="text-[10px] font-bold text-white whitespace-nowrap" style={{ fontSize: '10px', fontWeight: '700', color: 'white', whiteSpace: 'nowrap' }}>{new Date(event?.startDate || Date.now()).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', maxWidth: '180px' }}>
                <MapPin className="w-3 h-3 text-cyan-400" size={12} color="#22d3ee" style={{ marginRight: '6px', flexShrink: 0 }} />
                <span className="text-[10px] font-bold text-white whitespace-nowrap truncate" style={{ fontSize: '10px', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event?.location || 'Hamdan Sports Complex'}</span>
              </div>
            </div>
         </div>
      </div>

      <div 
        className="flex-1 bg-white p-8 flex flex-col items-center"
        style={{ 
          backgroundColor: '#ffffff', 
          padding: '32px 32px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
         <div className="w-full mb-8 pt-2" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingTop: '8px' }}>
           <div style={{ flex: '1 1 auto', marginRight: '16px', overflow: 'hidden' }}>
              <h3 className="uppercase" style={{ color: '#94a3b8', fontSize: '10px', fontWeight: '900', letterSpacing: '0.2em', marginBottom: '8px', lineHeight: '1.2' }}>Pass Holder</h3>
              <p className="uppercase" style={{ color: '#0f172a', fontSize: '15px', fontWeight: '900', lineHeight: '1.2', whiteSpace: 'normal', width: '100%', paddingBottom: '4px', wordBreak: 'break-word', paddingRight: '12px' }}>{order.customer_name || 'Walk-in Customer'}</p>
           </div>
           <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
              <h3 className="uppercase" style={{ color: '#94a3b8', fontSize: '10px', fontWeight: '900', letterSpacing: '0.2em', marginBottom: '8px', lineHeight: '1.2' }}>Pass Type</h3>
              <div 
                className="uppercase"
                style={{ 
                  backgroundColor: isFullEvent ? '#f59e0b' : '#06b6d4', 
                  color: 'white', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  fontSize: '10px', 
                  fontWeight: '900',
                  lineHeight: '1.2',
                  display: 'inline-block'
                }}
              >
                {isFullEvent ? 'Full Event Entry' : 'General Entry'}
              </div>
           </div>
         </div>

         {/* Dates Section */}
         {(order.selected_dates?.length > 0 || isFullEvent) && (
           <div className="w-full mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '1rem', padding: '16px', boxSizing: 'border-box', width: '100%', marginBottom: '32px' }}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#94a3b8', fontSize: '9px', fontWeight: '900', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                 <Calendar className="w-3 h-3 text-cyan-500" style={{ color: '#06b6d4', marginRight: '8px' }} size={12} /> 
                 VALIDITY PERIOD
              </p>
              <div className="flex flex-wrap gap-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                 {isFullEvent ? (
                   <div className="w-full flex items-center justify-between" style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                      <span className="text-sm font-black text-slate-900" style={{ color: '#0f172a', fontWeight: '900', fontSize: '14px' }}>FULL EVENT ACCESS</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase" style={{ color: '#94a3b8', fontWeight: '700', fontSize: '10px' }}>{getEventDatesCount()} DAYS</span>
                   </div>
                 ) : (
                   order.selected_dates?.map(date => (
                     <span key={date} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', color: '#1e293b', fontWeight: '900', fontSize: '11px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                       {new Date(date).toLocaleDateString('en-US', { day: 'short', month: 'short', year: 'numeric' })}
                     </span>
                   ))
                 )}
              </div>
           </div>
         )}

         {/* QR Code Container */}
         <div 
            className="relative w-full aspect-square bg-slate-50 p-6 border-4 border-slate-100 flex items-center justify-center group/qr" 
            style={{ 
              backgroundColor: '#f8fafc',
              border: '4px solid #f1f5f9',
              borderRadius: '2rem',
              padding: '24px',
              aspectRatio: '1/1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              width: '100%',
              boxSizing: 'border-box'
            }}
         >
            <div 
              className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 py-1 rounded-full border border-slate-200 shadow-sm z-10"
              style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'white',
                padding: '4px 16px',
                borderRadius: '9999px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
            >
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#94a3b8', fontSize: '9px', fontWeight: '900', letterSpacing: '0.1em', display: 'flex', alignItems: 'center' }}>
                <Sparkles className="w-3 h-3 text-amber-400 mr-1.5" size={12} color="#fbbf24" />
                Valid for {order.ticket_count || 1} Persons
              </span>
            </div>
            {qrCodeUrl ? (
              <img src={qrCodeUrl} className="w-full h-full object-contain mix-blend-multiply" alt="Ticket QR" data-qr-code="true" style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-qr-code="true">
                <p style={{ color: '#cbd5e1', fontSize: '10px' }}>NO QR</p>
              </div>
            )}
         </div>

         <div className="mt-8 text-center space-y-1 mb-6" style={{ marginTop: '32px', marginBottom: '24px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]" style={{ color: '#cbd5e1', fontSize: '10px', fontWeight: '900', letterSpacing: '0.3em', marginBottom: '8px' }}>Official Entry Code</p>
            <p className="text-sm font-mono text-slate-500 font-bold" style={{ color: '#64748b', fontSize: '14px', fontWeight: '700', fontFamily: 'monospace' }}>{order.qr_code_id || 'NO-REF-PROVIDED'}</p>
         </div>
      </div>

      {/* Footer / Stub Effect */}
      <div 
        className="relative h-20 bg-slate-50 border-t-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0"
        style={{ height: '80px', backgroundColor: '#f8fafc', borderTop: '2px dashed #cbd5e1', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', borderBottomLeftRadius: '40px', borderBottomRightRadius: '40px' }}
      >
         {/* Ticket Cut-outs */}
         <div 
           className="absolute -left-4 w-8 h-8 rounded-full bg-slate-900 -translate-y-1/2 top-0"
           style={{ position: 'absolute', left: '-16px', top: '-16px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#020617' }} 
         />
         <div 
           className="absolute -right-4 w-8 h-8 rounded-full bg-slate-900 -translate-y-1/2 top-0"
           style={{ position: 'absolute', right: '-16px', top: '-16px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#020617' }} 
         />
         
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em]" style={{ color: '#94a3b8', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4em', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
           Apex Accredit Pro • Apex Sports Finance
         </p>
      </div>
    </div>
  );
};
