import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { QrCode } from "lucide-react";
import Card, { CardContent, CardHeader } from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import QRSystemV3Tab from "../../components/accreditation/QRSystemV3Tab";
import { EventsAPI } from "../../lib/storage";
import { useAuth } from "../../contexts/AuthContext";

export default function QRSystem() {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const { canAccessEvent } = useAuth();

  useEffect(() => {
    EventsAPI.getAll().then(evs => {
      const filtered = evs.filter(e => canAccessEvent(e.id));
      setEvents(filtered);
      if (filtered.length > 0) setSelectedEvent(filtered[0].id);
    }).catch(console.error);
  }, []);

  const handleToast = (msg, type = "success") => {
    if (!msg) return;
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else if (type === "warning") toast.warning(msg);
    else if (type === "info") toast.info(msg);
    else toast.success(msg);
  };

  return (
    <div id="qrsystem_page" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">QR System & Broadcast</h1>
        <p className="text-lg text-slate-400 font-extralight">
          Manage global broadcasts, sport events, PDF slots, and field visibility
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Select
            label="Select Event"
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
            options={events.map(e => ({ value: e.id, label: e.name }))}
            placeholder="Select an event"
          />
        </CardContent>
      </Card>

      {selectedEvent ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <QrCode className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">QR System V3</h2>
                  <p className="text-lg text-slate-400 font-extralight">
                    {events.find(e => e.id === selectedEvent)?.name || "Selected Event"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <QRSystemV3Tab eventId={selectedEvent} onToast={handleToast} />
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-lg text-slate-500 font-extralight">Select an event to manage QR settings</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
