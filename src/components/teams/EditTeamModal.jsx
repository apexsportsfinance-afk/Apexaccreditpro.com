import React, { useState, useEffect } from "react";
import { Building2, MapPin, Phone, Mail, User, Upload, Loader2, ImageOff, ChevronDown } from "lucide-react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";
import { uploadToStorage } from "../../lib/uploadToStorage";
import StorageImage from "../ui/StorageImage";
import { COUNTRIES, UAE_EMIRATES, getDialCode, validatePhoneForCountry } from "../../lib/utils";

export default function EditTeamModal({ isOpen, onClose, onSubmit, team }) {
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    country: "",
    city: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    logo_url: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        short_name: team.short_name || "",
        country: team.country || "",
        city: team.city || "",
        contact_name: team.contact_name || "",
        contact_email: team.contact_email || "",
        contact_phone: team.contact_phone || "",
        logo_url: team.logo_url || ""
      });
    }
  }, [team]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadToStorage(file, "team-logos");
      setFormData(prev => ({ ...prev, logo_url: url }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload logo. Please try again.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;

    const phoneError = validatePhoneForCountry(formData.contact_phone, formData.country);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Team"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Team / University Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. American University of Sharjah"
            icon={Building2}
            required
          />
          <Input
            label="Short Name"
            value={formData.short_name}
            onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
            placeholder="e.g. AUS"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-main">Country</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-primary-500" />
              <select
                value={formData.country}
                onChange={(e) => {
                  const newCountry = e.target.value;
                  setFormData(prev => {
                    const dial = getDialCode(newCountry);
                    const phone = !prev.contact_phone && dial ? `${dial} ` : prev.contact_phone;
                    return { ...prev, country: newCountry, city: "", contact_phone: phone };
                  });
                }}
                className="w-full py-2.5 rounded-lg border text-lg bg-base border-border text-main outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all appearance-none country-select"
              >
                <option value="">Select a country</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-muted" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-main">City / Emirate</label>
            {formData.country === "United Arab Emirates" ? (
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-primary-500" />
                <select
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full py-2.5 rounded-lg border text-lg bg-base border-border text-main outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all appearance-none country-select"
                >
                  <option value="">Select an emirate</option>
                  {UAE_EMIRATES.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-muted" />
              </div>
            ) : (
              <Input
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="e.g. Sharjah"
                icon={MapPin}
              />
            )}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-main mb-4">Contact Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Contact Name"
              value={formData.contact_name}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
              placeholder="e.g. John Doe"
              icon={User}
            />
            <Input
              label="Contact Phone"
              value={formData.contact_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
              placeholder={getDialCode(formData.country) ? `${getDialCode(formData.country)} 50 000 0000` : "e.g. +971 50 000 0000"}
              icon={Phone}
            />
            <div className="md:col-span-2">
              <Input
                label="Contact Email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                placeholder="e.g. john@example.com"
                icon={Mail}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-main">Team Logo (Optional)</label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border border-border bg-base-alt flex items-center justify-center overflow-hidden shrink-0">
                {formData.logo_url ? (
                  <StorageImage src={formData.logo_url} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-5 h-5 text-muted" />
                )}
              </div>
              <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main text-sm font-medium hover:border-primary-500 transition-all">
                {uploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> {formData.logo_url ? "Change Photo" : "Upload Photo"}
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </label>
            </div>
            <input
              type="text"
              value={formData.logo_url}
              onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
              placeholder="or paste an image URL"
              className="w-full bg-base-alt border border-border rounded-xl px-4 py-2 text-xs text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
