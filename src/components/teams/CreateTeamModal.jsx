import React, { useState } from "react";
import { X, Building2, MapPin, Phone, Mail, User } from "lucide-react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function CreateTeamModal({ isOpen, onClose, onSubmit, events, defaultEventId }) {
  const [formData, setFormData] = useState({
    event_id: defaultEventId || "",
    name: "",
    short_name: "",
    country: "",
    city: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    logo_url: "",
    status: "pending",
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.event_id) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      // Reset form
      setFormData({
        event_id: defaultEventId || "",
        name: "",
        short_name: "",
        country: "",
        city: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        logo_url: "",
        status: "pending",
        notes: ""
      });
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
      title="Create New Team"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Selection */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-main">Event <span className="text-red-500">*</span></label>
          <select
            value={formData.event_id}
            onChange={(e) => setFormData(prev => ({ ...prev, event_id: e.target.value }))}
            className="w-full bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
            required
          >
            <option value="">Select an Event</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>

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
          <Input
            label="Country"
            value={formData.country}
            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            placeholder="e.g. United Arab Emirates"
            icon={MapPin}
          />
          <Input
            label="City / Emirate"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            placeholder="e.g. Sharjah"
            icon={MapPin}
          />
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
              placeholder="e.g. +971 50 000 0000"
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

        <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-main">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <Input
            label="Logo URL (Optional)"
            value={formData.logo_url}
            onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1.5 border-t border-border pt-4">
          <label className="text-sm font-medium text-main">Internal Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full bg-base-alt border border-border rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none h-24"
            placeholder="Add any internal administrative notes here..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Create Team
          </Button>
        </div>
      </form>
    </Modal>
  );
}
