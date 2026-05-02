import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Star, 
  Send, 
  MessageSquare, 
  QrCode, 
  Monitor, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Trophy,
  Users,
  MapPin,
  Megaphone,
  Heart
} from "lucide-react";
import { FeedbackAPI, EventsAPI, ConfigAPI } from "../../lib/storage";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import SwimmingBackground from "../../components/ui/SwimmingBackground";
import { useToast } from "../../components/ui/Toast";

const roles = ["Parent", "Athlete", "Coach", "Team Manager"];
const ratings = ["Excellent", "Good", "Average", "Needs Improvement"];

const StarRating = ({ value, onChange, max = 5, label }) => (
  <div className="flex flex-col gap-2">
    {label && <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{label}</p>}
    <div className="flex gap-2">
      {[...Array(max)].map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="transition-transform hover:scale-125 focus:outline-none"
        >
          <Star 
            className={`w-8 h-8 ${i < value ? "fill-primary-400 text-primary-400" : "text-slate-700"}`} 
          />
        </button>
      ))}
    </div>
  </div>
);

export default function FeedbackForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    role: "",
    overallRating: 5,
    organisationRating: "Excellent",
    competitionRating: 5,
    qrUsed: true,
    qrEase: 5,
    qrValue: "Much better",
    qrFeatures: [],
    qrImproveText: "",
    venueRating: 5,
    communicationRating: 5,
    npsScore: 10,
    likedMost: "",
    improveFuture: "",
    systemImprovement: "",
    additionalComments: "",
    dynamicResponses: {}
  });

  useEffect(() => {
    async function loadData() {
      try {
        const ev = await EventsAPI.getBySlug(slug);
        if (!ev) {
          toast.error("Event not found");
          navigate("/");
          return;
        }
        setEvent(ev);
        
        const conf = await ConfigAPI.getFeedback(ev.id);
        if (conf) {
          setConfig(conf);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, navigate]);

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateDynamicValue = (id, value) => {
    setForm(prev => ({
      ...prev,
      dynamicResponses: { ...prev.dynamicResponses, [id]: value }
    }));
  };

  const handleSubmit = async () => {
    console.log("Submitting feedback for event:", event?.id, form);
    if (!form.role) {
      console.warn("Feedback submission blocked: No role selected");
      toast.error("Please select your role first.");
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      const dynamicText = config?.questions?.map(q =>
        `${q.label}: ${form.dynamicResponses[q.id] || "N/A"}`
      ).join("\n") || "";

      const submissionData = {
        ...form,
        eventId: event.id,
        additionalComments: dynamicText
          ? `DYNAMIC FEEDBACK:\n${dynamicText}\n\n${form.additionalComments}`
          : form.additionalComments
      };

      console.log("Sending feedback data to API:", submissionData);
      await FeedbackAPI.submit(submissionData);
      
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    } catch (err) {
      console.error("Feedback submission error:", err);
      const msg = err?.message || err?.details || "Unknown error";
      toast.error(`Submission failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SwimmingBackground variant="hero"><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary-500 animate-spin" /></div></SwimmingBackground>;

  if (submitted) {
    return (
      <SwimmingBackground variant="hero">
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-primary-500/30 p-10 rounded-3xl shadow-2xl"
          >
            <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-primary-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Success!</h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              {config?.thank_you_message || "Thank you for being part of the event. Your feedback is very important to us!"}
            </p>
            <Button onClick={() => navigate("/")} variant="primary" className="w-full h-14 rounded-2xl text-lg font-bold">
              Return Home
            </Button>
          </motion.div>
        </div>
      </SwimmingBackground>
    );
  }

  // Generate Steps
  const renderQuestion = (q) => {
    switch(q.type) {
      case "rating":
        return <StarRating key={q.id} label={q.label} value={form.dynamicResponses[q.id] || 0} onChange={v => updateDynamicValue(q.id, v)} />;
      case "choice":
        return (
          <div key={q.id} className="space-y-4">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{q.label}</p>
            <div className="grid grid-cols-1 gap-2">
              {q.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => updateDynamicValue(q.id, opt)}
                  className={`p-4 rounded-xl border transition-all text-left font-bold ${
                    form.dynamicResponses[q.id] === opt 
                      ? "bg-primary-500/20 border-primary-500 text-white shadow-cyanGlow" 
                      : "bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      case "text":
        return (
          <div key={q.id} className="space-y-4">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{q.label}</p>
            <textarea
              value={form.dynamicResponses[q.id] || ""}
              onChange={e => updateDynamicValue(q.id, e.target.value)}
              placeholder="Your answer..."
              className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary-500"
            />
          </div>
        );
      default:
        return null;
    }
  };

  let steps = [];
  
  if (config) {
    // Page 0: Intro
    steps.push(
      <div key="intro" className="space-y-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-bold mb-4">
            <MessageSquare className="w-4 h-4" /> Participation Feedback
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{config.title}</h1>
          <p className="text-slate-400">{event.name}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 text-center">
          <p className="text-slate-200 leading-relaxed">{config.description}</p>
        </div>
        <div className="space-y-4">
          <p className="text-lg font-bold text-white">Select your role:</p>
          <div className="grid grid-cols-2 gap-3">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => updateForm("role", r)}
                className={`p-4 rounded-xl border transition-all text-center font-bold ${
                  form.role === r 
                    ? "bg-primary-500/20 border-primary-500 text-white" 
                    : "bg-slate-900/50 border-white/5 text-slate-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Group remaining questions into steps of 2
    const questionsPerStep = 2;
    for (let i = 0; i < config.questions.length; i += questionsPerStep) {
      const batch = config.questions.slice(i, i + questionsPerStep);
      steps.push(
        <div key={`step-${i}`} className="space-y-10 pt-4">
          {batch.map(renderQuestion)}
        </div>
      );
    }
  } else {
    // Fallback: full DIAC 2026 hardcoded template
    steps = [
      <div key="s0" className="space-y-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-bold mb-4">
            <Trophy className="w-4 h-4" /> DIAC 2026 Feedback
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{event.name}</h1>
          <p className="text-slate-400">Give feedback (2 mins only)</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 text-center">
          <p className="text-slate-200 leading-relaxed">
            Thank you for being part of DIAC 2026. Your insights help us improve future events.
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-primary-400" /> I am a:</p>
          <div className="grid grid-cols-2 gap-3">
            {roles.map(r => (
              <button key={r} onClick={() => updateForm("role", r)}
                className={`p-4 rounded-xl border transition-all text-center font-bold ${form.role === r ? "bg-primary-500/20 border-primary-500 text-white shadow-cyanGlow" : "bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>,

      <div key="s1" className="space-y-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><CheckCircle className="w-6 h-6 text-primary-400" /> General Experience</h2>
        <StarRating label="1. Overall Experience" value={form.overallRating} onChange={v => updateForm("overallRating", v)} />
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">2. Event Organisation</p>
          <div className="grid grid-cols-1 gap-2">
            {["Excellent", "Good", "Average", "Needs Improvement"].map(r => (
              <button key={r} onClick={() => updateForm("organisationRating", r)}
                className={`p-4 rounded-xl border transition-all text-left font-bold ${form.organisationRating === r ? "bg-primary-500/20 border-primary-500 text-white shadow-cyanGlow" : "bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <StarRating label="3. Competition Experience (Schedule / Flow)" value={form.competitionRating} onChange={v => updateForm("competitionRating", v)} />
      </div>,

      <div key="s2" className="space-y-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><QrCode className="w-6 h-6 text-yellow-400" /> QR System</h2>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">4. Did you use the QR system?</p>
          <div className="flex gap-3">
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => updateForm("qrUsed", v)}
                className={`flex-1 p-4 rounded-xl border transition-all font-bold ${form.qrUsed === v ? "bg-primary-500/20 border-primary-500 text-white shadow-cyanGlow" : "bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20"}`}>
                {v ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>
        <StarRating label="5. Ease of Use" value={form.qrEase} onChange={v => updateForm("qrEase", v)} />
      </div>,

      <div key="s3" className="space-y-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><MapPin className="w-6 h-6 text-red-400" /> Venue & Operations</h2>
        <StarRating label="6. Venue & Facilities (Hamdan Sports Complex)" value={form.venueRating} onChange={v => updateForm("venueRating", v)} />
        <StarRating label="7. Communication Effectiveness" value={form.communicationRating} onChange={v => updateForm("communicationRating", v)} />
      </div>,

      <div key="s4" className="space-y-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Megaphone className="w-6 h-6 text-purple-400" /> Final Impact</h2>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">8. How likely to recommend DIAC? (0–10)</p>
          <div className="flex justify-between items-center bg-slate-900/80 p-4 rounded-2xl border border-white/5">
            {[...Array(11)].map((_, i) => (
              <button key={i} onClick={() => updateForm("npsScore", i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${form.npsScore === i ? "bg-primary-500 text-white scale-125 shadow-cyanGlow" : "text-slate-500 hover:text-white"}`}>
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between px-2 text-[10px] uppercase font-bold text-slate-500">
            <span>Not likely</span><span>Very likely</span>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">9. What did you like most?</p>
          <textarea value={form.likedMost} onChange={e => updateForm("likedMost", e.target.value)}
            placeholder="Friendly staff, fast results..."
            className="w-full h-20 bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary-500" />
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">10. What can we improve?</p>
          <textarea value={form.improveFuture} onChange={e => updateForm("improveFuture", e.target.value)}
            placeholder="Any suggestions..."
            className="w-full h-20 bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary-500" />
        </div>
      </div>
    ];
  }

  const canContinue = () => {
    if (step === 0) return !!form.role;
    return true;
  };

  return (
    <SwimmingBackground variant="hero">
      <div id="feedback_form_page" className="min-h-screen py-12 px-4 relative">
        <div className="max-w-xl mx-auto">
          <Card className="p-8 md:p-10 bg-slate-900/80 backdrop-blur-xl border-white/10 rounded-3xl shadow-2xl">
            <div className="mb-10 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary-500 shadow-cyanGlow"
                initial={{ width: '0%' }}
                animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>

            <form onSubmit={e => e.preventDefault()}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {steps[step]}
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-4 mt-12 pt-6 border-t border-white/5">
                {step > 0 && (
                  <Button
                    onClick={() => setStep(s => s - 1)}
                    variant="outline"
                    icon={ArrowLeft}
                    className="flex-1 h-14 rounded-2xl border-white/10"
                  >
                    Back
                  </Button>
                )}
                
                {step < steps.length - 1 ? (
                  <Button
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canContinue()}
                    icon={ArrowRight}
                    className="flex-[2] h-14 rounded-2xl bg-primary-500 font-bold"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    loading={submitting}
                    icon={Send}
                    className="flex-[2] h-14 rounded-2xl bg-primary-600 shadow-cyanGlow font-bold"
                  >
                    Submit Feedback
                  </Button>
                )}
              </div>
            </form>
          </Card>
          
          <div className="mt-8 text-center text-slate-500 text-sm italic">
            ApexAccreditation Dynamic Event System
          </div>
        </div>
      </div>
    </SwimmingBackground>
  );
}
