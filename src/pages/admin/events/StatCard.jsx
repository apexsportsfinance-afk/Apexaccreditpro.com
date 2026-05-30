import React from "react";
import Card, { CardContent } from "../../../components/ui/Card";

export default function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="border-slate-800 bg-slate-900/40 overflow-hidden relative group">
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${color}`} />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">{label}</p>
            <p className="text-3xl font-black text-main tracking-tighter">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
