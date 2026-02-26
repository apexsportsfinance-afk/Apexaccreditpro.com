import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, MapPin, Edit, Trash2, Palette, Check, Copy } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { EventsAPI, ZonesAPI } from "../../lib/storage";

const ZONE_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#64748b", label: "Gray" },
  { value: "#78716c", label: "Stone" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#a855f7", label: "Violet" },
  { value: "#84cc16", label: "Lime" },
  { value: "#d946ef", label: "Fuchsia" }
];

function getContrastColor(hex) {
  if (!hex || hex.length < 7) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1e293b" : "#ffffff";
}

function ColorPicker({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColor, setCustomColor] = useState(value || "#3b82f6");
  const isPreset = ZONE_COLORS.some((c) => c.value === value);

  useEffect(() => {
    if (value && !isPreset) {
      setCustomColor(value);
    }
  }, [value, isPreset]);

  const handleCustomChange = (e) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  const handleHexInput = (e) => {
    let val = e.target.value;
    if (!val.startsWith("#")) {
      val = "#" + val;
    }
    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
      setCustomColor(val);
      if (val.length === 7) {
        onChange(val);
      }
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-lg font-medium text-slate-300">Color</label>
      {/* Preset colors grid */}
      <div className="grid grid-cols-8 gap-2">
        {ZONE_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => {
              onChange(color.value);
              setShowCustom(false);
            }}
            className="group relative w-full aspect-square rounded-lg border-2 transition-all duration-150 hover:scale-110 hover:shadow-lg"
            style={{
              backgroundColor: color.value,
              borderColor: value === color.value ? "#ffffff" : "transparent"
            }}
            title={color.label}
          >
            {value === color.value && (
              <Check
                className="absolute inset-0 m-auto w-4 h-4"
                style={{ color: getContrastColor(color.value) }}
                strokeWidth={3}
              />
            )}
          </button>
        ))}
      </div>

      {/* Custom color toggle */}
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-lg font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors border border-slate-700"
      >
        <Palette className="w-4 h-4" />
        {showCustom ? "Hide Custom Color" : "Choose Custom Color"}
      </button>

      {/* Custom color picker */}
      {showCustom && (
        <div className="flex items-center gap-3 p-4 bg-slate-800/80 rounded-lg border border-slate-700">
          <div className="flex flex-col gap-2">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomChange}
              className="w-14 h-14 rounded-lg border-2 border-slate-600 cursor-pointer bg-transparent"
            />
            <span className="text-lg text-slate-500 text-center">Pick</span>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-lg text-slate-400">Hex Code</label>
            <input
              type="text"
              value={!isPreset && value ? value : customColor}
              onChange={handleHexInput}
              placeholder="#ff5500"
              maxLength={7}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 font-mono uppercase"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-14 h-14 rounded-lg border-2 border-slate-600 flex-shrink-0"
              style={{ backgroundColor: !isPreset && value ? value : customColor }}
            />
            <span className="text-lg text-slate-500">Preview</span>
          </div>
        </div>
      )}

      {/* Current selection display */}
      <div className="flex items-center gap-2 text-lg text-slate-400">
        <span>Selected:</span>
        <div
          className="w-6 h-6 rounded-md border border-slate-600"
          style={{ backgroundColor: value || "#3b82f6" }}
        />
        <span className="font-mono">{value || "#3b82f6"}</span>
      </div>
    </div>
  );
}

export default function Zones() {
  const [events, setEvents] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyFromEvent, setCopyFromEvent] = useState("");
  const [copyFromZones, setCopyFromZones] = useState([]);
  const [selectedZonesToCopy, setSelectedZonesToCopy] = useState([]);
  const [copying, setCopying] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    color: "#3b82f6",
    description: ""
  });
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      const allEvents = await EventsAPI.getAll();
      setEvents(allEvents);
      if (allEvents.length > 0) {
        setSelectedEvent(allEvents[0].id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      ZonesAPI.getByEventId(selectedEvent).then(setZones);
    }
  }, [selectedEvent]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      color: "#3b82f6",
      description: ""
    });
    setEditingZone(null);
  };

  const handleOpenModal = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        code: zone.code,
        name: zone.name,
        color: zone.color || "#3b82f6",
        description: zone.description || ""
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingZone) {
        await ZonesAPI.update(editingZone.id, formData);
        toast.success("Zone updated successfully");
      } else {
        await ZonesAPI.create({ ...formData, eventId: selectedEvent });
        toast.success("Zone created successfully");
      }

      handleCloseModal();
      setZones(await ZonesAPI.getByEventId(selectedEvent));
    } catch (error) {
      console.error("Zone save error:", error);
      toast.error("Failed to save zone: " + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (zone) => {
    if (confirm(`Are you sure you want to delete zone "${zone.name}"?`)) {
      try {
        await ZonesAPI.delete(zone.id);
        toast.success("Zone deleted");
        setZones(await ZonesAPI.getByEventId(selectedEvent));
      } catch (error) {
        console.error("Zone delete error:", error);
        toast.error("Failed to delete zone");
      }
    }
  };

  const handleOpenCopyModal = () => {
    setCopyFromEvent("");
    setCopyFromZones([]);
    setSelectedZonesToCopy([]);
    setCopyModalOpen(true);
  };

  const handleCopyEventChange = async (eventId) => {
    setCopyFromEvent(eventId);
    setSelectedZonesToCopy([]);
    if (eventId) {
      const eventZones = await ZonesAPI.getByEventId(eventId);
      setCopyFromZones(eventZones);
      // Auto-select all non-duplicate zones
      const autoSelected = eventZones
        .filter((z) => !zones.some((ez) => ez.code === z.code && ez.name === z.name))
        .map((z) => z.id);
      setSelectedZonesToCopy(autoSelected);
    } else {
      setCopyFromZones([]);
    }
  };

  const handleToggleZoneToCopy = (zoneId) => {
    setSelectedZonesToCopy((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleToggleAllZones = () => {
    const nonDuplicateIds = copyFromZones
      .filter((z) => !zones.some((ez) => ez.code === z.code && ez.name === z.name))
      .map((z) => z.id);
    if (nonDuplicateIds.every((id) => selectedZonesToCopy.includes(id))) {
      setSelectedZonesToCopy([]);
    } else {
      setSelectedZonesToCopy(nonDuplicateIds);
    }
  };

  const handleCopyZones = async () => {
    if (!copyFromEvent || selectedZonesToCopy.length === 0) {
      toast.error("No zones selected to copy");
      return;
    }
    setCopying(true);
    try {
      let copiedCount = 0;
      const zonesToCopy = copyFromZones.filter((z) => selectedZonesToCopy.includes(z.id));
      for (const zone of zonesToCopy) {
        await ZonesAPI.create({
          code: zone.code,
          name: zone.name,
          color: zone.color,
          description: zone.description,
          eventId: selectedEvent
        });
        copiedCount++;
      }
      setCopyModalOpen(false);
      setZones(await ZonesAPI.getByEventId(selectedEvent));
      if (copiedCount > 0) {
        toast.success(`Copied ${copiedCount} zone${copiedCount > 1 ? "s" : ""} successfully`);
      } else {
        toast.info("All zones already exist in this event");
      }
    } catch (error) {
      console.error("Copy zones error:", error);
      toast.error("Failed to copy zones");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div id="zones_page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Zones</h1>
          <p className="text-lg text-slate-400 font-extralight">
            Configure access zones for your events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={Copy}
            variant="secondary"
            onClick={handleOpenCopyModal}
            disabled={!selectedEvent}
          >
            Copy from Event
          </Button>
          <Button
            icon={Plus}
            onClick={() => handleOpenModal()}
            disabled={!selectedEvent}
          >
            Add Zone
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <Select
            label="Select Event"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            options={events.map((e) => ({
              value: e.id,
              label: e.name
            }))}
            placeholder="Choose an event"
          />
        </CardContent>
      </Card>

      {!selectedEvent ? (
        <EmptyState
          icon={MapPin}
          title="Select an Event"
          description="Choose an event to manage its zones"
        />
      ) : zones.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No Zones Configured"
          description="Add zones to define access areas for this event"
          action={() => handleOpenModal()}
          actionLabel="Add Zone"
          actionIcon={Plus}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone, index) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full">
                <CardContent className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                    style={{ backgroundColor: zone.color || "#3b82f6" }}
                  >
                    <span
                      className="text-2xl font-bold"
                      style={{ color: getContrastColor(zone.color || "#3b82f6") }}
                    >
                      {zone.code}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white">
                      {zone.name}
                    </h3>
                    {zone.description && (
                      <p className="text-lg text-slate-400 mt-1">
                        {zone.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="w-4 h-4 rounded-full border border-slate-600"
                        style={{ backgroundColor: zone.color || "#3b82f6" }}
                      />
                      <span className="text-lg text-slate-500 font-mono">
                        {zone.color || "#3b82f6"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleOpenModal(zone)}
                        className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                        title="Edit Zone"
                      >
                        <Edit className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(zone)}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                        title="Delete Zone"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Zone Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingZone ? "Edit Zone" : "Create Zone"}
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Zone Code"
              value={formData.code}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
              placeholder="A"
              required
              maxLength={3}
            />
            <Input
              label="Zone Name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Pool Deck"
              required
            />
          </div>

          <ColorPicker
            value={formData.color}
            onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
          />

          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-lg"
              placeholder="Describe this zone access area..."
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-lg text-slate-400 mb-3">Preview:</p>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: formData.color || "#3b82f6" }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{ color: getContrastColor(formData.color || "#3b82f6") }}
                >
                  {formData.code || "?"}
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  {formData.name || "Zone Name"}
                </p>
                <p className="text-lg text-slate-400">
                  {formData.description || "No description"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              loading={saving}
              disabled={saving}
            >
              {editingZone ? "Update Zone" : "Create Zone"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Copy Zones Modal */}
      <Modal
        isOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        title="Copy Zones from Event"
        size="lg"
      >
        <div className="p-6 space-y-5">
          <Select
            label="Select Source Event"
            value={copyFromEvent}
            onChange={(e) => handleCopyEventChange(e.target.value)}
            options={events
              .filter((e) => e.id !== selectedEvent)
              .map((e) => ({ value: e.id, label: e.name }))}
            placeholder="Choose event to copy zones from"
          />

          {copyFromEvent && copyFromZones.length === 0 && (
            <p className="text-lg text-slate-400 font-extralight text-center py-4">
              No zones found in the selected event
            </p>
          )}

          {copyFromZones.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-medium text-slate-300">
                  Select zones to copy ({selectedZonesToCopy.length}/{copyFromZones.length}):
                </p>
                <button
                  type="button"
                  onClick={handleToggleAllZones}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copyFromZones
                    .filter((z) => !zones.some((ez) => ez.code === z.code && ez.name === z.name))
                    .every((z) => selectedZonesToCopy.includes(z.id))
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {copyFromZones.map((zone) => {
                  const alreadyExists = zones.some(
                    (z) => z.code === zone.code && z.name === zone.name
                  );
                  const isSelected = selectedZonesToCopy.includes(zone.id);
                  return (
                    <label
                      key={zone.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        alreadyExists
                          ? "border-yellow-500/30 bg-yellow-500/5 opacity-50 cursor-not-allowed"
                          : isSelected
                          ? "border-blue-500/40 bg-blue-500/10"
                          : "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyExists}
                        onChange={() => handleToggleZoneToCopy(zone.id)}
                        className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-700 flex-shrink-0"
                      />
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: zone.color || "#3b82f6" }}
                      >
                        <span
                          className="text-lg font-bold"
                          style={{ color: getContrastColor(zone.color || "#3b82f6") }}
                        >
                          {zone.code}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-medium text-white">{zone.name}</p>
                        {zone.description && (
                          <p className="text-lg text-slate-400 font-extralight truncate">
                            {zone.description}
                          </p>
                        )}
                      </div>
                      {alreadyExists && (
                        <span className="text-lg text-yellow-400 font-extralight flex-shrink-0">
                          Already exists
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCopyModalOpen(false)}
              className="flex-1"
              disabled={copying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopyZones}
              className="flex-1"
              loading={copying}
              disabled={copying || selectedZonesToCopy.length === 0}
              icon={Copy}
            >
              Copy {selectedZonesToCopy.length > 0 ? `${selectedZonesToCopy.length} ` : ""}Zone{selectedZonesToCopy.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}