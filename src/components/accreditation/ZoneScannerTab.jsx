import React, { useState, useEffect } from "react";
import { QrCode, Copy, ExternalLink, ShieldCheck, MapPin, Loader2 } from "lucide-react";
import { ZonesAPI } from "../../lib/storage";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import Card, { CardContent } from "../ui/Card";

export default function ZoneScannerTab({ eventId, onToast, disabled }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      setLoading(true);
      ZonesAPI.getByEventId(eventId)
        .then(data => {
          // Sort by name or code
          setZones(data.sort((a, b) => a.code.localeCompare(b.code)));
        })
        .catch(err => {
          console.error("Failed to load zones:", err);
          onToast?.("Failed to load zones", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [eventId]);

  const getScannerUrl = (zone) => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      mode: "attendance",
      event_id: eventId,
      zone: zone.code,
      device_label: `${zone.name}`
    });
    return `${baseUrl}/scanner?${params.toString()}`;
  };

  const copyToClipboard = (text) => {
    if (disabled) return;
    navigator.clipboard.writeText(text);
    onToast?.("Link copied to clipboard!", "success");
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-extralight uppercase tracking-widest text-[10px]">Loading Zone Matrix...</p>
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="py-12 border-2 border-dashed border-white/5 rounded-2xl text-center">
        <MapPin className="w-12 h-12 text-slate-700 mx-auto mb-4" />
        <p className="text-white font-bold mb-1">No Zones Defined</p>
        <p className="text-slate-500 text-sm max-w-xs mx-auto">Please define your event zones in the Zones management page first.</p>
      </div>
    );
  }

  return (
    <div id="zone-scanner-tab" className="space-y-6">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-3 bg-blue-500/20 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg mb-1 uppercase tracking-tight">Zone Access Launchpad</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Generate "Locked Scanners" for your security personnel. Each link below will transform a guard's device into a dedicated checkpoint for that specific room or area.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone) => {
          const scannerUrl = getScannerUrl(zone);
          return (
            <Card key={zone.id} className={cn(
              "overflow-hidden bg-slate-900/40 border-white/5 transition-all group",
              !disabled && "hover:border-blue-500/30"
            )}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-lg"
                    style={{ backgroundColor: zone.color || '#3b82f6' }}
                  >
                    {zone.code}
                  </div>
                  <div>
                    <h4 className="text-white font-bold uppercase tracking-tight leading-tight">{zone.name}</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mt-1">
                      Sector {zone.code}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="primary" 
                    disabled={disabled}
                    className={cn(
                      "w-full justify-between h-11",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !disabled && window.open(scannerUrl, '_blank')}
                  >
                    <span className="flex items-center gap-2">
                      <QrCode className="w-4 h-4" />
                      Launch Scanner
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                  </Button>
                  
                  <Button 
                    variant="secondary" 
                    disabled={disabled}
                    className={cn(
                      "w-full h-11 bg-white/5",
                      !disabled ? "hover:bg-white/10" : "opacity-30 cursor-not-allowed"
                    )}
                    onClick={() => copyToClipboard(scannerUrl)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Access Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
