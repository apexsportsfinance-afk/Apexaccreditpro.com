import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function DetailActionCard({ title, description, icon: Icon, color, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group w-full text-left h-full"
    >
      <div className="relative overflow-hidden rounded-2xl p-5 h-full bg-base-alt/40 backdrop-blur-xl border border-border group-hover:border-primary-500/50 transition-all duration-500 shadow-xl">
        <div className={`absolute -inset-24 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 blur-[80px] transition-opacity duration-700 pointer-events-none`} />
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${color} opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500`} />
        <div className="relative mb-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg transition-all duration-500 overflow-hidden group-hover:shadow-primary-500/25`}>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Icon className="w-6 h-6 relative z-10" />
          </div>
        </div>
        <div className="relative z-10 space-y-2">
          <h3 className="text-base font-black text-main group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-all duration-300 uppercase tracking-tighter leading-none">
            {title}
          </h3>
          <p className="text-muted text-[11px] font-medium leading-relaxed group-hover:text-main transition-colors duration-300">
            {description}
          </p>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <div className="h-[2px] w-6 bg-border group-hover:w-10 group-hover:bg-primary-500 transition-all duration-700" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted group-hover:text-primary-500 transition-colors duration-500">
            Configure Module
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-primary-500 group-hover:translate-x-1 transition-all duration-500" />
        </div>
      </div>
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 blur-xl transition-opacity duration-700 -z-10`} />
    </motion.button>
  );
}
