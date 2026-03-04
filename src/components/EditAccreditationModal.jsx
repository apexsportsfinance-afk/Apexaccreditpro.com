import React, { useState, useEffect } from "react";
import { Upload, X, Check, User, Camera, AlertTriangle, Info } from "lucide-react";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";
import SearchableSelect from "./ui/SearchableSelect";
import Modal from "./ui/Modal";
import { COUNTRIES, ROLES, validateFile, fileToBase64, ROLE_BADGE_PREFIXES, getBadgePrefix } from "../lib/utils";

export default function EditAccreditationModal({
  isOpen,
  onClose,
  accreditation,
  zones = [],
  eventCategories = [],
  onSave,
  saving = false,
  currentEvent = null
}) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    nationality: "",
    club: "",
    role: "",
    email: "",
    photoUrl: null,
    zoneCodes: []
  });
  const [errors, setErrors] = useState({});
  const [originalRole, setOriginalRole] = useState("");

  useEffect(() => {
    if (accreditation) {
      const zc = accreditation.zoneCode
        ? accreditation.zoneCode.split(",").map(z => z.trim()).filter(Boolean)
        : [];
      setFormData({
        firstName: accreditation.firstName || "",
        lastName: accreditation.lastName || "",
        gender: accreditation.gender || "",
        dateOfBirth: accreditation.dateOfBirth || "",
        nationality: accreditation.nationality || "",
        club: accreditation.club || "",
        role: accreditation.role || "",
        email: accreditation.email || "",
        photoUrl: accreditation.photoUrl || null,
        zoneCodes: zc
      });
      setOriginalRole(accreditation.role || "");
      setErrors({});
    }
  }, [accreditation]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, photoUrl: validation.error }));
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setFormData(prev => ({ ...prev, photoUrl: base64 }));
      setErrors(prev => ({ ...prev, photoUrl: null }));
    } catch {
      setErrors(prev => ({ ...prev, photoUrl: "Failed to process image" }));
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photoUrl: null }));
  };

  const toggleZone = (zoneCode) => {
    setFormData(prev => {
      const current = prev.zoneCodes;
      if (current.includes(zoneCode)) {
        return { ...prev, zoneCodes: current.filter(z => z !== zoneCode) };
      } else {
        return { ...prev, zoneCodes: [...current, zoneCode] };
      }
    });
  };

  const selectAllZones = () => {
    setFormData(prev => ({ ...prev, zoneCodes: zones.map(z => z.code) }));
  };

  const clearAllZones = () => {
    setFormData(prev => ({ ...prev, zoneCodes: [] }));
  };

  const getRoleOptions = () => {
    if (eventCategories && eventCategories.length > 0) {
      return eventCategories.map(cat => {
        const categoryData = cat.category || cat;
        const name = categoryData?.name || cat?.name;
        if (name) return { value: name, label: name };
        return null;
      }).filter(Boolean);
    }
    return ROLES.map(r => ({ value: r, label: r }));
  };

  const getAge = () => {
    if (!formData.dateOfBirth || !currentEvent?.ageCalculationYear) return null;
    const dob = new Date(formData.dateOfBirth);
    const calcDate = new Date(currentEvent.ageCalculationYear, 11, 31);
    const age = Math.floor((calcDate - dob) / (365.25 * 24 * 60 * 60 * 1000));
    return age;
  };

  const getPreviewBadgePrefix = (role) => {
    if (eventCategories && eventCategories.length > 0) {
      const catData = eventCategories.find(cat => {
        const cd = cat.category || cat;
        return (cd?.name || cat?.name) === role;
      });
      if (catData) {
        const cd = catData.category || catData;
        return getBadgePrefix(role, cd?.badgePrefix || null);
      }
    }
    return getBadgePrefix(role);
  };

  const isAthlete = formData.role?.toLowerCase() === "athlete";
  const age = getAge();
  const isApproved = accreditation?.status === "approved";
  const roleChanged = isApproved && formData.role && formData.role !== originalRole;
  const newBadgePrefix = roleChanged ? getPreviewBadgePrefix(formData.role) : null;

  const handleSubmit = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSave({
      ...formData,
      zoneCode: formData.zoneCodes.join(","),
      roleChanged,
      originalRole
    });
  };

  if (!accreditation) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Accreditation" size="lg">
      <div id="edit-accreditation-modal" className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        <div className="text-lg text-slate-400 font-extralight">
          Editing accreditation for{" "}
          <span className="text-cyan-400 font-medium">
            {accreditation?.firstName || ""} {accreditation?.lastName || ""}
          </span>
          {isApproved && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-lg rounded border border-emerald-500/30">
              Approved
            </span>
          )}
        </div>

        {/* Badge number info for approved accreditations */}
        {isApproved && accreditation?.badgeNumber && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
            <Info className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div>
              <p className="text-lg text-slate-300 font-extralight">
                Current Badge: <span className="font-mono text-cyan-300 font-medium">{accreditation.badgeNumber}</span>
                {accreditation.accreditationId && (
                  <span className="ml-3 text-slate-500">ID: {accreditation.accreditationId}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Role change warning for approved accreditations */}
        {roleChanged && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-lg text-amber-300 font-medium">Badge Number Will Be Updated</p>
              <p className="text-lg text-amber-400 font-extralight mt-1">
                Changing role from <span className="font-medium">{originalRole}</span> to{" "}
                <span className="font-medium">{formData.role}</span> will assign a new badge number
                with prefix <span className="font-mono font-medium">{newBadgePrefix}-XXX</span>.
              </p>
            </div>
          </div>
        )}

        {/* Photo + Personal Info Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Personal Information</h3>
          <div className="flex items-start gap-4">
            <div className="relative">
              {formData.photoUrl ? (
                <div className="w-32 h-40 rounded-lg overflow-hidden border-2 border-primary-500/30 relative group">
                  <img
                    src={formData.photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-lg rounded-lg flex items-center gap-1.5 transition-colors">
                      <Camera className="w-4 h-4" />
                      Change
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-lg rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-40 rounded-lg bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
                  <User className="w-10 h-10 text-white/70" />
                </div>
              )}
            </div>
            <div className="flex-1">
              {formData.photoUrl ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Photo Uploaded</span>
                  </div>
                  <p className="text-lg text-slate-400 font-extralight">
                    Hover over the image to change or remove it
                  </p>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-lg text-slate-400">Upload Photo</span>
                  <span className="text-lg text-slate-500 mt-1">JPEG, PNG - Max 5MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
              {errors.photoUrl && (
                <p className="text-lg text-red-400 mt-2">{errors.photoUrl}</p>
              )}
            </div>
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            error={errors.firstName}
            required
          />
          <Input
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            error={errors.lastName}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" }
            ]}
          />
          <Input
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
          />
        </div>

        {/* Show age for Athletes */}
        {isAthlete && age !== null && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
            <p className="text-lg text-cyan-400 font-extralight">
              <span className="font-medium">Age:</span> {age} years
              {currentEvent?.ageCalculationYear && (
                <span className="text-slate-500 ml-2">(calculated as of Dec 31, {currentEvent.ageCalculationYear})</span>
              )}
            </p>
          </div>
        )}

        {/* Affiliation Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Affiliation</h3>
          <Input
            label="Organization / Club / Academy"
            name="club"
            value={formData.club}
            onChange={handleInputChange}
            placeholder="Enter club or organization name"
          />
          <div className="relative z-[100]">
            <SearchableSelect
              label="Nationality"
              value={formData.nationality}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, nationality: e.target.value }));
                if (errors.nationality) setErrors(prev => ({ ...prev, nationality: null }));
              }}
              options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))}
              placeholder="Select nationality"
            />
          </div>
        </div>

        {/* Role / Category Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Role / Category</h3>
          <Select
            label="Role *"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            options={getRoleOptions()}
            placeholder="Select a category"
            required
          />
          {eventCategories && eventCategories.length > 0 ? (
            <p className="text-lg text-emerald-400 font-extralight">
              {getRoleOptions().length} categories available from event settings
            </p>
          ) : (
            <p className="text-lg text-amber-400 font-extralight">
              Using default categories (no custom categories defined for this event)
            </p>
          )}
        </div>

        {/* Zone Access Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Zone Access</h3>
          {zones && zones.length > 0 ? (
            <>
              <div className="flex items-center justify-end">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllZones}
                    className="text-lg text-cyan-400 hover:text-cyan-300"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={clearAllZones}
                    className="text-lg text-slate-400 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {zones.map(zone => {
                  const isSelected = formData.zoneCodes.includes(zone.code);
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => toggleZone(zone.code)}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                        isSelected
                          ? "border-primary-500 bg-primary-500/20"
                          : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                          style={{ backgroundColor: zone.color || "#2563eb" }}
                        >
                          {zone.code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-lg font-medium truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
                            {zone.name}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-lg text-slate-500 font-extralight">
                {formData.zoneCodes.length} zone(s) selected
              </p>
            </>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-lg text-amber-400 font-extralight">
                No zones defined for this event. Please add zones in the Zones settings first.
              </p>
            </div>
          )}
        </div>

        {/* Contact Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Contact</h3>
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            error={errors.email}
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            loading={saving}
          >
            {saving ? "Saving..." : roleChanged ? "Save & Update Badge" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
