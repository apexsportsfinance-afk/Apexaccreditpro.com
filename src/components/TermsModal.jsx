import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-modal-title"
          className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden bg-base border border-border"
        >
          <div className="px-6 py-4 flex items-center justify-between border-b border-border">
            <h3 id="terms-modal-title" className="text-xl font-bold text-main">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
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
  const renderCustomContent = (text) => {
    if (!text) return null;
    
    const blocks = text.split(/\n\s*\n/);
    
    return blocks.map((block, idx) => {
      const lines = block.trim().split('\n');
      
      // If the block has multiple lines and the first line is short enough, treat it as a header
      if (lines.length > 1 && lines[0].length < 150) {
        const header = lines[0];
        const body = lines.slice(1).join('\n');
        return (
          <section key={idx} className="space-y-3 font-light mb-6">
            <h4 className="text-lg font-black text-main uppercase tracking-tight">{header}</h4>
            <p className="text-lg text-muted whitespace-pre-wrap">{body}</p>
          </section>
        );
      }
      
      // Otherwise, render as a plain paragraph
      return (
        <section key={idx} className="space-y-3 font-light mb-6">
          <p className="text-lg text-muted whitespace-pre-wrap">{block}</p>
        </section>
      );
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terms and Conditions"
    >
      <div className="p-8 text-main leading-relaxed">
        {content ? (
          <div className="space-y-6">
            {renderCustomContent(content)}
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
                The organizers and venue operators are not liable for any personal injury, illness, and property loss/damage during the event. Participants must adhere to all safety protocols and use required equipment.
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
                The personal information, photo, and identification data you provide are used solely for accreditation processing, eligibility verification, and event access control.
              </p>
              <p className="text-lg text-muted">
                <strong className="text-main">Face matching:</strong> if a facial comparison step is offered during registration, the comparison runs entirely in your browser. Your photo and any reference image are processed locally to verify a match and are not uploaded for this purpose, retained, or stored on our servers.
              </p>
              <p className="text-lg text-muted">
                <strong className="text-main">Third-party processors:</strong> your accreditation data is stored and managed using Supabase (database, authentication, and file storage). If you make a payment, card details are handled directly by Stripe and are never seen or stored by us. Some pages load fonts and supporting libraries from third-party content delivery networks (e.g. Google Fonts, jsDelivr).
              </p>
              <p className="text-lg text-muted">
                <strong className="text-main">Retention:</strong> accreditation records are retained for the duration of the event and for a reasonable period afterward for reporting, auditing, and legal/compliance purposes, after which they may be archived or deleted.
              </p>
              <p className="text-lg text-muted">
                <strong className="text-main">Your rights:</strong> to request access to, correction of, or deletion of your personal data, contact the event organizer at <a href="mailto:privacy@apexsports.ae" className="text-primary-500 underline">privacy@apexsports.ae</a>.
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
