import React from "react";
import { cn } from "../../lib/utils";

export default function Skeleton({ className, variant = "rect", ...props }) {
  return (
    <div
      className={cn(
        "skeleton",
        variant === "circle" ? "rounded-full" : "rounded-xl",
        className
      )}
      {...props}
    />
  );
}

export const SkeletonText = ({ lines = 1, className }) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4 w-full",
            i === lines - 1 && lines > 1 && "w-2/3"
          )} 
        />
      ))}
    </div>
  );
};

export const CardSkeleton = () => {
  return (
    <div className="glass-panel rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
      <div className="pt-4 flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  );
};
