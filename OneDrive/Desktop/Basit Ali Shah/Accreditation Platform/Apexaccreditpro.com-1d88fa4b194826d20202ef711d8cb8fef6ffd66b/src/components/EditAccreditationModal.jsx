import React, { useState, useEffect, useMemo } from "react";
import { Upload, X, Check, User, Camera, AlertTriangle, Info, Plus, Clock, CalendarX, Calendar } from "lucide-react";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Select from "./ui/Select";
import SearchableSelect from "./ui/SearchableSelect";
import Modal from "./ui/Modal";
import { COUNTRIES, ROLES, validateFile, fileToBase64, ROLE_BADGE_PREFIXES, getBadgePrefix } from "../lib/utils";
import { uploadToStorage } from "../lib/uploadToStorage";

function ZoneAccessSelector({ zones, selectedRole, selectedCodes, onToggle, onSelectAll, onClearAll }) {
  const roleZones = useMemo(() => {
    if (!selectedRole || zones.length === 0) return zones;
    const filtered = zones.filter(z => {
      const ar = z.allowedRoles || [];
      return ar.length === 0 || ar.includes(selectedRole);
    });
    return filtered.length > 0 ? filtered : zones;
  }, [zones, selectedRole]);

  const hasRoleFilter = selectedRole && roleZones.length < zones.length;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {hasRoleFilter && (
          <p className="text-lg text-cyan-400 font-extralight">
            Showing {roleZones.length} zone(s) linked to role <span className="font-medium">{selectedRole}</span>
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={() => onSelectAll(roleZones)} className="text-lg text-cyan-400 hover:text-cyan-300">
            Select Shown
          </button>
          <span className="text-slate-600">|</span>
          <button type="button" onClick={onClearAll} className="text-lg text-slate-400 hover:text-slate-300">
            Clear
          </button>
          {hasRoleFilter && (
            <>
              <span className="text-slate-600">|</span>
              <button type="button" onClick={() => onSelectAll(zones)} className="text-lg text-slate-500 hover:text-slate-300">
                All zones
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {roleZones.map(zone => {
          const isSelected = selectedCodes.includes(zone.code);
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onToggle(zone.code)}
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
                {isSelected && <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-lg text-slate-500 font-extralight">
        {selectedCodes.length} zone(s) selected
      </p>
    </>
  );
}

export default function EditAccreditationModal({
  isOpen,
  onClose,
  accreditation,
  zones = [],
  eventCategories = [],
  onSave,
  saving = false,
  currentEvent = null,
  clubs = []
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
  const [expiryMode, setExpiryMode] = useState("none");
  const [customExpiryDate, setCustomExpiryDate] = useState("");
  const [errors, setErrors] = useState({});
  const [originalRole, setOriginalRole] = useState("");
  const [customRoleMode, setCustomRoleMode] = useState(false);

  useEffect(() => {
    if (accreditation) {
      const zc = accreditation.zoneCode
        ? accreditation.zoneCode.split(",").map(z => z.trim()).filter(Boolean)
        : [];
      const role = accreditation.role || "";
      setFormData({
        firstName: accreditation.firstName || "",
        lastName: accreditation.lastName || "",
        gender: accreditation.gender || "",
        dateOfBirth: accreditation.dateOfBirth || "",
        nationality: accreditation.nationality || "",
        club: accreditation.club || "",
        role: role,
        email: accreditation.email || "",
        photoUrl: accreditation.photoUrl || null,
        zoneCodes: zc
      });
      setOriginalRole(role);
      setErrors({});
      if (accreditation.expiresAt) {
        setExpiryMode("custom");
        setCustomExpiryDate(new Date(accreditation.expiresAt).toISOString().split("T")[0]);
      } else {
        setExpiryMode("none");
        setCustomExpiryDate("");
      }
      const roleOpts = getRoleOptionsInternal(eventCategories);
      const isKnownRole = roleOpts.some(o => o.value === role);
      setCustomRoleMode(role !== "" && !isKnownRole);
    }
  }, [accreditation, eventCategories]);

  const getRoleOptionsInternal = (cats) => {
    if (cats && cats.length > 0) {
      return cats.map(cat => {
        const categoryData = cat.category || cat;
        const name = categoryData?.name || cat?.name;
        if (name) return { value: name, label: name };
        return null;
      }).filter(Boolean);
    }
    return ROLES.map(r => ({ value: r, label: r }));
  };

  const getRoleOptions = () => getRoleOptionsInternal(eventCategories);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleRoleChange = (e) => {
    const value = e.target.value;
    if (value === "__custom__") {
      setCustomRoleMode(true);
      setFormData(prev => ({ ...prev, role: "" }));
    } else {
      setCustomRoleMode(false);
      setFormData(prev => ({ ...prev, role: value }));
    }
    if (errors.role) {
      setErrors(prev => ({ ...prev, role: null }));
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
      const data = await uploadToStorage(file, "edits");

      setFormData(prev => ({ ...prev, photoUrl: data.url }));
      setErrors(prev => ({ ...prev, photoUrl: null }));
    } catch (err) {
      setErrors(prev => ({ ...prev, photoUrl: "Failed to upload image: " + (err.message || "") }));
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

  const selectAllZones = (zoneList) => {
    const list = Array.isArray(zoneList) ? zoneList : zones;
    setFormData(prev => ({ ...prev, zoneCodes: list.map(z => z.code) }));
  };

  const clearAllZones = () => {
    setFormData(prev => ({ ...prev, zoneCodes: [] }));
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
    if (expiryMode === "custom" && !customExpiryDate) {
      newErrors.expiryDate = "Please select a date or choose No expiration";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    let expiresAt = null;
    if (expiryMode === "event" && currentEvent?.endDate) {
      expiresAt = new Date(currentEvent.endDate + "T23:59:00").toISOString();
    } else if (expiryMode === "custom" && customExpiryDate) {
      expiresAt = new Date(customExpiryDate + "T23:59:00").toISOString();
    }
    onSave({
      ...formData,
      zoneCode: formData.zoneCodes.join(","),
      roleChanged,
      originalRole,
      expiresAt
    });
  };

  if (!accreditation) return null;

  const roleOptions = getRoleOptions();
  const isKnownRole = roleOptions.some(o => o.value === formData.role);
  const selectValue = customRoleMode || (!isKnownRole && formData.role !== "") ? "__custom__" : formData.role;

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

        {/* Photo Section */}
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
          {clubs && clubs.length > 0 ? (
            <div className="relative z-[110]">
              <SearchableSelect
                label="Organization / Club / Academy"
                value={formData.club}
                onChange={(e) => setFormData(prev => ({ ...prev, club: e.target.value }))}
                options={clubs.map(c => {
                  const name = typeof c === 'string' ? c : (c?.full || c?.short);
                  return name ? { value: name, label: name } : null;
                }).filter(Boolean)}
                placeholder="Search and select club..."
              />
            </div>
          ) : (
            <Input
              label="Organization / Club / Academy"
              name="club"
              value={formData.club}
              onChange={handleInputChange}
              placeholder="Enter club or organization name"
            />
          )}
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
            value={selectValue}
            onChange={handleRoleChange}
            options={[...roleOptions, { value: "__custom__", label: "Other / Enter manually..." }]}
            placeholder="Select a category"
            required
          />
          {(customRoleMode || (!isKnownRole && formData.role !== "")) && (
            <div className="space-y-2">
              <label className="block text-lg font-medium text-slate-300">Custom Role Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. Technical Director"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-lg focus:outline-none focus:border-cyan-500"
                />
              </div>
              <p className="text-lg text-cyan-400 font-extralight">
                Type any role name. This will be saved as-is on the accreditation.
              </p>
            </div>
          )}
          {eventCategories && eventCategories.length > 0 ? (
            <p className="text-lg text-emerald-400 font-extralight">
              {roleOptions.length} categories available from event settings
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
            <ZoneAccessSelector
              zones={zones}
              selectedRole={formData.role}
              selectedCodes={formData.zoneCodes}
              onToggle={toggleZone}
              onSelectAll={selectAllZones}
              onClearAll={clearAllZones}
            />
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

        {/* Expiry Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Accreditation Expiry</h3>
          <p className="text-lg text-slate-400 font-extralight">
            Control when this accreditation expires. Expired accreditations will show as EXPIRED on scans.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setExpiryMode("none")}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                expiryMode === "none"
                  ? "border-primary-500 bg-primary-500/20"
                  : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
              }`}
            >
              <CalendarX className={`w-5 h-5 flex-shrink-0 ${expiryMode === "none" ? "text-primary-400" : "text-slate-500"}`} />
              <div className="flex-1">
                <p className={`text-lg font-medium ${expiryMode === "none" ? "text-white" : "text-slate-300"}`}>No expiration</p>
                <p className="text-lg text-slate-500 font-extralight">Accreditation never expires</p>
              </div>
              {expiryMode === "none" && <Check className="w-4 h-4 text-primary-400 ml-auto" />}
            </button>
            {currentEvent?.endDate && (
              <button
                type="button"
                onClick={() => setExpiryMode("event")}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                  expiryMode === "event"
                    ? "border-cyan-500 bg-cyan-500/20"
                    : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                }`}
              >
                <Calendar className={`w-5 h-5 flex-shrink-0 ${expiryMode === "event" ? "text-cyan-400" : "text-slate-500"}`} />
                <div className="flex-1">
                  <p className={`text-lg font-medium ${expiryMode === "event" ? "text-white" : "text-slate-300"}`}>Expire on event end date</p>
                  <p className="text-lg text-slate-500 font-extralight">Expires: {currentEvent.endDate}</p>
                </div>
                {expiryMode === "event" && <Check className="w-4 h-4 text-cyan-400 ml-auto" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpiryMode("custom")}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                expiryMode === "custom"
                  ? "border-amber-500 bg-amber-500/20"
                  : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
              }`}
            >
              <Clock className={`w-5 h-5 flex-shrink-0 ${expiryMode === "custom" ? "text-amber-400" : "text-slate-500"}`} />
              <div className="flex-1">
                <p className={`text-lg font-medium ${expiryMode === "custom" ? "text-white" : "text-slate-300"}`}>Custom expiry date</p>
                <p className="text-lg text-slate-500 font-extralight">Set a specific date</p>
              </div>
              {expiryMode === "custom" && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
            </button>
          </div>
          {expiryMode === "custom" && (
            <div className="mt-2">
              <Input
                label="Custom Expiry Date"
                type="date"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                error={errors.expiryDate}
              />
            </div>
          )}
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
