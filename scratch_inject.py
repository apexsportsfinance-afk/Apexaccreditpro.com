import re

with open('src/pages/admin/Zones.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert MessageSettingsPanel
panel_code = '''
const MessageSettingsPanel = ({ formData, setFormData }) => {
  const [uploading, setUploading] = React.useState(null);
  
  const handleMessageChange = (key, field, value) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        messages: {
          ...(prev.settings?.messages || {}),
          [key]: {
            ...(prev.settings?.messages?.[key] || {}),
            [field]: value
          }
        }
      }
    }));
  };

  const handleFileUpload = async (key, file) => {
    if (!file) return;
    setUploading(key);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = zone-audio- + Date.now() + . + fileExt;
      const filePath = udio/ + fileName;
      
      const { error: uploadError } = await supabase.storage
        .from('accreditation-files')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
        
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('accreditation-files')
        .getPublicUrl(filePath);
        
      handleMessageChange(key, 'audioUrl', urlData.publicUrl);
    } catch (error) {
      console.error("Audio upload failed:", error);
      alert("Failed to upload audio file.");
    } finally {
      setUploading(null);
    }
  };

  const previewAudio = (msg) => {
    if (msg.audioUrl) {
      audioService.playAudioUrl(msg.audioUrl);
    } else {
      const text = msg.voice ? msg.voice.replace(/\[FullName\]/g, "Test Participant") : "";
      if (text) {
        audioService.speak(text, formData.settings?.voiceSettings || {});
      }
    }
  };

  const scenarios = [
    { key: "firstScan", label: "First Scan (Granted)" },
    { key: "secondScan", label: "Second Scan (Already Attended)" },
    { key: "accessDenied", label: "Access Denied (Flagged)" },
    { key: "invalidQr", label: "Invalid QR Format" },
    { key: "wrongZone", label: "Wrong Zone Access" },
    { key: "expired", label: "Expired Accreditation" }
  ];

  return (
    <div className="pt-4 border-t border-slate-700/50 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-lg font-bold text-white uppercase tracking-tight">
          Advanced Messaging & Audio
        </label>
        <button
          type="button"
          onClick={() => setFormData(p => ({ ...p, settings: { ...p.settings, voiceEnabled: !(p.settings?.voiceEnabled ?? true) } }))}
          className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            (formData.settings?.voiceEnabled !== false) ? "bg-primary-500" : "bg-slate-700"
          )}
        >
          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            (formData.settings?.voiceEnabled !== false) ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>
      
      {(formData.settings?.voiceEnabled !== false) && (
        <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">TTS Voice Language</label>
            <select
              value={formData.settings?.voiceSettings?.language || "en-US"}
              onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, voiceSettings: { ...(p.settings?.voiceSettings || {}), language: e.target.value } } }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="fr-FR">French</option>
              <option value="es-ES">Spanish</option>
              <option value="ar-SA">Arabic</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">TTS Volume</label>
            <input
              type="range"
              min="0" max="1" step="0.1"
              value={formData.settings?.voiceSettings?.volume ?? 1.0}
              onChange={e => setFormData(p => ({ ...p, settings: { ...p.settings, voiceSettings: { ...(p.settings?.voiceSettings || {}), volume: parseFloat(e.target.value) } } }))}
              className="w-full mt-2"
            />
          </div>
        </div>
      )}

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {scenarios.map(({ key, label }) => {
          const msg = formData.settings?.messages?.[key] || { text: "", voice: "", audioUrl: null };
          return (
            <div key={key} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-primary-400">{label}</h4>
                <button type="button" onClick={() => previewAudio(msg)} className="text-slate-400 hover:text-white p-1">
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Display Text</label>
                  <input
                    type="text"
                    value={msg.text || ""}
                    onChange={e => handleMessageChange(key, "text", e.target.value)}
                    className="w-full bg-slate-800 border-none rounded text-white text-sm p-2 outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">TTS Voice (use [FullName])</label>
                  <input
                    type="text"
                    value={msg.voice || ""}
                    onChange={e => handleMessageChange(key, "voice", e.target.value)}
                    className="w-full bg-slate-800 border-none rounded text-white text-sm p-2 outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Custom Audio File (Overrides TTS)</label>
                {msg.audioUrl ? (
                  <div className="flex items-center justify-between bg-slate-800 p-2 rounded">
                    <span className="text-xs text-emerald-400 truncate max-w-[200px]">{msg.audioUrl.split('/').pop()}</span>
                    <button type="button" onClick={() => handleMessageChange(key, "audioUrl", null)} className="text-red-400 hover:text-red-300">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="audio/*"
                      id={udio-upload- + key}
                      className="hidden"
                      onChange={(e) => handleFileUpload(key, e.target.files[0])}
                    />
                    <label
                      htmlFor={udio-upload- + key}
                      className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded cursor-pointer transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      {uploading === key ? "Uploading..." : "Upload .mp3"}
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
'''

content = content.replace("export default function Zones() {", panel_code + "\nexport default function Zones() {")

# Replace Success Voice Message input
old_input = '''<Input
            label="Success Voice Message"
            value={formData.settings?.successMessage || ""}
            onChange={(e) => setFormData((prev) => ({ 
              ...prev, 
              settings: { ...prev.settings, successMessage: e.target.value } 
            }))}
            placeholder="e.g. Thank you for visiting A1"
          />'''

content = content.replace(old_input, "<MessageSettingsPanel formData={formData} setFormData={setFormData} />")

with open('src/pages/admin/Zones.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
