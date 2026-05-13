import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Activity, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle,
  Calendar,
  Info,
  Layers,
  MapPin,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

export default function MedicalBookingSelector({ field, value, onChange, eventId, language = 'en' }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookedCounts, setBookedCounts] = useState({});
  
  const [selectedTest, setSelectedTest] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Step state for UI flow: 1=Type, 2=Date, 3=Time
  const [activeStep, setActiveStep] = useState(1);

  // Dynamic titles based on the field label
  const displayLabel = language === 'ar' ? field.label_ar : field.label_en;
  const genericTypeLabel = language === 'ar' ? 'النوع' : 'Type';

  // Parse existing value if any (Format: "TestName | YYYY-MM-DD | HH:MM")
  useEffect(() => {
    if (value && typeof value === 'string' && value.includes(' | ')) {
      const parts = value.split(' | ');
      if (parts.length === 3) {
        setSelectedTest(parts[0]);
        setSelectedDate(parts[1]);
        setSelectedTime(parts[2]);
        setActiveStep(3); // Show the final step/summary if already selected
      }
    } else if (!value) {
      // If value is cleared from outside, reset local state too
      setSelectedTest('');
      setSelectedDate('');
      setSelectedTime('');
      setActiveStep(1);
    }
  }, [value]);

  useEffect(() => {
    try {
      if (field.options) {
        const parsed = JSON.parse(field.options);
        setConfig(parsed);
      }
    } catch (e) {
      console.error("Failed to parse Booking config:", e);
    }
  }, [field.options]);

  useEffect(() => {
    if (!eventId || !config) return;

    const fetchBookings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('accreditations')
          .select('custom_message')
          .eq('event_id', eventId);

        if (error) throw error;

        const counts = {};
        data.forEach(row => {
          if (row.custom_message) {
            try {
              const meta = typeof row.custom_message === 'string' ? JSON.parse(row.custom_message) : row.custom_message;
              const bookingStr = meta[field.id];
              if (bookingStr && typeof bookingStr === 'string' && bookingStr.includes(' | ')) {
                counts[bookingStr] = (counts[bookingStr] || 0) + 1;
              }
            } catch (e) {}
          }
        });
        setBookedCounts(counts);
      } catch (e) {
        console.error("Failed to fetch bookings:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [eventId, config, field.id]);

  const handleUpdate = (test, date, time) => {
    if (test && date && time) {
      onChange({ target: { name: `custom_${field.id}`, value: `${test} | ${date} | ${time}` } });
    } else {
      onChange({ target: { name: `custom_${field.id}`, value: "" } });
    }
  };

  const generateTimeSlots = (dateString) => {
    if (!config || !config.dateRanges) return [];
    const range = config.dateRanges.find(r => r.date === dateString);
    if (!range) return [];

    const slots = [];
    const [startH, startM] = range.startTime.split(':').map(Number);
    const [endH, endM] = range.endTime.split(':').map(Number);
    
    let current = new Date();
    current.setHours(startH, startM, 0, 0);
    
    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    const duration = config.duration || 15;

    while (current < end) {
      const h = current.getHours().toString().padStart(2, '0');
      const m = current.getMinutes().toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      current.setMinutes(current.getMinutes() + duration);
    }

    return slots;
  };

  if (!config) return (
    <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-sm font-medium">
      <AlertCircle className="w-4 h-4" />
      {language === 'ar' ? 'تكوين الحجز مفقود أو غير صالح.' : 'Booking configuration missing or invalid.'}
    </div>
  );

  const availableDates = (config.dateRanges || []).map(r => r.date).sort();
  const timeSlots = selectedDate ? generateTimeSlots(selectedDate) : [];

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  // Condition to show selection flow: either no value, or active step is NOT the final confirmation step
  // But we want to hide selection flow if a booking is ALREADY confirmed AND we are not in "edit mode"
  // Actually, let's keep it simple: if value exists, show Ticket. If no value, show Selection.
  // "Update Appointment" will clear the value.

  return (
    <div className="relative space-y-6 bg-slate-900/40 backdrop-blur-2xl border border-slate-700/40 p-6 lg:p-8 rounded-[2.5rem] overflow-hidden group shadow-2xl">
      {/* Dynamic Glow background */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-primary-500/20 transition-all duration-1000" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-1000" />

      {/* Header with Step Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-800/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700/50 flex items-center justify-center shadow-2xl">
            <Calendar className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
              {displayLabel}
              {field.required && <span className="text-red-500 text-sm">*</span>}
            </h3>
            <p className="text-[10px] text-primary-500 uppercase tracking-[0.3em] font-black opacity-80">{language === 'ar' ? 'نظام الحجز الديناميكي' : 'Dynamic Booking System'}</p>
          </div>
        </div>

        {!value && (
          <div className="flex items-center gap-3 bg-slate-950/40 p-1.5 rounded-full border border-slate-800/50">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${
                    activeStep >= step 
                      ? 'bg-primary-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {activeStep > step ? <CheckCircle className="w-4 h-4" /> : step}
                </div>
                {step < 3 && (
                  <div className={`w-6 h-0.5 mx-0.5 transition-colors duration-500 ${activeStep > step ? 'bg-primary-500' : 'bg-slate-800'}`} />
                )}
              </div>
            ))}
          </div>
        )}
        
        {value && (
           <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Completed</span>
           </div>
        )}
      </div>

      <div className="min-h-[100px]">
        {/* Selection Flow: Only visible if no confirmed value exists */}
        <AnimatePresence mode="wait">
          {!value && (
            <motion.div 
              key="selection-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* STEP 1: Selection Type */}
              {activeStep === 1 && (
                <motion.div 
                  key="step1"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-black uppercase tracking-[0.25em] text-primary-400/80">
                      Step 1: Select {displayLabel} {genericTypeLabel}
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(config.tests || []).map(test => (
                      <button
                        key={test}
                        type="button"
                        onClick={() => {
                          setSelectedTest(test);
                          setActiveStep(2);
                        }}
                        className="flex items-center justify-between px-6 py-5 rounded-[1.5rem] bg-slate-950/40 border border-slate-800 hover:border-primary-500/50 hover:bg-slate-800/40 transition-all group/btn shadow-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover/btn:bg-primary-500/20 group-hover/btn:border-primary-500/30 transition-all">
                            <Layers className="w-5 h-5 text-slate-500 group-hover/btn:text-primary-400" />
                          </div>
                          <span className="text-base font-bold text-slate-200 group-hover/btn:text-white transition-colors">{test}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 group-hover/btn:bg-primary-500 group-hover/btn:text-white transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Date Selection */}
              {activeStep === 2 && (
                <motion.div 
                  key="step2"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-black uppercase tracking-[0.25em] text-primary-400/80">
                      Step 2: Choose Date
                    </label>
                    <button onClick={() => setActiveStep(1)} className="text-[10px] font-bold text-slate-500 hover:text-primary-400 transition-colors uppercase tracking-widest flex items-center gap-1">
                       <ChevronRight className="w-3 h-3 rotate-180" /> Back
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {availableDates.map(date => {
                      const d = new Date(date);
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => {
                            setSelectedDate(date);
                            setActiveStep(3);
                          }}
                          className="flex flex-col items-center gap-1.5 p-6 rounded-[2rem] bg-slate-950/40 border border-slate-800 hover:border-primary-500/50 hover:bg-slate-800/40 transition-all text-center group/date shadow-lg"
                        >
                          <span className="text-[11px] font-black text-primary-500/60 uppercase tracking-[0.2em] group-hover/date:text-primary-400 transition-colors">
                            {d.toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US', { weekday: 'long' })}
                          </span>
                          <span className="text-2xl font-black text-white">
                            {d.toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US', { day: 'numeric', month: 'short' })}
                          </span>
                          <div className="mt-3 px-4 py-1 rounded-full bg-slate-900 border border-slate-800 text-[9px] font-black text-slate-500 group-hover/date:bg-primary-500/20 group-hover/date:text-primary-400 group-hover/date:border-primary-500/30 transition-all uppercase tracking-widest">
                            Available
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Time Selection */}
              {activeStep === 3 && (
                <motion.div 
                  key="step3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black uppercase tracking-[0.25em] text-primary-400/80">
                        Step 3: Pick your Slot
                      </label>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold bg-slate-950/50 px-3 py-1 rounded-lg border border-slate-800/50 w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {selectedTest} <span className="opacity-30">•</span> {new Date(selectedDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </div>
                    </div>
                    <button onClick={() => setActiveStep(2)} className="text-[10px] font-bold text-slate-500 hover:text-primary-400 transition-colors uppercase tracking-widest flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 rotate-180" /> Change Date
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                    {timeSlots.map(time => {
                      const slotKey = `${selectedTest} | ${selectedDate} | ${time}`;
                      const bookedCount = bookedCounts[slotKey] || 0;
                      const capacity = config.capacity || 1;
                      const isFull = bookedCount >= capacity;
                      const isSelected = selectedTime === time;

                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={isFull || loading}
                          onClick={() => {
                            setSelectedTime(time);
                            handleUpdate(selectedTest, selectedDate, time);
                            // handleUpdate triggers 'value' update in parent, which will hide this flow and show Ticket
                          }}
                          className={`relative group h-14 flex flex-col items-center justify-center rounded-[1.25rem] border-2 transition-all shadow-md ${
                            isSelected
                              ? 'bg-primary-500 border-primary-400 text-white shadow-[0_0_25px_rgba(59,130,246,0.4)] scale-105 z-10'
                              : isFull
                                ? 'bg-slate-950/20 border-slate-900 text-slate-800 cursor-not-allowed'
                                : 'bg-slate-950/60 border-slate-800/50 text-slate-300 hover:border-primary-500/50 hover:bg-slate-800/60'
                          }`}
                        >
                          <span className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-100'}`}>{time}</span>
                          
                          {!isSelected && !isFull && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${capacity - bookedCount > 2 ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]'}`} />
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{capacity - bookedCount}</span>
                            </div>
                          )}
                          
                          {isFull && !isSelected && (
                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest mt-1">FULL</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ENHANCED Confirmation Digital Ticket - HIGH CONTRAST VERSION */}
      <AnimatePresence>
        {value && selectedTest && selectedDate && selectedTime && (
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="mt-6 relative"
          >
            {/* The Ticket Container */}
            <div className="bg-slate-950 border-2 border-emerald-500/50 rounded-[2.5rem] p-8 relative overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),0_0_30px_rgba(16,185,129,0.15)]">
              {/* Vibrant Accent Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px] rounded-full" />
              
              <div className="flex flex-col lg:flex-row items-center gap-8 relative z-10">
                {/* Left Icon Section */}
                <div className="w-20 h-20 rounded-[2rem] bg-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                
                {/* Center Content Section */}
                <div className="flex-1 text-center lg:text-left space-y-3">
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-black uppercase tracking-[0.35em] shadow-lg">
                    <CheckCircle className="w-4 h-4" />
                    Booking Confirmed
                  </div>
                  
                  <h4 className="text-3xl font-black text-white tracking-tight leading-none drop-shadow-md">
                    {selectedTest}
                  </h4>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 text-slate-100">
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner">
                      <CalendarIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-base font-black tracking-tight">
                        {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-base font-black tracking-tight">
                        {selectedTime}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Info Section */}
                <div className="flex flex-col items-center lg:items-end gap-2 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl lg:min-w-[140px]">
                   <MapPin className="w-6 h-6 text-emerald-400 mb-1" />
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest text-center lg:text-right">Reference<br/>Securely Locked</span>
                </div>
              </div>

              {/* Decorative Perforation Lines */}
              <div className="absolute left-10 right-10 bottom-4 h-[2px] bg-[radial-gradient(circle,theme(colors.emerald.500/40)_1px,transparent_1px)] bg-[length:12px_12px]" />
            </div>

            {/* Floating Action Button - RESET FLOW ON CLICK */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => {
                // IMMEDIATELY reset all local and parent states to hide ticket and show Step 1
                handleUpdate('', '', ''); // Clear parent value -> hides ticket
                setSelectedTest('');
                setSelectedDate('');
                setSelectedTime('');
                setActiveStep(1); // Reset to Step 1
              }}
              className="absolute -top-3 right-8 px-6 py-3 bg-white text-slate-950 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] hover:bg-primary-500 hover:text-white transition-all z-20 flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Update Appointment
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && !config && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-50 rounded-[2.5rem]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin shadow-[0_0_20px_rgba(59,130,246,0.2)]" />
            <span className="text-[11px] font-black text-primary-400 uppercase tracking-[0.4em]">Initializing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
