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
  <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
    <ellipse cx="32" cy="32" rx="8" ry="4" />
    <path d="M12,28 Q22,20 32,28 Q42,36 52,28" stroke="currentColor" strokeWidth="3" fill="none" />
    <path d="M12,36 Q22,28 32,36 Q42,44 52,36" stroke="currentColor" strokeWidth="3" fill="none" />
    <circle cx="44" cy="32" r="6" />
  </svg>
);

export default function Home() {
  return (
    <SwimmingBackground variant="hero">
      <div id="home_page" className="min-h-screen relative">
        {/* Header */}
        <header className="border-b border-white/20 backdrop-blur-xl bg-slate-900/70 relative z-20 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 relative overflow-hidden">
                  <Waves className="w-6 h-6 text-white relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-600/50 to-transparent" />
                </div>
                <span className="text-xl font-bold text-white tracking-wide">
                  ApexAccreditation
                </span>
              </div>
              <Link to="/login">
                <Button variant="outline" size="sm" className="border-cyan-400 text-cyan-300 hover:bg-cyan-500/20 hover:text-white font-semibold">
                  Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section id="home_hero" className="py-20 lg:py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/70 pointer-events-none" />

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/4 w-0.5 h-full bg-gradient-to-b from-cyan-300/10 via-cyan-400/20 to-cyan-300/10" />
              <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gradient-to-b from-cyan-300/10 via-cyan-400/20 to-cyan-300/10" />
              <div className="absolute top-0 left-3/4 w-0.5 h-full bg-gradient-to-b from-cyan-300/10 via-cyan-400/20 to-cyan-300/10" />
            </div>

            <div className="absolute top-1/4 -left-20 opacity-10">
              <motion.div
                animate={{ x: ["0%", "200vw"] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <SwimmerIcon className="w-24 h-24 text-cyan-300" />
              </motion.div>
            </div>
            <div className="absolute top-2/3 -left-40 opacity-5">
              <motion.div
                animate={{ x: ["0%", "200vw"] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 5 }}
              >
                <SwimmerIcon className="w-32 h-32 text-blue-300" />
              </motion.div>
            </div>

            <div className="absolute top-20 right-20 opacity-20">
              <Droplets className="w-16 h-16 text-cyan-300 animate-bounce" style={{ animationDuration: "3s" }} />
            </div>
            <div className="absolute bottom-32 left-16 opacity-15">
              <Droplets className="w-12 h-12 text-blue-300 animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-3xl mx-auto"
              >
                <h1 className="text-4xl lg:text-6xl font-extrabold text-white mb-6 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  Apex Professional{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-300">
                    Accreditation Platform
                  </span>
                </h1>
                <p className="text-xl text-slate-200 mb-8 font-medium leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  Streamline your competition accreditations with our comprehensive platform.
                  Handle participant registration, document verification, badge generation,
                  and zone-based access control all in one place.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/register/swimming-2025">
                    <Button size="lg" icon={ArrowRight} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl shadow-cyan-500/30 text-white font-bold text-lg px-8">
                      Register Now
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" size="lg" className="border-2 border-white/50 text-white bg-white/10 hover:bg-white/20 font-bold text-lg px-8 backdrop-blur-sm">
                      Access Dashboard
                    </Button>
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-16 relative"
              >
                <div className="max-w-2xl mx-auto bg-slate-900/60 backdrop-blur-lg rounded-2xl p-8 border border-cyan-400/30 shadow-2xl shadow-black/30">
                  <div className="flex justify-center gap-8 items-center">
                    <div className="text-center">
                      <Award className="w-12 h-12 text-cyan-400 mx-auto mb-2 drop-shadow-lg" />
                      <p className="text-2xl font-bold text-white">500+</p>
                      <p className="text-lg text-cyan-300/80 font-medium">Events Managed</p>
                    </div>
                    <div className="w-px h-16 bg-cyan-400/30" />
                    <div className="text-center">
                      <Users className="w-12 h-12 text-sky-400 mx-auto mb-2 drop-shadow-lg" />
                      <p className="text-2xl font-bold text-white">50K+</p>
                      <p className="text-lg text-cyan-300/80 font-medium">Athletes Registered</p>
                    </div>
                    <div className="w-px h-16 bg-cyan-400/30" />
                    <div className="text-center">
                      <Timer className="w-12 h-12 text-blue-400 mx-auto mb-2 drop-shadow-lg" />
                      <p className="text-2xl font-bold text-white">5 min</p>
                      <p className="text-lg text-cyan-300/80 font-medium">Avg. Processing</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Features Section */}
          <section id="home_features" className="py-20 relative">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl font-extrabold text-white mb-4 drop-shadow-lg">
                  Everything You Need
                </h2>
                <p className="text-lg text-cyan-200/80 max-w-2xl mx-auto font-medium">
                  A complete solution for managing competition accreditations
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-slate-800/90 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 group hover:-translate-y-1"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4 border border-cyan-500/30 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-all duration-300">
                      <feature.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-lg text-slate-300 font-medium leading-relaxed">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Roles Section */}
          <section id="home_roles" className="py-20 relative">
            <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-md" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-3xl font-extrabold text-white mb-6 drop-shadow-lg">
                    Role-Based Access Control
                  </h2>
                  <p className="text-lg text-slate-300 mb-8 font-medium leading-relaxed">
                    Manage your event team with granular permissions. Super Admins control everything,
                    Event Admins manage specific events, and Viewers have read-only access.
                  </p>
                  <ul className="space-y-4">
                    {[
                      "Super Admin: Full system access and user management",
                      "Event Admin: Manage assigned events and accreditations",
                      "Viewer: Read-only access to event data"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <span className="text-lg text-slate-200 font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-slate-800/90 backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-8 shadow-2xl shadow-black/30"
                >
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/40 border border-slate-600/30">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                        <Waves className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">Super Admin</p>
                        <p className="text-lg text-cyan-400 font-semibold">Full Access</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/40 border border-slate-600/30">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">Event Admin</p>
                        <p className="text-lg text-cyan-400 font-semibold">Event Management</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/40 border border-slate-600/30">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg shadow-slate-500/30">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">Viewer</p>
                        <p className="text-lg text-cyan-400 font-semibold">Read Only</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="relative py-8">
          <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-md" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/30">
                  <Waves className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white tracking-wide">
                  ApexAccreditation
                </span>
              </div>
              <p className="text-lg text-slate-400 font-medium">
                Powered by{" "}
                <a href="https://teachmecode.ae/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold">
                  TeachMeCode Institute
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </SwimmingBackground>
  );
}
