import React from "react";
import { useBackground } from "../../contexts/BackgroundContext";
import { Loader2, CheckCircle, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

export default function BackgroundProgress() {
  const { queue, currentTask, processing } = useBackground();

  if (!processing && queue.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-8 right-8 z-[100] w-80 bg-slate-900 border rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-300",
      processing ? "border-amber-500/50 shadow-amber-500/20" : "border-slate-700 shadow-black"
    )}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={cn(
          "text-xs font-black uppercase tracking-widest",
          processing ? "text-amber-400" : "text-slate-400"
        )}>Processing Queue</h4>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-black",
          processing ? "bg-amber-500/10 text-amber-500" : "bg-primary-500/10 text-primary-400"
        )}>{queue.length + (processing ? 1 : 0)} TASKS</span>
      </div>

      <div className="space-y-3">
        {currentTask && (
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-2.5 border border-white/5">
            <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
            <div className="flex-1 min-w-0">
              {currentTask.type === "bulk_download" ? (
                <>
                  <p className="text-xs font-bold text-white truncate">
                    Bulk Exporting {currentTask.accreditations?.length || ""} Cards
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                    Generating Zip Archive...
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-white truncate">
                    {currentTask.accreditation?.firstName} {currentTask.accreditation?.lastName}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                    Generating PDF & Sending Email...
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {queue.slice(0, 2).map((task, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-2 opacity-50 grayscale scale-95 origin-top">
            <Clock className="w-4 h-4 text-slate-600" />
            <div className="flex-1 min-w-0">
              {task.type === "bulk_download" ? (
                <p className="text-xs font-bold text-slate-400 truncate">
                  Bulk Export ({task.accreditations?.length || ""} items)
                </p>
              ) : (
                <p className="text-xs font-bold text-slate-400 truncate">
                  {task.accreditation?.firstName} {task.accreditation?.lastName}
                </p>
              )}
            </div>
          </div>
        ))}
        
        {queue.length > 2 && (
          <p className="text-[10px] text-center text-slate-600 font-black uppercase tracking-widest pt-1">
            + {queue.length - 2} more in queue
          </p>
        )}
      </div>
    </div>
  );
}
