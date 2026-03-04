import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, Edit, Trash2, MapPin, AlertCircle } from "lucide-react";
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
        <Button icon={Plus} onClick={() => handleOpenModal()} disabled={!selectedEvent}>
          Create Zone
        </Button>
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
            <EmptyState
              icon={MapPin}
              title="No Zones Yet"
              description="Create zones to define access areas for this event"
              action={() => handleOpenModal()}
              actionLabel="Create Zone"
              actionIcon={Plus}
            />
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
    </div>
  );
}
