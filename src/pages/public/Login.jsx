import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Shield, Mail, Lock, AlertCircle, Waves, Droplets } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth } from "../../contexts/AuthContext";
import SwimmingBackground from "../../components/ui/SwimmingBackground";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate("/admin");
      } else {
        setError(result.error);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwimmingBackground>
      <div id="login_page" className="min-h-screen flex items-center justify-center p-4 relative">
        {/* Decorative swimming elements */}
        <div className="absolute top-20 left-10 opacity-20">
          <Droplets className="w-12 h-12 text-cyan-500 animate-bounce" style={{ animationDuration: "3s" }} />
        </div>
        <div className="absolute bottom-20 right-10 opacity-20">
          <Droplets className="w-16 h-16 text-blue-500 animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
        </div>
        <div className="absolute top-1/3 right-20 opacity-10">
          <Waves className="w-20 h-20 text-cyan-400" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-ocean-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30 relative overflow-hidden">
              <Shield className="w-10 h-10 text-white relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-600/30 to-transparent" />
              {/* Water ripple effect */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-cyan-300/40 to-transparent animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-ocean-500 mb-2">
              SwimAccredit
            </h1>
            <p className="text-lg text-cyan-600/70">Aquatics Accreditation Platform</p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white/80 backdrop-blur-xl border border-cyan-200/80 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl shadow-cyan-200/30 relative overflow-hidden"
          >
            {/* Decorative pool lane lines */}
            <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-cyan-200/0 via-cyan-200/30 to-cyan-200/0 pointer-events-none" />
            <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-cyan-200/0 via-cyan-200/30 to-cyan-200/0 pointer-events-none" />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg relative z-10"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-lg text-red-600">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4 relative z-10">
              <div className="relative">
                <Mail className="absolute left-3 top-[38px] w-5 h-5 text-cyan-400" />
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@accreditpro.com"
                  className="pl-10"
                  required
                  light
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-[38px] w-5 h-5 text-cyan-400" />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10"
                  required
                  light
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25 relative z-10"
              size="lg"
              loading={loading}
            >
              Sign In
            </Button>

            <div className="text-center space-y-2 relative z-10">
              <p className="text-lg text-slate-400">Demo Credentials:</p>
              <p className="text-lg text-slate-500">
                <span className="text-cyan-600 font-medium">admin@company.com</span> / admin
              </p>
            </div>
          </form>

          <p className="text-center text-lg text-slate-500 mt-6">
            <Link to="/" className="text-cyan-600 hover:text-cyan-500 transition-colors">
              ← Back to Home
            </Link>
          </p>
        </motion.div>
      </div>
    </SwimmingBackground>
  );
}
