import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CheckCircle, AlertCircle, Info, Lock, LogOut, RefreshCcw, Eye, EyeOff } from "lucide-react";
import { AccreditationsAPI, TicketingAPI, EventsAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";

export default function ScannerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const defaultPin = import.meta.env.VITE_SCANNER_PIN || "1234";

  // Configuration from URL
  const [config, setConfig] = useState({
    mode: "attendance", // attendance | info
    eventId: "",
    deviceLabel: "Main-Scanner"
  });

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const qrRef = useRef(null);
  const html5QrCode = useRef(null);

  // Initialize config from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode") || "attendance";
    const eventParam = params.get("event_id") || "";
    const deviceParam = params.get("device_label") || "Main-Scanner";
    
    setConfig({
      mode: modeParam,
      eventId: eventParam,
      deviceLabel: deviceParam
    });

    // Check localStorage session
    const savedPinAuth = localStorage.getItem("scanner_auth_pin");
    if (savedPinAuth === defaultPin) setAuthorized(true);
  }, [defaultPin]);

  const handleAuth = (e) => {
    e.preventDefault();
    if (pinInput === defaultPin) {
      setAuthorized(true);
      localStorage.setItem("scanner_auth_pin", pinInput);
      setPinError("");
    } else {
      setPinError("Invalid PIN");
    }
  };

  const logout = () => {
    localStorage.removeItem("scanner_auth_pin");
    setAuthorized(false);
    stopScanner();
  };

  useEffect(() => {
    if (authorized && !scanning) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [authorized]);

  const startScanner = () => {
    if (!qrRef.current) return;
    setCameraError(null);
    html5QrCode.current = new Html5Qrcode(qrRef.current.id);

    html5QrCode.current.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      onScanFailure
    ).then(() => {
      setScanning(true);
    }).catch((err) => {
      console.error(err);
      setCameraError("Camera access denied or unavailable.");
      setScanning(false);
    });
  };

  const stopScanner = () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      html5QrCode.current.stop().then(() => {
        setScanning(false);
      }).catch(err => console.error("Error stopping scanner", err));
    }
  };

  const onScanFailure = (error) => {
    // Ignore routine framing errors
  };

  const onScanSuccess = async (decodedText) => {
    if (processing) return; // Prevent double scans
    setProcessing(true);
    
    // Stop scanner briefly to indicate detection
    stopScanner();

    try {
      // 1. Parse token non-destructively
      let token = decodedText.trim();
      
      // Handle Spectator QR
      if (token.startsWith("spec_")) {
        const order = await TicketingAPI.validateOrder(token);
        if (!order) {
          setLastScanResult({
            status: "error",
            message: "Invalid spectator ticket QR code."
          });
          setTimeout(resumeScanner, 3000);
          return;
        }

        if (order.event_id !== config.eventId) {
          setLastScanResult({
            status: "error",
            message: "This ticket is for a different event."
          });
          setTimeout(resumeScanner, 3000);
          return;
        }

        const remaining = order.ticket_count - (order.scanned_count || 0);
        setLastScanResult({
          status: remaining > 0 ? "success" : "duplicate",
          type: "spectator",
          order,
          remaining,
          message: remaining > 0 ? `Valid Order: ${remaining} of ${order.ticket_count} remaining.` : "All tickets in this order have been redeemed."
        });
        
        // Don't auto-resume for spectators, wait for them to click "Redeem" or "Close"
        return;
      }

      if (token.includes("/verify/")) {
        token = token.split("/verify/").pop();
      }

      // 2. Lookup athlete using existing method
      const athlete = await AccreditationsAPI.validateToken(token);
      
      if (!athlete) {
        setLastScanResult({
          status: "error",
          message: "Athlete not found or invalid QR code."
        });
        setTimeout(resumeScanner, 3000);
        return;
      }

      // Check event id bounds
      let targetEventId = config.eventId;
      if (!targetEventId) {
        setLastScanResult({
          status: "error",
          message: "Scanner must be configured with an event_id in URL."
        });
        setTimeout(resumeScanner, 3000);
        return;
      }

      // 3. Check athlete approval status
      if (athlete.status !== "approved") {
        setLastScanResult({
          status: "error",
          athlete,
          message: `Access Denied: Accreditation is ${athlete.status}.`
        });
        setTimeout(resumeScanner, 4000);
        return;
      }

      // 4. Process based on Mode
      if (config.mode === "info") {
        setLastScanResult({
          status: "info",
          athlete,
          message: "Info Mode: Read Complete"
        });
        setTimeout(resumeScanner, 4000);
        return;
      }

      // 4. Attendance Mode Logic
      if (athlete.eventId !== targetEventId) {
        // Just in case user uses URL slug instead of UUID, check standard matching
        // Let's assume the API handles it normally, or we alert
        setLastScanResult({
          status: "error",
          athlete,
          message: "Athlete is NOT registered for this specific event."
        });
        setTimeout(resumeScanner, 4000);
        return;
      }

      const recordRes = await AttendanceAPI.recordScan({
        eventId: targetEventId,
        athleteId: athlete.id,
        clubName: athlete.club,
        scannerLocation: config.deviceLabel
      });

      setLastScanResult({
        status: recordRes.status, // "success" or "duplicate" or "error"
        athlete,
        message: recordRes.message
      });
      
      setTimeout(resumeScanner, 4000);

    } catch (err) {
      console.error(err);
      setLastScanResult({
        status: "error",
        message: "An unexpected error occurred during scan process."
      });
      setTimeout(resumeScanner, 3000);
    }
  };

  const handleRedeem = async (count) => {
    if (!lastScanResult || !lastScanResult.order) return;
    setProcessing(true);
    try {
      const updatedOrder = await TicketingAPI.redeemTickets(lastScanResult.order.id, count);
      const remaining = updatedOrder.ticket_count - updatedOrder.scanned_count;
      
      setLastScanResult({
        ...lastScanResult,
        status: remaining > 0 ? "success" : "duplicate",
        order: updatedOrder,
        remaining,
        message: `Successfully redeemed ${count} ticket${count > 1 ? 's' : ''}. ${remaining} remaining.`
      });
      
      toast.success(`Redeemed ${count} ticket${count > 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Redemption failed");
    } finally {
      setProcessing(false);
    }
  };

  const resumeScanner = () => {
    setLastScanResult(null);
    setProcessing(false);
    startScanner();
  };

  // --- RENDER STATES ---

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Scanner Access</h1>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Enter the staff authorization PIN to operate this device.
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <input 
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-4 pr-14 py-4 text-center text-3xl tracking-[1em] text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-700"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-400 transition-colors"
                tabIndex="-1"
              >
                {showPin ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
              </button>
            </div>
            {pinError && <p className="text-red-400 text-sm font-bold text-center">{pinError}</p>}
            
            <button type="submit" className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wide transition-all shadow-lg shadow-blue-900/30">
              Unlock Scanner
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 shrink-0 px-6 flex items-center justify-between shadow-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${
            config.mode === 'attendance' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-white font-black uppercase tracking-widest text-sm">
              {config.mode === "info" ? "Info Read Mode" : "Attendance Mode"}
            </h1>
            <p className="text-gray-400 text-xs font-medium">Device: {config.deviceLabel}</p>
          </div>
        </div>
        <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Camera Feed Container */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="text-center p-6 space-y-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <p className="text-white font-bold">{cameraError}</p>
              <button onClick={startScanner} className="px-6 py-2 bg-gray-800 text-white rounded-xl border border-gray-700 hover:bg-gray-700 font-bold transition-colors">
                Retry Camera
              </button>
            </div>
          ) : (
             <div 
               id="qr-reader" 
               ref={qrRef} 
               className="w-full h-full object-cover qr-scanner-container"
               style={{ minHeight: '100%', minWidth: '100%' }}
             />
          )}

          {/* Scanning Overlay (Subtle) */}
          {scanning && !processing && (
             <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/40 rounded-3xl relative">
                  {/* Scanner moving line effect */}
                   <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.5)] animate-scan" />
                   {/* Corner markers */}
                   <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                   <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                   <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                   <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                </div>
                <p className="text-white/80 text-sm font-bold uppercase tracking-widest mt-8 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                  Align QR Code
                </p>
             </div>
          )}
        </div>

        {/* Scan Result Overlay (Slide up bottom sheet) */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 backdrop-blur-xl bg-opacity-95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out p-6 rounded-t-[2.5rem] z-50 flex flex-col ${
          lastScanResult ? "translate-y-0" : "translate-y-[120%]"
        }`}>
          
          {lastScanResult && (
            <div className="w-full max-w-lg mx-auto">
              {/* Status Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl flex items-center justify-center shadow-lg ${
                  lastScanResult.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 shadow-emerald-500/20' : 
                  lastScanResult.status === 'duplicate' ? 'bg-orange-500/20 text-orange-400 shadow-orange-500/20' :
                  lastScanResult.status === 'info' ? 'bg-blue-500/20 text-blue-400 shadow-blue-500/20' :
                  'bg-red-500/20 text-red-400 shadow-red-500/20'
                }`}>
                  {lastScanResult.status === 'success' ? <CheckCircle className="w-8 h-8" /> : 
                   lastScanResult.status === 'duplicate' ? <RefreshCcw className="w-8 h-8" /> :
                   lastScanResult.status === 'info' ? <Info className="w-8 h-8" /> :
                   <AlertCircle className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className={`font-black uppercase tracking-widest text-lg ${
                    lastScanResult.status === 'success' ? 'text-emerald-400' : 
                    lastScanResult.status === 'duplicate' ? 'text-orange-400' :
                    lastScanResult.status === 'info' ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {lastScanResult.status === 'success' ? 'Access Granted' : 
                     lastScanResult.status === 'duplicate' ? 'Already Checked In' :
                     lastScanResult.status === 'info' ? 'Athlete Profile' :
                     'Access Denied'}
                  </h2>
                  <p className="text-gray-400 text-sm font-medium">{lastScanResult.message}</p>
                </div>
              </div>

              {/* Athlete Data (if present) */}
              {lastScanResult.athlete && (
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex gap-4">
                  {lastScanResult.athlete.photoUrl ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-gray-700">
                      <img src={lastScanResult.athlete.photoUrl} alt="Athlete" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-900 border border-gray-700 shrink-0 flex items-center justify-center">
                      <span className="text-gray-600 font-bold uppercase text-2xl">{lastScanResult.athlete.firstName?.[0]}{lastScanResult.athlete.lastName?.[0]}</span>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="text-white font-bold text-xl truncate">{lastScanResult.athlete.firstName} {lastScanResult.athlete.lastName}</h3>
                    <p className="text-orange-400 text-sm font-black uppercase tracking-widest truncate">{lastScanResult.athlete.club || "Independent"}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-gray-900 rounded border border-gray-700 text-gray-400 text-xs font-bold uppercase">{lastScanResult.athlete.category || "Standard"}</span>
                      {lastScanResult.athlete.country && (
                         <span className="px-2 py-0.5 bg-gray-900 rounded border border-gray-700 text-gray-400 text-xs font-bold uppercase">{lastScanResult.athlete.country}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Spectator Order Data (if present) */}
              {lastScanResult.type === 'spectator' && lastScanResult.order && (
                <div className="space-y-4">
                  <div className="bg-gray-800 border-2 border-dashed border-gray-700 rounded-2xl p-6 text-center">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{lastScanResult.order.customer_name}</h3>
                    <p className="text-gray-400 text-sm mb-4">{lastScanResult.order.customer_email}</p>
                    
                    {lastScanResult.order.selected_dates && lastScanResult.order.selected_dates.length > 0 ? (
                      <div className="mb-4 text-left px-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> Attendance Days
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {lastScanResult.order.selected_dates.map(date => (
                            <span key={date} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded uppercase">
                              {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-amber-500 font-black text-xs uppercase tracking-widest">Full Event Access</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Tickets</p>
                        <p className="text-2xl font-black text-white">{lastScanResult.order.ticket_count}</p>
                      </div>
                      <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Scanned</p>
                        <p className="text-2xl font-black text-emerald-400">{lastScanResult.order.scanned_count || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => resumeScanner()}
                      className="flex-1 py-4 rounded-2xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700 transition-all border border-gray-700"
                    >
                      Close
                    </button>
                    {lastScanResult.remaining > 0 && (
                      <button 
                        onClick={() => handleRedeem(1)}
                        className="flex-[2] py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                        disabled={processing}
                      >
                        {processing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Redeem 1 Ticket
                      </button>
                    )}
                    {lastScanResult.remaining > 1 && (
                      <button 
                        onClick={() => handleRedeem(lastScanResult.remaining)}
                        className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
                        disabled={processing}
                      >
                         Redeem All ({lastScanResult.remaining})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Override / Continue */}
              {processing && (
                <div className="mt-6 flex justify-center">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </main>
      
      {/* Global Injection for Scanner Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        #qr-reader { border: none !important; background: transparent; }
        #qr-reader__scan_region { min-height: 100vh !important; display: flex; align-items: center; justify-content: center; background: black; }
        #qr-reader__scan_region img, #qr-reader__scan_region video { object-fit: cover !important; min-height: 100vh !important; min-width: 100vw !important; }
        #qr-reader__dashboard { display: none !important; }
        @keyframes scan { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-scan { animation: scan 2.5s infinite linear; }
      `}} />
    </div>
  );
}
