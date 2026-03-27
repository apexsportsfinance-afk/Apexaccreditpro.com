import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, Edit, Trash2, MapPin, AlertCircle, Copy } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Card, { CardContent } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import DataTable from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { EventsAPI, ZonesAPI } from "../../lib/storage";

export default function Zones() {
  const [zones, setZones] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, zone: null });
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    color: "#2563eb",
    description: ""
  });
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [sourceEventId, setSourceEventId] = useState("");
  const [sourceZones, setSourceZones] = useState([]);
  const [selectedZonesToCopy, setSelectedZonesToCopy] = useState([]);
  const [copying, setCopying] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      ZonesAPI.getByEventId(selectedEvent).then(setZones);
    } else {
      setZones([]);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (sourceEventId && copyModalOpen) {
      ZonesAPI.getByEventId(sourceEventId).then(zones => {
        setSourceZones(zones);
        setSelectedZonesToCopy(zones.map(z => z.id)); // Select all by default
      });
    } else {
      setSourceZones([]);
      setSelectedZonesToCopy([]);
    }
  }, [sourceEventId, copyModalOpen]);

  const loadEvents = async () => {
    const allEvents = await EventsAPI.getAll();
    setEvents(allEvents);
    if (allEvents.length > 0) {
      setSelectedEvent(allEvents[0].id);
    }
  };

  const resetForm = () => {
    setFormData({ code: "", name: "", color: "#2563eb", description: "" });
    setEditingZone(null);
  };

  const handleOpenModal = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        code: zone.code,
        name: zone.name,
        color: zone.color || "#2563eb",
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
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    if (!selectedEvent) {
      toast.error("Please select an event first");
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
      const updated = await ZonesAPI.getByEventId(selectedEvent);
      setZones(updated);
    } catch (error) {
      console.error("Zone save error:", error);
      toast.error("Failed to save zone: " + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyZones = async (e) => {
    e.preventDefault();
    if (!sourceEventId) {
      toast.error("Please select a source event");
      return;
    }
    if (selectedZonesToCopy.length === 0) {
      toast.error("Please select at least one zone to copy");
      return;
    }
    setCopying(true);
    try {
      const zonesToCopy = sourceZones.filter(z => selectedZonesToCopy.includes(z.id));
      if (zonesToCopy.length === 0) {
        toast.error("Selected event has no zones to copy");
        setCopying(false);
        return;
      }
      
      const promises = zonesToCopy.map(zone => {
        const newZone = {
          code: zone.code,
          name: zone.name,
          color: zone.color,
          description: zone.description,
          allowedRoles: zone.allowedRoles,
          eventId: selectedEvent
        };
        return ZonesAPI.create(newZone);
      });
      
      await Promise.all(promises);
      toast.success(`Successfully copied ${zonesToCopy.length} zones`);
      setCopyModalOpen(false);
      setSourceEventId("");
      const updated = await ZonesAPI.getByEventId(selectedEvent);
      setZones(updated);
    } catch (error) {
      console.error("Copy zones error:", error);
      toast.error("Failed to copy zones: " + (error.message || "Unknown error"));
    } finally {
      setCopying(false);
    }
  };

  const handleDelete = (zone) => {
    setDeleteModal({ open: true, zone });
  };

  const confirmDelete = async () => {
    if (!deleteModal.zone) return;
    setDeleting(true);
    try {
      await ZonesAPI.delete(deleteModal.zone.id);
      toast.success("Zone deleted successfully");
      setDeleteModal({ open: false, zone: null });
      const updated = await ZonesAPI.getByEventId(selectedEvent);
      setZones(updated);
    } catch (error) {
      toast.error("Failed to delete zone: " + (error.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "code",
      header: "Code",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: row.color || "#2563eb" }}
          >
            {row.code}
          </div>
          <span className="font-mono text-lg text-white">{row.code}</span>
        </div>
      )
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (row) => (
        <span className="text-lg text-slate-200">{row.name}</span>
      )
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-lg text-slate-400 font-extralight">{row.description || "—"}</span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div id="zones_page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Zones</h1>
          <p className="text-lg text-slate-400 font-extralight">
            Manage venue access zones per event
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" icon={Copy} onClick={() => setCopyModalOpen(true)} disabled={!selectedEvent || events.length < 2}>
            Copy Zones
          </Button>
          <Button icon={Plus} onClick={() => handleOpenModal()} disabled={!selectedEvent}>
            Create Zone
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="mb-6 max-w-xs">
            <Select
              label="Select Event"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              options={events.map((ev) => ({ value: ev.id, label: ev.name }))}
              placeholder="Select an event"
            />
          </div>

          {!selectedEvent ? (
            <EmptyState
              icon={MapPin}
              title="Select an Event"
              description="Choose an event to view and manage its zones"
            />
          ) : zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-primary-400 opacity-60" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Zones Yet</h3>
              <p className="text-lg text-slate-400 font-extralight max-w-sm mb-6">
                Create zones to define access areas for this event
              </p>
              <div className="flex gap-4">
                <Button variant="outline" icon={Copy} onClick={() => setCopyModalOpen(true)} disabled={events.length < 2}>
                  Copy from Event
                </Button>
                <Button icon={Plus} onClick={() => handleOpenModal()}>
                  Create Zone
                </Button>
              </div>
            </div>
          ) : (
            <DataTable
              data={zones}
              columns={columns}
              searchable
              searchFields={["code", "name", "description"]}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingZone ? "Edit Zone" : "Create Zone"}
      >
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <Input
            label="Zone Code"
            value={formData.code}
            onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="A1"
            required
            maxLength={5}
          />
          <Input
            label="Zone Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Athlete Area"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Access restricted to athletes only"
          />
          <div>
            <label className="block text-lg font-medium text-slate-300 mb-1.5">
              Zone Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                className="w-12 h-10 rounded cursor-pointer border border-slate-700"
              />
              <span className="text-lg text-slate-400">{formData.color}</span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: formData.color }}
              >
                {formData.code || "Z"}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1" disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
              {editingZone ? "Update Zone" : "Create Zone"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteModal.open}
        onClose={() => !deleting && setDeleteModal({ open: false, zone: null })}
        title="Delete Zone"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-400">Delete this zone?</p>
              <p className="text-lg text-slate-300 font-extralight mt-1">
                Zone <span className="font-bold text-white">{deleteModal.zone?.code} - {deleteModal.zone?.name}</span> will be permanently removed.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteModal({ open: false, zone: null })}
              className="flex-1"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              className="flex-1"
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Zone"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={copyModalOpen}
        onClose={() => !copying && setCopyModalOpen(false)}
        title="Copy Zones from Event"
      >
        <form onSubmit={handleCopyZones} className="p-6 space-y-4">
          <p className="text-slate-300 text-lg font-light mb-4 text-center">
            Select a previous event to clone its venue access zones into the current event.
          </p>
          <Select
            label="Source Event"
            value={sourceEventId}
            onChange={(e) => setSourceEventId(e.target.value)}
            options={events.filter(e => e.id !== selectedEvent).map((ev) => ({ value: ev.id, label: ev.name }))}
            placeholder="Select source event..."
            required
          />
          
          {sourceEventId && sourceZones.length === 0 ? (
            <p className="text-slate-400 italic text-center py-4 bg-slate-800/50 rounded-lg border border-slate-700">This event has no zones to copy.</p>
          ) : sourceZones.length > 0 && (
            <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex items-center justify-between mb-3 px-1">
                <label className="text-sm font-semibold text-slate-300">
                  Select Zones ({selectedZonesToCopy.length}/{sourceZones.length})
                </label>
                <button 
                  type="button" 
                  onClick={() => setSelectedZonesToCopy(selectedZonesToCopy.length === sourceZones.length ? [] : sourceZones.map(z => z.id))}
                  className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                >
                  {selectedZonesToCopy.length === sourceZones.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="space-y-2">
                {sourceZones.map(zone => (
                  <label 
                    key={zone.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedZonesToCopy.includes(zone.id) 
                        ? 'border-primary-500/50 bg-primary-500/10' 
                        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedZonesToCopy.includes(zone.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZonesToCopy(prev => [...prev, zone.id]);
                        } else {
                          setSelectedZonesToCopy(prev => prev.filter(id => id !== zone.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-slate-900 bg-slate-900 cursor-pointer"
                    />
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: zone.color || "#2563eb" }}
                      >
                        {zone.code}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-slate-200 font-medium truncate">{zone.name}</span>
                        {zone.description && (
                          <span className="text-xs text-slate-400 truncate">{zone.description}</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-800">
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
              type="submit"
              className="flex-1"
              loading={copying}
              disabled={copying || !sourceEventId}
            >
              {copying ? "Copying..." : "Copy Zones"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
