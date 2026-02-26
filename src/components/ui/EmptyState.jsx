import React from "react";
import { motion } from "motion/react";
import Button from "./Button";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  actionIcon
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-400" />
        </div>
      )}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-lg text-slate-400 max-w-md mb-6">{description}</p>
      )}
      {action && (
        <Button onClick={action} icon={actionIcon}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

export { EmptyState };
