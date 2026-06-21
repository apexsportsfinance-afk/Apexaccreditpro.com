import React from "react";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../../components/ui/Card";

export default function NotificationsTab() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Notifications</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Email on new registration", desc: "Receive email when someone registers" },
            { label: "Email on approval", desc: "Confirm when accreditations are approved" },
            { label: "Email on rejection", desc: "Notify applicants of rejection" }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg text-white font-medium">{item.label}</p>
                <p className="text-lg text-slate-400 font-extralight">{item.desc}</p>
              </div>
              <div className="w-10 h-6 rounded-full bg-primary-600 flex items-center justify-end pr-1 cursor-pointer flex-shrink-0">
                <div className="w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
