import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden bg-base border border-border"
        >
          <div className="px-6 py-4 flex items-center justify-between border-b border-border">
            <h3 className="text-xl font-bold text-main">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-base-alt text-muted hover:text-main"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function TermsModal({ isOpen, onClose, onAccept, content }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terms and Conditions"
    >
      <div className="p-8 space-y-6 text-main leading-relaxed">
        {content ? (
          <div className="whitespace-pre-wrap text-[17px] font-light text-muted bg-base-alt p-6 rounded-2xl border border-border italic">
            {content}
          </div>
        ) : (
          <>
            <section className="space-y-3 font-light">
              <h4 className="text-lg font-black text-main uppercase tracking-tight">1. Health & Safety</h4>
              <p className="text-lg text-muted">
                By registering for this event, you certify that you are in good health and physically capable of participating in competition activities. You acknowledge the inherent risks associated with sports participation.
              </p>
            </section>

            <section className="space-y-3 font-light">
              <h4 className="text-lg font-black text-main uppercase tracking-tight">2. Media Release</h4>
              <p className="text-lg text-muted">
                You permit the use of your name, likeness, and image in broadcasts, telecasts, and promotional materials (digital and print) related to the competition and Apex Sports events.
              </p>
            </section>

            <section className="space-y-3 font-light">
              <h4 className="text-lg font-black text-main uppercase tracking-tight">3. Liability Waiver</h4>
              <p className="text-lg text-muted">
                The organizers, sponsors, and venue operators are not liable for any personal injury, illness, or property loss/damage during the event. Participants must adhere to all safety protocols and use required equipment.
              </p>
            </section>

            <section className="space-y-3 font-light">
              <h4 className="text-lg font-black text-main uppercase tracking-tight">4. Conduct & Rules</h4>
              <p className="text-lg text-muted">
                You agree to follow all official rules, safety guidelines, and direct instructions provided by event officials and technical staff. Unsportsmanlike conduct may lead to immediate disqualification and removal from premises.
              </p>
            </section>

            <section className="space-y-3 font-light">
              <h4 className="text-lg font-black text-main uppercase tracking-tight">5. Data Privacy</h4>
              <p className="text-lg text-muted">
                Calculated age and identification data provided will be used solely for accreditation and eligibility verification purposes.
              </p>
            </section>
          </>
        )}

        <div className="pt-6 flex justify-end">
          <button
            onClick={() => {
              if (onAccept) onAccept();
              onClose();
            }}
            className="px-10 py-4 bg-gradient-to-r from-primary-500 to-blue-600 text-white text-lg font-black uppercase tracking-widest rounded-2xl shadow-2xl hover:shadow-primary-500/40 transition-all active:scale-95 flex items-center gap-2"
          >
            I Agree
          </button>
        </div>
      </div>
    </Modal>
  );
}
