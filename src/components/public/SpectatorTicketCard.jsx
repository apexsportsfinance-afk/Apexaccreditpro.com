import React from "react";

export const SpectatorTicketCard = ({ order, event, qrCodeUrl, idSuffix = "", isPrinting = false, ticketIndex = null, totalTickets = null, ticket = null }) => {
  const getEventDatesCount = () => {
    if (!event?.startDate || !event?.endDate) return 0;
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const isFullEventCount = order?.selected_dates?.length === getEventDatesCount() && getEventDatesCount() > 1;
  
  // APX-MOD: Prioritize individual ticket metadata from real columns, fallback to JSON
  let ticketInfo = ticket || order?.specific_ticket || {};
  
  // Use real columns if they exist (Post-Migration)
  const realName = ticketInfo.ticket_name || ticketInfo.name;
  const realPrice = ticketInfo.price;
  const realDate = ticketInfo.valid_date;

  // Decouple metadata from status if encoded with '|' (Legacy Fallback)
  if (ticketInfo.status?.includes('|')) {
    try {
      const [status, json] = ticketInfo.status.split('|');
      const meta = JSON.parse(json);
      ticketInfo = {
        ...ticketInfo,
        status,
        name: realName || meta.n || ticketInfo.name,
        price: realPrice || meta.p || ticketInfo.price,
        valid_date: realDate || meta.d || ticketInfo.valid_date
      };
    } catch (e) {
       console.warn("Card: Meta parse error");
    }
  } else {
    // Standard row or new migration row (Only update if new columns have data)
    if (realName || realPrice || realDate) {
      ticketInfo = {
        ...ticketInfo,
        name: realName || ticketInfo.name,
        price: realPrice || ticketInfo.price,
        valid_date: realDate || ticketInfo.valid_date
      };
    }
  }

  // Use the price from the individual ticket if available
  const amount = ticketInfo.price ? Number(ticketInfo.price) : Math.round(Number(order?.amount_paid || order?.total_amount || 0) / Math.max(1, Number(order?.ticket_count || 1))); 
  
  if (!qrCodeUrl) console.warn("APX-WARN: Rendering ticket card without QR URL", ticketInfo.ticket_code);
  
  const currency = order?.currency || 'AED';
  const personType = ticketInfo.name || ticketInfo.ticket_name || (isFullEventCount ? 'FULL EVENT' : (order?.person_type || 'ADULT'));
  const passHolderName = order?.customer_name || 'Walk-in Customer';
  const eventName = event?.name || 'TEST EVENT';
  
  // APX-MOD: Use individual ticket date if available
  const displayDate = ticketInfo.valid_date || ticketInfo.date || event?.startDate || Date.now();
  const isFullEventLabel = ticketInfo.valid_date === 'Full Event' || ticketInfo.date === 'Full Event';

  // APX-MOD: Safe date formatting to prevent RangeError crashes
  const formatDateSafe = (dateVal) => {
    if (!dateVal) return 'TBD';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal).toUpperCase();
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    } catch (e) {
      console.warn("Date format error:", e);
      return String(dateVal).toUpperCase();
    }
  };

  const eventDateStr = isFullEventLabel ? 'FULL EVENT ACCESS' : formatDateSafe(displayDate);

  const themeColor = isFullEventLabel ? '#E37A2C' : '#2D9C8B';

  const getScaledFontSize = (text, defaultSize, minSize, threshold) => {
    if (!text || text.length <= threshold) return `${defaultSize}px`;
    const scale = threshold / text.length;
    return `${Math.max(minSize, Math.floor(defaultSize * scale))}px`;
  };

  return (
    <div 
      id={`spectator-ticket-card${idSuffix}`}
      className={`relative bg-white overflow-hidden ${isPrinting ? '' : 'rounded-2xl shadow-2xl border border-slate-200'}`}
      style={{ 
        width: '600px', 
        height: '240px', 
        backgroundColor: 'white', 
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
        border: isPrinting ? 'none' : undefined,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
      }}
    >
      {/* 1. Left Color Bar */}
      <div style={{ 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        width: '40px', 
        height: '100%', 
        backgroundColor: themeColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ 
          transform: 'rotate(-90deg)', 
          color: 'rgba(255,255,255,0.8)', 
          fontSize: '10px', 
          fontWeight: '900', 
          whiteSpace: 'nowrap',
          letterSpacing: '0.2em'
        }}>
          N.{(order?.qr_code_id || '0000').slice(-4)}
        </p>
        <div style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#020617', zIndex: 10 }} />
      </div>

      {/* 2. Main Content Area */}
      <div style={{ 
        position: 'absolute', 
        left: '40px', 
        top: 0, 
        right: '260px', 
        height: '100%', 
        borderRight: '2px dashed #e2e8f0'
      }}>
        {/* Event Header */}
        <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
          <h2 style={{ 
            fontSize: getScaledFontSize(eventName, 19, 11, 20), 
            fontWeight: '900', 
            color: '#1e293b', 
            textTransform: 'uppercase', 
            margin: 0, 
            lineHeight: '1.0',
            maxWidth: '280px'
          }}>
            {eventName}
          </h2>
          <div style={{ marginTop: '6px' }}>
            <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', margin: 0, textTransform: 'uppercase' }}>
              {event?.location || 'Hamdan Sports Complex'}
            </p>
            <p style={{ fontSize: '8px', color: '#94a3b8', fontWeight: '700', margin: '2px 0 0 0', textTransform: 'uppercase' }}>
              {eventDateStr} • VENUE OPEN 7:00 AM
            </p>
          </div>
        </div>

        {/* Price and Type Tags */}
        <div style={{ position: 'absolute', top: '112px', left: '24px', display: 'flex', gap: '8px' }}>
          <div style={{ backgroundColor: themeColor, color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '15px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {amount} {currency} <span style={{ fontSize: '7px', fontWeight: '800', opacity: 0.9 }}>PER TICKET</span>
          </div>
          <div style={{ border: `1.5px solid ${themeColor}`, color: themeColor, padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: '800' }}>
            {personType}
          </div>
        </div>

        {/* Pass Holder Info */}
        <div style={{ position: 'absolute', bottom: '24px', left: '24px' }}>
          <span style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pass Holder</span>
          <p style={{ 
            fontSize: getScaledFontSize(passHolderName, 14, 10, 16), 
            fontWeight: '900', 
            color: '#0f172a', 
            margin: '3px 0 0 0', 
            textTransform: 'uppercase'
          }}>
            {passHolderName}
          </p>
          <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '7.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>TYPE: {personType}</span>
            <span style={{ fontSize: '7.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>PAYMENT: {order?.payment_status === 'paid' ? 'VERIFIED' : 'PENDING'}</span>
          </div>
           <p style={{ fontStyle: 'italic', fontSize: '7px', color: '#cbd5e1', fontWeight: '600', margin: '2px 0 0 0', textTransform: 'uppercase' }}>
            Ref ID: {order?.qr_code_id || 'N/A'}
          </p>
        </div>

        {/* Ticket Counter */}
        {ticketIndex !== null && totalTickets !== null && (
          <div style={{ position: 'absolute', bottom: '22px', right: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ 
              backgroundColor: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              padding: '4px 8px', 
              borderRadius: '4px',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: '800',
              textTransform: 'uppercase',
              lineHeight: '1'
            }}>
              {ticketIndex}/{totalTickets}
            </div>
            <span style={{ fontSize: '7px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.05em' }}>
              ENTRY
            </span>
          </div>
        )}
      </div>

      {/* 3. QR Section */}
      <div style={{ 
        position: 'absolute', 
        left: '340px', 
        width: '150px', 
        height: '100%', 
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ width: '90px', height: '90px', padding: '6px', backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={qrCodeUrl} data-qr-code="true" style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="QR" />
        </div>
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '7px', fontWeight: '900', color: themeColor, letterSpacing: '0.1em' }}>DATE</span>
          <p style={{ fontSize: '10px', fontWeight: '900', color: '#1e293b', margin: '1px 0 0 0' }}>{eventDateStr}</p>
        </div>
        <div style={{ marginTop: '8px' }}>
          <span style={{ fontSize: '9px', color: '#475569', fontWeight: '800', fontFamily: 'monospace' }}>#{order.qr_code_id || '0000'}</span>
        </div>
      </div>

      {/* 4. Stub Section */}
      <div style={{ 
        position: 'absolute', 
        right: 0, 
        width: '110px', 
        height: '100%', 
        backgroundColor: themeColor,
        color: 'white',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', left: '-12px', top: '50%', transform: 'translateY(-50%)', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#020617', zIndex: 10 }} />
        
        {/* Date */}
        <div style={{ position: 'absolute', top: '24px', right: '15px', textAlign: 'right' }}>
           <p style={{ fontSize: '7px', fontWeight: '900', opacity: 0.8, margin: 0 }}>DATE</p>
           <p style={{ fontSize: '9px', fontWeight: '900', margin: 0 }}>{eventDateStr}</p>
        </div>

        {/* Vertical Event Name */}
        <div style={{ 
          width: '180px', 
          textAlign: 'center', 
          position: 'absolute', 
          top: '50%', 
          left: '12px',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          fontSize: getScaledFontSize(eventName, 12, 8, 30),
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          lineHeight: '1.0',
          whiteSpace: 'normal',
          display: '-webkit-box',
          WebkitLineClamp: '2',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          opacity: 0.95
        }}>
          {eventName}
        </div>

        {/* QR Bottom */}
        <div style={{ position: 'absolute', bottom: '24px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '32px', height: '32px', backgroundColor: 'white', marginBottom: '6px', borderRadius: '4px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={qrCodeUrl} style={{ width: '100%', height: '100%' }} alt="SQR" />
          </div>
          <p style={{ fontSize: '8px', fontWeight: '900', margin: 0 }}>N.{(order.qr_code_id || '0000').slice(-4)}</p>
        </div>
      </div>
    </div>
  );
};
