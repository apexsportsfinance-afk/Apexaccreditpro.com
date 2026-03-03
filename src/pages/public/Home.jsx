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

const features = [
  {
    icon: Users,
    title: "Multi-Event Support",
    description: "Manage multiple competitions simultaneously with isolated data and configurations."
  },
  {
    icon: FileCheck,
    title: "Document Verification",
    description: "Streamlined approval workflow with photo and ID document validation for athletes."
  },
  {
    icon: MapPin,
    title: "Zone-Based Access",
    description: "Configure venue zones and generate credentials with proper permissions."
  },
  {
    icon: Zap,
    title: "Instant Badges",
    description: "Generate professional PDF accreditation cards with QR verification."
  }
];

const SwimmerIcon = ({ className }) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
    <ellipse cx="32" cy="32" rx="8" ry="4" />
    <path d="M12,28 Q22,20 32,28 Q42,36 52,28" />
    <path d="M12,36 Q22,28 32,36 Q42,44 52,36" />
    <circle cx="44" cy="32" r="6" />
  </svg>
);

export default function Home() {
  return (
    <SwimmingBackground variant="hero">
      <div id="home_page" className="min-h-screen relative">
        {/* Header */}
        <header className="backdrop-blur-xl bg-white/80 border-b border-slate-200/60 relative z-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/40 relative overflow-hidden">
                  <Waves className="w-6 h-6 text-white relative z-10 drop-shadow-lg" />
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-700/50 to-transparent animate-pulse" />
                </div>
                <span className="text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent tracking-tight">
                  ApexAccreditation
                </span>
              </div>
              <Link to="/login">
                <Button variant="outline" size="sm" className="!bg-white/90 hover:!bg-white shadow-sm border-slate-300">
                  Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main>
          {/* Hero Section - Enhanced Overlay & Shadows */}
          <section className="py-24 lg:py-32 relative overflow-hidden">
            {/* Darker gradient overlay for entire hero */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-800/60 to-transparent pointer-events-none" />
            
            {/* Pool lanes (kept, but faded */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-0 left-1/4 w-0.5 h-full bg-gradient-to-b from-white/40 to-white/10" />
              <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gradient-to-b from-white/40 to-white/10" />
              <div className="absolute top-0 left-3/4 w-0.5 h-full bg-gradient-to-b from-white/40 to-white/10" />
            </div>

            {/* Animated swimmers (subtler) */}
            <div className="absolute top-1/4 -left-20 opacity-5">
              <motion.div animate={{ x: ["0%", "200vw"] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}>
                <SwimmerIcon className="w-24 h-24 text-slate-200" />
              </motion.div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-4xl mx-auto"
              >
                <h1 className="text-5xl lg:text-7xl font-black text-slate-50 mb-8 leading-tight drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)] tracking-tight">
                  Apex Professional <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 drop-shadow-[0_4px_20px_rgba(6,182,212,0.8)]">
                    Accreditation Platform
                  </span>
                </h1>
                <p className="text-xl lg:text-2xl text-slate-200/95 mb-12 font-light leading-relaxed max-w-2xl mx-auto drop-shadow-lg">
                  Streamline competition accreditations: Registration, verification, badges, and zone access—all in one secure platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Link to="/register/swimming-2025">
                    <Button size="lg" icon={ArrowRight} className="text-xl px-8 py-4 shadow-2xl shadow-cyan-500/40 !bg-gradient-to-r !from-cyan-500 !to-emerald-500 hover:shadow-cyan-600/50 hover:scale-[1.02] backdrop-blur-sm">
                      Register Now
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" size="lg" className="!bg-white/95 !text-slate-900 hover:!bg-white shadow-xl border-slate-200/50 text-xl px-8 py-4 font-semibold backdrop-blur-xl">
                      Admin Dashboard
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Stats Cards - Frosted Glass */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
              >
                {[
                  { icon: Award, value: "500+", label: "Events Managed", color: "from-emerald-500 to-cyan-500" },
                  { icon: Users, value: "50K+", label: "Athletes Registered", color: "from-blue-500 to-indigo-500" },
                  { icon: Timer, value: "5 min", label: "Avg. Processing", color: "from-purple-500 to-pink-500" }
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    whileHover={{ scale: 1.05, y: -4 }}
                    className={`backdrop-blur-xl bg-white/90 border border-white/70 rounded-2xl p-8 shadow-2xl shadow-slate-200/50 hover:shadow-slate-300/70 transition-all duration-500 text-center`}
                  >
                    <stat.icon className="w-12 h-12 mx-auto mb-4 text-slate-700 drop-shadow-lg" />
                    <p className={`text-3xl lg:text-4xl font-black text-slate-900 mb-2 drop-shadow-md`}>{stat.value}</p>
                    <p className="text-lg font-light text-slate-600 tracking-wide">{stat.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Features - Dark Overlay Cards */}
          <section className="py-24 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-800/40 to-transparent pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
                <h2 className="text-4xl lg:text-5xl font-black text-slate-50 mb-6 drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)]">
                  Everything You Need
                </h2>
                <p className="text-xl lg:text-2xl text-slate-200/95 font-light max-w-3xl mx-auto drop-shadow-lg">
                  Complete solution for professional accreditation management
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -8 }}
                    className="group backdrop-blur-xl bg-white/90 border border-white/80 rounded-3xl p-8 shadow-2xl shadow-slate-300/50 hover:shadow-slate-400/70 hover:bg-white/95 transition-all duration-500 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/80 to-blue-400/80 flex items-center justify-center mb-6 border-4 border-white/50 shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300 mx-auto drop-shadow-2xl">
                      <feature.icon className="w-8 h-8 text-slate-800 drop-shadow-lg" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-4 group-hover:text-slate-800 drop-shadow-lg leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-lg text-slate-600 font-light leading-relaxed drop-shadow-md">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Roles Section - Similar Treatment */}
          <section className="py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                  <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-8 drop-shadow-2xl">
                    Role-Based <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-emerald-600">Access Control</span>
                  </h2>
                  <p className="text-xl lg:text-2xl text-slate-600 mb-10 font-light leading-relaxed max-w-lg drop-shadow-lg">
                    Granular permissions for your team. Secure and scalable.
                  </p>
                  <ul className="space-y-6 text-lg">
                    {[
                      "Super Admin: Full system control & user management",
                      "Event Admin: Manage events, approvals & badges",
                      "Viewer: Read-only dashboards & reports"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-4 group">
                        <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg mt-0.5">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </motion.div>
                        <span className="font-light text-slate-700 group-hover:text-slate-900">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="backdrop-blur-xl bg-white/90 border border-slate-200/70 rounded-3xl p-10 shadow-2xl shadow-slate-200/50">
                  <div className="space-y-8">
                    {[
                      { icon: Waves, label: "Super Admin", role: "Full Access", color: "from-red-500 to-rose-500" },
                      { icon: Calendar, label: "Event Admin", role: "Event Management", color: "from-cyan-500 to-blue-500" },
                      { icon: Users, label: "Viewer", role: "Read Only", color: "from-slate-500 to-slate-600" }
                    ].map((role, i) => (
                      <motion.div
                        key={role.label}
                        whileHover={{ scale: 1.02 }}
                        className={`flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-r ${role.color} text-white shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-white/30`}
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-lg">
                          <role.icon className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-xl font-black">{role.label}</p>
                          <p className="text-lg font-light opacity-90">{role.role}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer - Enhanced */}
        <footer className="backdrop-blur-xl bg-white/90 border-t-2 border-slate-200/70 py-12 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/40">
                  <Waves className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
                  ApexAccreditation
                </span>
              </div>
            </div>
            <p className="text-xl text-slate-600 font-light max-w-2xl mx-auto leading-relaxed">
              Professional accreditation platform by{" "}
              <a href="https://biela.dev/" target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-600 hover:text-cyan-700 underline decoration-cyan-200 transition-all">
                Biela.dev
              </a>
              {" "}• Powered by{" "}
              <a href="https://teachmecode.ae/" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 hover:text-emerald-700 underline decoration-emerald-200 transition-all">
                TeachMeCode® Institute
              </a>
            </p>
          </div>
        </footer>
      </div>
    </SwimmingBackground>
  );
}
