import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  className,
  light = false
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-6xl"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute inset-0 backdrop-blur-sm",
              light ? "bg-black/30" : "bg-black/60"
            )}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative w-full rounded-2xl shadow-2xl overflow-hidden",
              light
                ? "bg-white border border-slate-200"
                : "bg-gradient-to-br from-swim-deep via-primary-950 to-ocean-950 border border-primary-500/30 shadow-primary-900/50",
              sizes[size],
              className
            )}
          >
            {title && (
              <div className={cn(
                "flex items-center justify-between px-6 py-4 border-b",
                light
                  ? "border-slate-200 bg-slate-50"
                  : "border-primary-500/20 bg-gradient-to-r from-primary-900/30 to-transparent"
              )}>
                <h2 className={cn(
                  "text-xl font-semibold",
                  light ? "text-slate-900" : "text-white"
                )}>{title}</h2>
                <button
                  onClick={onClose}
                  className={cn(
                    "p-2 rounded-lg transition-colors border border-transparent",
                    light
                      ? "hover:bg-slate-100 hover:border-slate-200"
                      : "hover:bg-primary-500/20 hover:border-primary-500/30"
                  )}
                >
                  <X className={cn("w-5 h-5", light ? "text-slate-500" : "text-slate-400")} />
                </button>
              </div>
            )}
            <div className="max-h-[80vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { Modal };
