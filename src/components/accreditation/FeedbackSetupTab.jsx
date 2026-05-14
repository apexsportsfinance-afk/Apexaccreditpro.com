import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Trash2, 
  Save, 
  GripVertical, 
  MessageSquare, 
  CheckCircle2, 
  Layout,
  Type,
  List,
  Star,
  Copy,
  ExternalLink
} from "lucide-react";
import { ConfigAPI } from "../../lib/storage";
import { GlobalSettingsAPI } from "../../lib/broadcastApi";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";

const QUESTION_TYPES = [
  { id: "rating", label: "Rating (1-5)", icon: Star },
  { id: "choice", label: "Multiple Choice", icon: List },
  { id: "text", label: "Open Question", icon: Type }
];

export default function FeedbackSetupTab({ eventId, onToast, disabled }) {
  const [config, setConfig] = useState({
    title: "DIAC 2026 – Event Feedback",
    description: "Thank you for being part of DIAC 2026. Your feedback is very important to help us improve future events.",
    thank_you_message: "Thank you for your valuable feedback!",
    is_active: false,
    questions: [
      { id: "q1", type: "rating", label: "Overall Experience", required: true },
      { id: "q2", type: "choice", label: "I am a:", options: ["Parent", "Athlete", "Coach", "Team Manager"], required: true }
    ]
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const data = await ConfigAPI.getFeedback(eventId);
        // Load is_active from GlobalSettings (stored separately since feedback_configs may not have the column)
        const isActiveRaw = await GlobalSettingsAPI.get(`event_${eventId}_feedback_is_active`);
        const isActive = isActiveRaw === 'true' || isActiveRaw === true;
        if (data) {
          setConfig({ ...data, is_active: isActive });
        } else {
          setConfig(prev => ({ ...prev, is_active: isActive }));
        }
      } catch (err) {
        console.error(err);
        onToast?.("Failed to load feedback configuration", "error");
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [eventId]);

  const handleSave = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      // Save is_active separately via GlobalSettings (reliable key-value store)
      await GlobalSettingsAPI.set(`event_${eventId}_feedback_is_active`, String(config.is_active ?? false));
      // Save the rest of the config (title, description, questions etc)
      const { is_active, ...configWithoutIsActive } = config;
      await ConfigAPI.saveFeedback({
        event_id: eventId,
        ...configWithoutIsActive
      });
      toast.success(config.is_active ? "✅ Feedback enabled and saved!" : "✅ Feedback hidden from accreditation page!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save configuration: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = (type) => {
    if (disabled) return;
    const newQ = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: "New Question",
      required: true,
      options: type === "choice" ? ["Option 1", "Option 2"] : []
    };
    setConfig(prev => ({
      ...prev,
      questions: [...prev.questions, newQ]
    }));
  };

  const removeQuestion = (id) => {
    if (disabled) return;
    setConfig(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
  };

  const updateQuestion = (id, updates) => {
    if (disabled) return;
    setConfig(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  if (loading) return <div className="p-12 text-center animate-pulse text-slate-500">Loading configuration...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Form Title</label>
            <input 
              type="text" 
              value={config.title}
              onChange={(e) => setConfig({...config, title: e.target.value})}
              disabled={disabled}
              className={cn(
                "w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 outline-none transition-all",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              placeholder="e.g. DIAC 2026 – Event Feedback"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Description</label>
            <textarea 
              value={config.description}
              onChange={(e) => setConfig({...config, description: e.target.value})}
              disabled={disabled}
              className={cn(
                "w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 outline-none transition-all h-24 resize-none",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              placeholder="Enter form description..."
            />
          </div>

          <div className="pt-2">
            <label className={cn("flex items-center gap-3 group", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={config.is_active}
                  onChange={(e) => setConfig({...config, is_active: e.target.checked})}
                  disabled={disabled}
                  className="sr-only peer"
                />
                <div className={cn(
                  "w-11 h-6 bg-slate-800 border border-white/10 rounded-full peer peer-checked:bg-primary-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white",
                  !disabled && "group-hover:border-white/20"
                )} />
              </div>
              <div>
                <span className={cn("text-sm font-bold text-white uppercase tracking-widest transition-colors", !disabled && "group-hover:text-primary-400")}>Show Feedback on Accreditation</span>
                <p className="text-[10px] text-slate-500 font-medium">When enabled, the "Your Voice Matters" section appears on the participant's pass.</p>
              </div>
            </label>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Thank You Message</label>
            <textarea 
              value={config.thank_you_message}
              onChange={(e) => setConfig({...config, thank_you_message: e.target.value})}
              disabled={disabled}
              className={cn(
                "w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 outline-none transition-all h-24 resize-none",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              placeholder="Message shown after submission..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="primary" 
              icon={Save} 
              loading={saving}
              disabled={disabled}
              onClick={handleSave}
              className="w-full md:w-auto"
            >
              {disabled ? "View Only Mode" : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Layout className="w-4 h-4 text-primary-400" /> Form Questions
            </h3>
            <p className="text-sm text-slate-500">Design your multi-step feedback journey</p>
          </div>
          <div className="flex gap-2">
            {QUESTION_TYPES.map(type => (
              <Button 
                key={type.id}
                variant="outline" 
                size="sm" 
                icon={type.icon}
                disabled={disabled}
                onClick={() => addQuestion(type.id)}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {config.questions.map((q, index) => (
              <motion.div 
                key={q.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group relative bg-slate-900/50 border border-white/5 rounded-2xl p-6 transition-all",
                  !disabled && "hover:border-primary-500/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("mt-2 text-slate-600", !disabled ? "cursor-grab active:cursor-grabbing" : "opacity-30")}>
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-400 border border-white/5">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/50 rounded text-[10px] font-black uppercase tracking-widest text-slate-500 border border-white/5">
                          {QUESTION_TYPES.find(t => t.id === q.type)?.icon && React.createElement(QUESTION_TYPES.find(t => t.id === q.type).icon, { className: "w-3 h-3" })}
                          {q.type}
                        </div>
                      </div>
                      <button 
                        onClick={() => removeQuestion(q.id)}
                        disabled={disabled}
                        className={cn(
                          "p-2 text-slate-600 transition-colors bg-slate-800/0 rounded-lg",
                          !disabled ? "hover:text-red-400 hover:bg-red-400/10" : "opacity-30 cursor-not-allowed"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <input 
                      type="text" 
                      value={q.label}
                      onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                      disabled={disabled}
                      className={cn(
                        "w-full bg-transparent text-lg font-bold text-white placeholder:text-slate-700 border-none focus:ring-0 p-0",
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                      placeholder="Question Label..."
                    />

                    {q.type === "choice" && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Options</label>
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 gap-2">
                              <input 
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...q.options];
                                  newOpts[optIndex] = e.target.value;
                                  updateQuestion(q.id, { options: newOpts });
                                }}
                                disabled={disabled}
                                className={cn("bg-transparent border-none text-xs text-white p-0 focus:ring-0 w-24", disabled && "cursor-not-allowed")}
                              />
                              <button 
                                onClick={() => {
                                  const newOpts = q.options.filter((_, i) => i !== optIndex);
                                  updateQuestion(q.id, { options: newOpts });
                                }}
                                disabled={disabled}
                                className={cn("text-slate-500", !disabled ? "hover:text-red-400" : "opacity-30 cursor-not-allowed")}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => updateQuestion(q.id, { options: [...q.options, "New Option"] })}
                            disabled={disabled}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border border-dashed border-white/10 text-slate-500 transition-all text-xs flex items-center gap-1",
                              !disabled ? "hover:text-white hover:border-white/20" : "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <Plus className="w-3 h-3" /> Add Option
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
