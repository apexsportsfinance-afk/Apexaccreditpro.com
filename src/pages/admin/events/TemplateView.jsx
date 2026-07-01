import React, { useState, useEffect } from "react";
import { Upload, Trash2, X, Plus, ImageIcon, FileImage, Info } from "lucide-react";
import Card, { CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { useToast } from "../../../components/ui/Toast";
import { EventsAPI } from "../../../lib/storage";
import { GlobalSettingsAPI } from "../../../lib/broadcastApi";
import { uploadToStorage } from "../../../lib/uploadToStorage";
import StorageImage from "../../../components/ui/StorageImage";
import { cn } from "../../../lib/utils";

export default function TemplateView({ event, onClose, onSave }) {
  const [templateData, setTemplateData] = useState({
    headerArabic: event.headerArabic || "",
    headerSubtitle: event.headerSubtitle || "",
    logoUrl: event.logoUrl || "",
    backTemplateUrl: event.backTemplateUrl || "",
    sponsorLogos: event.sponsorLogos || [],
    frontBackgroundUrl: "",
    onlyFrontPage: false
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const isMembershipCard = event?.outputType === "Membership Card";

  const getGuidance = () => {
    if (isMembershipCard) {
      return {
        logo: {
          size: "Recommended width: 1800px. Recommended height: 250px – 350px. Max 2MB.",
          note: "Note: Keep the header clean and avoid very small text."
        },
        frontBg: {
          size: "Recommended size: 2025x1275px. Max 2MB.",
          note: "Note: This sits behind the member photo, QR code, name, ID, badge number, category, nationality, and DOB. Keep the centre and QR area clean."
        },
        backBg: {
          size: "Recommended size: 2025x1275px. Max 2MB.",
          note: "Note: This is for CR80 landscape membership card size. Keep important text/logos at least 100px away from the borders."
        },
        sponsors: {
          size: "Recommended strip size: 1800x250px. If individual logos: minimum width 600px."
        }
      };
    }
    
    return {
      logo: {
        size: "Recommended width: 1800px. Recommended height: 400px – 600px. Max 2MB.",
        note: "Note: Keep text and logos inside the centre safe zone."
      },
      frontBg: {
        size: "Recommended size: 2000x2837px. Max 2MB.",
        note: "Note: This sits behind the participant photo and data. Keep the centre area clean or use low-opacity background design."
      },
      backBg: {
        size: "Recommended size: 2000x2837px. Max 2MB.",
        note: "Note: Background colours should bleed to the edge, but important text/logos should stay at least 150px away from the borders."
      },
      sponsors: {
        size: "Recommended strip size: 1800x400px. If individual logos: minimum width 800px."
      }
    };
  };

  const guidance = getGuidance();

  // Minimum native pixel dimensions for crisp output in the flattened (html2canvas) PDF export.
  const getMinDimensions = (field) => {
    switch (field) {
      case "logoUrl":
        return isMembershipCard ? { width: 1800, height: 250 } : { width: 1800, height: 400 };
      case "frontBackgroundUrl":
      case "backTemplateUrl":
        return isMembershipCard ? { width: 2025, height: 1275 } : { width: 2000, height: 2837 };
      case "sponsorLogos":
        return isMembershipCard ? { width: 600, height: 0 } : { width: 800, height: 0 };
      default:
        return null;
    }
  };

  const getImageDimensions = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });

  const warnIfLowResolution = async (file, field) => {
    const min = getMinDimensions(field);
    if (!min) return;
    const dims = await getImageDimensions(file);
    if (dims && (dims.width < min.width || dims.height < min.height)) {
      toast.warning(
        `This image is ${dims.width}x${dims.height}px, below the recommended ${min.width}x${min.height}px. It may look pixelated when printed.`
      );
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [bg, onlyFront] = await Promise.all([
          GlobalSettingsAPI.get(`event_${event.id}_front_bg`),
          GlobalSettingsAPI.get(`event_${event.id}_only_front_page`)
        ]);
        setTemplateData(prev => ({ 
          ...prev, 
          frontBackgroundUrl: bg || "",
          onlyFrontPage: onlyFront === "true" || onlyFront === true
        }));
      } catch (err) {
        console.error("Failed to load settings");
      }
    };
    fetchSettings();
  }, [event.id]);

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await warnIfLowResolution(file, field);
    const toastId = toast.loading ? toast.loading("Uploading image...") : null;
    try {
      const fileExt = file.name.split('.').pop();
      const { url } = await uploadToStorage(file, "event_templates", `${event.id}_${field}_${Date.now()}.${fileExt}`);
      setTemplateData(prev => ({ ...prev, [field]: url }));
      if (toastId && toast.dismiss) toast.dismiss(toastId);
      toast.success("Image uploaded successfully");
    } catch (err) {
      console.error(err);
      if (toastId && toast.dismiss) toast.dismiss(toastId);
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      e.target.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { frontBackgroundUrl, onlyFrontPage, ...dbTemplateData } = templateData;
      await EventsAPI.update(event.id, dbTemplateData);
      await Promise.all([
        GlobalSettingsAPI.set(`event_${event.id}_front_bg`, frontBackgroundUrl || ""),
        GlobalSettingsAPI.set(`event_${event.id}_only_front_page`, onlyFrontPage)
      ]);
      toast.success("Template settings saved");
      if (onSave) onSave();
      onClose();
    } catch (err) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-main mb-2">Accreditation Template</h3>
            <p className="text-muted font-light">Customize visuals for physical and digital badges</p>
          </div>
          <Button onClick={save} loading={saving}>Save Configuration</Button>
        </div>

        <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 flex gap-3 text-sm text-main">
          <Info className="w-5 h-5 text-primary-400 shrink-0" />
          <p>
            <strong className="text-main block mb-1">General Print Quality Note:</strong>
            For best print quality, upload PNG files exported directly from the original design file. 
            Avoid screenshots, WhatsApp-compressed images, or low-resolution JPG files.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Front Configuration */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-main flex items-center gap-2">
              Front Layout
            </h4>

            <div className="space-y-4 bg-base p-6 rounded-2xl border border-white/5">
              <Input 
                label="Header (Arabic)"
                value={templateData.headerArabic}
                onChange={e => setTemplateData(prev => ({ ...prev, headerArabic: e.target.value }))}
                placeholder="e.g., دبي للألعاب المائية"
              />
              <Input 
                label="Subtitle / Location"
                value={templateData.headerSubtitle}
                onChange={e => setTemplateData(prev => ({ ...prev, headerSubtitle: e.target.value }))}
                placeholder="e.g., Hamdan Sports Complex"
              />
              <div>
                <label className="block text-sm font-bold text-muted uppercase tracking-widest mb-3">Event Logo</label>
                <div className="flex items-start gap-6">
                  {templateData.logoUrl ? (
                    <div className="relative group shrink-0">
                      <StorageImage src={templateData.logoUrl} className="w-24 h-24 object-contain rounded-xl bg-white/5 p-2" alt="Logo" />
                      <button 
                        onClick={() => setTemplateData(prev => ({ ...prev, logoUrl: "" }))}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 shrink-0 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-all text-muted">
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold">UPLOAD</span>
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "logoUrl")} className="hidden" />
                    </label>
                  )}
                  <div className="text-xs text-muted pt-2 space-y-1">
                    <p className="text-main font-medium">Transparent PNG or high-res SVG recommended.</p>
                    <p>{guidance.logo.size}</p>
                    <p className="text-primary-400">{guidance.logo.note}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-bold text-muted uppercase tracking-widest mb-3">Front Body Background</label>
                <div className="flex items-start gap-6">
                  {templateData.frontBackgroundUrl ? (
                    <div className="relative group shrink-0">
                      <StorageImage src={templateData.frontBackgroundUrl} className="w-24 h-24 object-cover rounded-xl bg-white/5 p-2" alt="Front Bg" />
                      <button 
                        onClick={() => setTemplateData(prev => ({ ...prev, frontBackgroundUrl: "" }))}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 shrink-0 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-all text-muted">
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold text-center">UPLOAD BG</span>
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "frontBackgroundUrl")} className="hidden" />
                    </label>
                  )}
                  <div className="text-xs text-muted pt-2 space-y-1">
                    <p>{guidance.frontBg.size}</p>
                    <p className="text-primary-400">{guidance.frontBg.note}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={templateData.onlyFrontPage}
                      onChange={e => setTemplateData(prev => ({ ...prev, onlyFrontPage: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-base-alt rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-main group-hover:text-primary-400 transition-colors">
                      Single-Sided Mode (Front Only)
                    </span>
                    <span className="text-[10px] text-muted uppercase tracking-widest leading-none mt-1">
                      Disable back page generation in PDF
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Back Configuration */}
          <div className="space-y-6">
            <h4 className="text-lg font-bold text-main flex items-center gap-2">
              Back Template &amp; Sponsors
            </h4>

            <div className="space-y-6 bg-base p-6 rounded-2xl border border-white/5">
              <div className={cn("transition-all duration-300", templateData.onlyFrontPage && "opacity-40 grayscale pointer-events-none")}>
                <label className="block text-sm font-bold text-muted uppercase tracking-widest mb-1">Back Graphic</label>
                <div className="text-xs text-muted mb-4 space-y-1">
                  <p>{guidance.backBg.size}</p>
                  <p className="text-primary-400">{guidance.backBg.note}</p>
                </div>
                <div className="relative aspect-[3/4] max-w-[200px] border-2 border-dashed border-border rounded-2xl overflow-hidden group">
                  {templateData.backTemplateUrl ? (
                    <>
                      <StorageImage src={templateData.backTemplateUrl} className="w-full h-full object-cover" alt="Back Template" />
                      <div className="absolute inset-0 bg-base/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button variant="ghost" icon={Trash2} onClick={() => setTemplateData(prev => ({ ...prev, backTemplateUrl: "" }))}>Clear</Button>
                      </div>
                    </>
                  ) : (
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                      <Upload className="w-8 h-8 text-muted mb-2" />
                      <span className="text-xs font-bold text-muted uppercase">Upload Back</span>
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "backTemplateUrl")} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <label className="block text-sm font-bold text-muted uppercase tracking-widest mb-1 mt-4">Sponsor Logos (Max 6)</label>
                <div className="text-xs text-muted mb-4 space-y-1">
                  <p className="text-main font-medium">Transparent PNG recommended.</p>
                  <p>{guidance.sponsors.size}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {templateData.sponsorLogos.map((logo, i) => (
                    <div key={i} className="relative group h-24 bg-white rounded-xl flex items-center justify-center p-3 border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                      <StorageImage src={logo} className="w-full h-full object-contain" alt="Sponsor" />
                      <button 
                         onClick={() => setTemplateData(prev => ({ ...prev, sponsorLogos: prev.sponsorLogos.filter((_, idx) => idx !== i) }))}
                         className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {templateData.sponsorLogos.length < 6 && (
                    <label className="h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-500/10 transition-all text-muted bg-base-alt">
                      <Plus className="w-6 h-6 mb-1 text-muted" />
                      <input type="file" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await warnIfLowResolution(file, "sponsorLogos");
                          const toastId = toast.loading ? toast.loading("Uploading sponsor logo...") : null;
                          try {
                            const fileExt = file.name.split('.').pop();
                            const { url } = await uploadToStorage(file, "event_templates", `${event.id}_sponsor_${Date.now()}.${fileExt}`);
                            setTemplateData(prev => ({ ...prev, sponsorLogos: [...prev.sponsorLogos, url] }));
                            if (toastId && toast.dismiss) toast.dismiss(toastId);
                            toast.success("Sponsor logo uploaded");
                          } catch (err) {
                            console.error(err);
                            if (toastId && toast.dismiss) toast.dismiss(toastId);
                            toast.error("Failed to upload sponsor logo");
                          } finally {
                            e.target.value = "";
                          }
                        }
                      }} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

