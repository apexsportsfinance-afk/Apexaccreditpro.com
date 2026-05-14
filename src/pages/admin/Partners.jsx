import React, { useState, useEffect } from "react";
import { Users, Plus, Key, Trash2, Copy, CheckCircle, XCircle, Shield, Eye, Settings } from "lucide-react";
import { PartnersAPI } from "../../lib/storage";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

export default function Partners() {
  const { toast } = useToast();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  
  const [newPartner, setNewPartner] = useState({ name: "", description: "" });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [newKey, setNewKey] = useState({ label: "", allowedFields: ["firstName", "lastName", "role", "badgeNumber"] });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const data = await PartnersAPI.getPartners();
      setPartners(data || []);
    } catch (err) {
      toast.error("Failed to load partners");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async () => {
    if (!newPartner.name) return;
    try {
      await PartnersAPI.createPartner(newPartner);
      toast.success("Partner added");
      setShowAddModal(false);
      setNewPartner({ name: "", description: "" });
      fetchPartners();
    } catch (err) {
      toast.error("Failed to add partner");
    }
  };

  const handleDeletePartner = async (e, id) => {
    e.stopPropagation(); // Don't select the partner when clicking delete
    if (!confirm("Are you sure? This will permanently delete this partner and all their API keys. This cannot be undone.")) return;
    try {
      await PartnersAPI.deletePartner(id);
      toast.success("Partner deleted permanently");
      if (selectedPartner?.id === id) setSelectedPartner(null);
      fetchPartners();
    } catch (err) {
      toast.error("Failed to delete partner");
    }
  };

  const selectPartner = async (partner) => {

    setSelectedPartner(partner);
    setLoadingKeys(true);
    try {
      const data = await PartnersAPI.getKeys(partner.id);
      setKeys(data || []);
    } catch (err) {
      toast.error("Failed to load API keys");
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKey.label || !selectedPartner) return;
    setIsGeneratingKey(true);
    try {
      await PartnersAPI.generateKey(selectedPartner.id, newKey.label, ["read_basic"], newKey.allowedFields);
      toast.success("API Key generated successfully");
      setShowKeyModal(false);
      setNewKey({ label: "", allowedFields: ["firstName", "lastName", "role", "badgeNumber"] });
      await selectPartner(selectedPartner);
    } catch (err) {
      console.error("Key generation error:", err);
      toast.error("Failed to generate key: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm("Are you sure you want to revoke this key? It will stop working immediately.")) return;
    try {
      await PartnersAPI.revokeKey(id);
      toast.success("Key revoked");
      selectPartner(selectedPartner);
    } catch (err) {
      toast.error("Failed to revoke key");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const availableFields = [
    { id: "firstName", label: "First Name" },
    { id: "lastName", label: "Last Name" },
    { id: "role", label: "Role / Category" },
    { id: "badgeNumber", label: "Badge Number" },
    { id: "club", label: "Club / Organization" },
    { id: "nationality", label: "Nationality" },
    { id: "photoUrl", label: "Athlete Photo" },
    { id: "status", label: "Accreditation Status" }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-400" />
            API & Partner Management
          </h1>
          <p className="text-slate-400 text-lg">Manage third-party integrations and secure API access.</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} icon={Plus}>
          Add New Partner
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Partners List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Partners
          </h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl"></div>)}
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
              <p className="text-slate-400">No partners found.</p>
            </div>
          ) : (
            partners.map(partner => (
              <div 
                key={partner.id}
                onClick={() => selectPartner(partner)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedPartner?.id === partner.id 
                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/5" 
                    : "bg-slate-800 border-slate-700 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-white text-lg">{partner.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      partner.status === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"
                    }`}>
                      {partner.status}
                    </span>
                    <button 
                      onClick={(e) => handleDeletePartner(e, partner.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Delete Partner Permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-slate-400 text-sm line-clamp-2">{partner.description}</p>
              </div>
            ))
          )}
        </div>

        {/* API Keys Management */}
        <div className="lg:col-span-2">
          {selectedPartner ? (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    API Keys for {selectedPartner.name}
                  </h2>
                  <p className="text-slate-400">Manage security keys and data allocations for this partner.</p>
                </div>
                <Button variant="secondary" onClick={() => setShowKeyModal(true)} icon={Key}>
                  Generate Key
                </Button>
              </div>

              {loadingKeys ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse"></div>)}
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                  <Key className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">No API keys generated yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {keys.map(key => (
                    <div key={key.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${key.status === 'active' ? "bg-cyan-500/10" : "bg-red-500/10"}`}>
                            <Key className={`w-5 h-5 ${key.status === 'active' ? "text-cyan-400" : "text-red-400"}`} />
                          </div>
                          <div>
                            <h4 className="font-bold text-white">{key.label}</h4>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">
                              Created {new Date(key.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {key.status === 'active' ? (
                            <Button variant="danger" size="sm" onClick={() => handleRevokeKey(key.id)} icon={XCircle}>
                              Revoke
                            </Button>
                          ) : (
                            <span className="text-red-400 font-bold text-sm px-3 py-1 bg-red-400/10 rounded-lg">REVOKED</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 group relative mb-4">
                        <code className="text-cyan-400 font-mono text-sm break-all">
                          {key.status === 'active' ? key.api_key : "••••••••••••••••••••••••••••••••"}
                        </code>
                        {key.status === 'active' && (
                          <button 
                            onClick={() => copyToClipboard(key.api_key)}
                            className="ml-auto p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            title="Copy Key"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
                        <span className="text-xs text-slate-500 w-full mb-1">ALLOCATED FIELDS:</span>
                        {key.allowed_fields.map(field => (
                          <span key={field} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-800 text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-300 mb-2">Select a Partner</h3>
              <p className="text-slate-500 max-w-xs">Choose a partner from the left to manage their API integration.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Partner Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register New Partner">
        <div className="p-6 space-y-4">
          <Input 
            label="Partner Name" 
            placeholder="e.g. Acme Kiosk Solutions"
            value={newPartner.name}
            onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-400">Description / Notes</label>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              rows="3"
              placeholder="What is this integration for?"
              value={newPartner.description}
              onChange={(e) => setNewPartner({ ...newPartner, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddPartner} disabled={!newPartner.name}>Create Partner</Button>
          </div>
        </div>
      </Modal>

      {/* Generate Key Modal */}
      <Modal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} title="Generate API Key">
        <div className="p-6 space-y-6">
          <Input 
            label="Key Label" 
            placeholder="e.g. Dubai Main Entrance Kiosk"
            value={newKey.label}
            onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-3">Allocated Fields (What this key can see)</label>
            <div className="grid grid-cols-2 gap-3">
              {availableFields.map(field => (
                <label 
                  key={field.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    newKey.allowedFields.includes(field.id)
                      ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                  }`}
                >
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={newKey.allowedFields.includes(field.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewKey({ ...newKey, allowedFields: [...newKey.allowedFields, field.id] });
                      } else {
                        setNewKey({ ...newKey, allowedFields: newKey.allowedFields.filter(f => f !== field.id) });
                      }
                    }}
                  />
                  {newKey.allowedFields.includes(field.id) ? <CheckCircle className="w-5 h-5 text-cyan-400" /> : <div className="w-5 h-5 border-2 border-slate-700 rounded-full" />}
                  <span className="font-medium">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl">
            <p className="text-sm text-amber-400 flex gap-2">
              <Shield className="w-5 h-5 shrink-0" />
              <strong>Warning:</strong> The API key will be shown only once after generation. Make sure to copy it immediately.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowKeyModal(false)} disabled={isGeneratingKey}>Cancel</Button>
            <Button onClick={handleGenerateKey} loading={isGeneratingKey} disabled={!newKey.label}>Generate Key</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
