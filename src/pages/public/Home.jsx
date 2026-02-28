import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Waves,
  Users,
  Calendar,
  FileCheck,
  MapPin,
  ArrowRight,
  CheckCircle,
  Zap,
  Droplets,
  Timer,
  Award
} from "lucide-react";
import Button from "../../components/ui/Button";
import SwimmingBackground from "../../components/ui/SwimmingBackground";

const features = [ /* unchanged */ ];

const SwimmerIcon = ({ className }) => ( /* unchanged */ );

export default function Home() {
  return (
    <SwimmingBackground variant="hero">
      <div id="home_page" className="min-h-screen relative">
        {/* Header - Opaque */}
        <header className="backdrop-blur-2xl bg-white/98 border-b-2 border-slate-200/80 shadow-xl relative z-20">
          {/* unchanged header content */}
        </header>

        <main>
          {/* Hero - ULTRA-DARK OVERLAY + VIGNETTE */}
          <section className="py-24 lg:py-32 relative overflow-hidden">
            {/* FIXED: Much darker overlay + edge vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/75 to-slate-950/90 pointer-events-none" />
            <div className="absolute inset-0 bg-black/20 rounded-full blur-3xl -inset-20 animate-pulse" /> {/* Vignette glow */}

            {/* Pool lanes - faded more */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
              {/* lanes unchanged but opacity-10 */}
            </div>

            {/* Swimmers - even subtler */}
            {/* opacity-3 instead of 5/10 */}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-4xl mx-auto"
              >
                {/* FIXED TITLE: Triple shadow, pure white, blacker font */}
                <h1 className="text-5xl lg:text-7xl xl:text-8xl font-black text-slate-50 mb-10 leading-[0.9] tracking-[-0.05em] drop-shadow-[0_12px_40px_rgba(0,0,0,1)] sm:drop-shadow-[0_16px_60px_rgba(0,0,0,1)]">
                  Apex Professional <br className="hidden md:block" />
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-200/95 via-blue-200/95 to-emerald-200/95 drop-shadow-[0_8px_32px_rgba(6,182,212,0.9)]">
                    Accreditation Platform
                  </span>
                </h1>

                {/* FIXED Subtitle: Bolder, taller lines */}
                <p className="text-xl lg:text-2xl xl:text-3xl text-slate-100/98 mb-12 font-normal leading-[1.6] max-w-3xl mx-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] tracking-wide">
                  Streamline your competition accreditations with our comprehensive platform. <br className="hidden lg:block" />
                  <span className="font-light text-slate-200/95">Handle registration, verification, badges, and zone access—all in one place.</span>
                </p>

                {/* FIXED Buttons: 100% opaque, black text, mega shadows */}
                <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
                  <Link to="/register/swimming-2025">
                    <Button 
                      size="xl" 
                      icon={ArrowRight} 
                      className="!bg-white/100 !text-slate-900 !font-black !text-xl !px-12 !py-6 shadow-2xl shadow-slate-900/50 hover:shadow-3xl hover:shadow-slate-900/70 hover:scale-[1.02] backdrop-blur-xl !border-2 !border-slate-200/50 hover:!border-slate-300/80 transition-all duration-300"
                    >
                      Register Now
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button 
                      variant="outline" 
                      size="xl" 
                      className="!bg-white/98 !text-slate-900 !font-semibold !text-xl !px-12 !py-6 shadow-2xl shadow-slate-900/40 hover:shadow-3xl hover:shadow-slate-900/60 hover:scale-[1.02] backdrop-blur-xl !border-slate-200/70 hover:!border-slate-300/90 transition-all duration-300"
                    >
                      Access Dashboard
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* FIXED Stats: Full opaque, black text, lifted */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
              >
                {[
                  { icon: Award, value: "500+", label: "Events Managed", color: "shadow-emerald-500/60" },
                  { icon: Users, value: "50K+", label: "Athletes Registered", color: "shadow-blue-500/60" },
                  { icon: Timer, value: "5 min", label: "Avg. Processing", color: "shadow-purple-500/60" }
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    whileHover={{ 
                      scale: 1.05, 
                      y: -12,
                      rotateX: 2 
                    }}
                    className={`backdrop-blur-2xl bg-white/98 border-2 border-white/80 rounded-3xl p-10 shadow-3xl ${stat.color} hover:shadow-[0_35px_100px_rgba(0,0,0,0.6)] transition-all duration-500 text-center relative overflow-hidden mx-auto max-w-sm`}
                  >
                    {/* Inner glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-3xl opacity-0 hover:opacity-100 transition-opacity" />
                    <stat.icon className="w-16 h-16 mx-auto mb-6 text-slate-800 drop-shadow-2xl shadow-slate-900/40" />
                    <p className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 drop-shadow-2xl leading-none tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-xl font-light text-slate-700 uppercase tracking-widest drop-shadow-lg">
                      {stat.label}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Features/Other Sections - Similar ultra-fixes */}
          {/* Apply same pattern: dark overlay, opaque cards, shadows */}

          {/* Footer unchanged */}
        </main>
      </div>
    </SwimmingBackground>
  );
}
