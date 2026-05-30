import React from "react";
import { cn } from "../../lib/utils";
import Button from "./Button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  actionIcon,
  className
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 text-center",
      className
    )}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-primary-400 opacity-60" />
        </div>
      )}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-lg text-slate-400 font-extralight max-w-sm mb-6">
          {description}
        </p>
      )}
      {action && actionLabel && (
        <Button onClick={action} icon={actionIcon}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
