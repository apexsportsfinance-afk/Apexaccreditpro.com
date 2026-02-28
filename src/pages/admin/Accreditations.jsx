import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Plus, Filter } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import BulkOperations from "../../components/Accreditation/BulkOperations";
import BadgeGenerator from "../../components/Accreditation/BadgeGenerator";
import AccreditationCardPreview from "../../components/Accreditation/AccreditationCardPreview";
import { Modal } from "../../components/ui/Modal";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { AccreditationsAPI, EventsAPI, ZonesAPI } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { getStatusColor, getRoleColor, getCountryName, COUNTRIES } from "../../lib/utils";

export default function Accreditations() {
  const [accreditations, setAccreditations] = useState([]);
  const [events, setEvents] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewAccreditation, setPreviewAccreditation] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsData, zonesData] = await Promise.all([
        EventsAPI.getAll(),
        ZonesAPI.getAll()
      ]);
      setEvents(eventsData);
      setZones(zonesData);
      
      if (eventsData.length > 0 && !selectedEvent) {
        setSelectedEvent(eventsData[0].id);
        loadAccreditations(eventsData[0].id);
      }
    } catch (error) {
      toast.error("Failed to load data");
    }
  };

  const loadAccreditations = async (eventId) => {
    setLoading(true);
    try {
      const data = await AccreditationsAPI.getByEventId(eventId);
      setAccreditations(data);
      setSelectedRows([]); // Clear selection on event change
    } catch (error) {
      toast.error("Failed to load accreditations");
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = (e) => {
    const eventId = e.target.value;
    setSelectedEvent(eventId);
    loadAccreditations(eventId);
  };

  // Filter logic
  const filteredData = accreditations.filter(item => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (roleFilter && item.role !== roleFilter) return false;
    if (countryFilter && item.nationality !== countryFilter) return false;
    return true;
  });

  const handleBulkEdit = async (ids, updates) => {
    try {
      await Promise.all(ids.map(id => AccreditationsAPI.update(id, updates)));
      toast.success(`Updated ${ids.length} records`);
      loadAccreditations(selectedEvent);
      setSelectedRows([]);
    } catch (error) {
      toast.error("Bulk update failed");
    }
  };

  const columns = [
    { key: "accreditationId", header: "ID", sortable: true },
    { key: "badgeNumber", header: "Badge", sortable: true },
    { 
      key: "firstName", 
      header: "Name", 
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.photoUrl && (
            <img src={row.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          )}
          <div>
            <div className="font-medium">{row.firstName} {row.lastName}</div>
            <div className="text-xs text-slate-500">{row.email}</div>
          </div>
        </div>
      )
    },
    { 
      key: "role", 
      header: "Role",
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs ${getRoleColor(row.role)}`}>
          {row.role}
        </span>
      )
    },
    { key: "club", header: "Club" },
    { 
      key: "nationality", 
      header: "Country",
      render: (row) => getCountryName(row.nationality)
    },
    { 
      key: "status", 
      header: "Status",
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(row.status)}`}>
          {row.status}
        </span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setPreviewAccreditation(row);
              setShowPreview(true);
            }}
            className="p-2 hover:bg-slate-700 rounded-lg text-cyan-400"
            title="Preview"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const currentEvent = events.find(e => e.id === selectedEvent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Accreditations</h1>
          <p className="text-slate-400 mt-1">Manage participant accreditations</p>
        </div>
        <Button variant="primary" icon={Plus}>
          Add Accreditation
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchableSelect
              label="Event"
              value={selectedEvent}
              onChange={(e) => handleEventChange({ target: { value: e.target.value } })}
              options={events.map(e => ({ value: e.id, label: e.name }))}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">All Roles</option>
              <option value="Athlete">Athlete</option>
              <option value="Coach">Coach</option>
              <option value="Official">Official</option>
              <option value="Media">Media</option>
              <option value="Medical">Medical</option>
              <option value="Staff">Staff</option>
            </select>

            <select 
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">All Countries</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent>
          <BulkOperations
            selectedRows={selectedRows}
            filteredData={filteredData}
            event={currentEvent}
            zones={zones}
            onClearSelection={setSelectedRows}
            onBulkEdit={handleBulkEdit}
          />

          <DataTable
            data={filteredData}
            columns={columns}
            selectable={true}
            selectedRows={selectedRows}
            onSelectRows={setSelectedRows}
            searchable={true}
            searchFields={["firstName", "lastName", "email", "club", "badgeNumber"]}
            loading={loading}
            emptyMessage="No accreditations found"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Accreditation Card Preview"
        size="full"
      >
        {previewAccreditation && currentEvent && (
          <BadgeGenerator 
            accreditation={previewAccreditation} 
            event={currentEvent} 
            zones={zones}
            onClose={() => setShowPreview(false)}
          >
            <AccreditationCardPreview 
              accreditation={previewAccreditation} 
              event={currentEvent} 
              zones={zones} 
            />
          </BadgeGenerator>
        )}
      </Modal>
    </motion.div>
  );
}
