import React, { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/Toast";
import { EventsAPI } from "../../../lib/storage";

export default function TermsView({ event, onSave }) {
  const [content, setContent] = useState(event.termsAndConditions || "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await EventsAPI.update(event.id, { termsAndConditions: content });
      toast.success("Terms and Conditions updated successfully");
      if (onSave) onSave();
    } catch (err) {
      console.error("Failed to save terms:", err);
      toast.error("Failed to save terms: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="text-xl font-bold text-white">Custom Terms &amp; Conditions</h3>
            <p className="text-sm text-slate-400 mt-1">
              These terms will be displayed to all participants during the registration process.
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            loading={saving}
            icon={CheckCircle2}
          >
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80 leading-relaxed font-light">
              <span className="font-bold text-amber-400">Note:</span> If left empty, the system will use the default Apex Sports terms. You can use standard text. New lines will be preserved.
            </p>
          </div>
          
          <div className="relative group">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your custom terms and conditions here..."
              className="w-full h-[500px] bg-base-alt/50 border border-border rounded-xl p-6 text-main text-lg font-light leading-relaxed focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all resize-none"
            />
            <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest text-slate-500 group-focus-within:text-primary-400 transition-colors pointer-events-none">
              Rich Text Editor
            </div>
          </div>
          
          <div className="flex justify-end">
            <p className="text-xs text-slate-500 italic">
              * Remember to include health waivers and media release authorizations if specific to this event.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
