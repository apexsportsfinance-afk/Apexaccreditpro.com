import React, { useState, useEffect } from "react";
import { 
  Plus, Edit, Trash2, Ticket, Users, 
  Check, X, AlertCircle, ShoppingBag,
  DollarSign, Package, Shield, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Button from "../ui/Button";
import Card, { CardHeader, CardContent } from "../ui/Card";
import Input from "../ui/Input";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { TicketingAPI } from "../../lib/storage";

export default function TicketingManagement({ event }) {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [ticketTypes, setTicketTypes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [typeModal, setTypeModal] = useState({ open: false, data: null });
  const [packageModal, setPackageModal] = useState({ open: false, data: null });

  useEffect(() => {
    loadData();
  }, [event?.id]);


  const loadData = async () => {
    setLoading(true);
    try {
      const [types, pkgs] = await Promise.all([
        TicketingAPI.getTypes(event.id),
        TicketingAPI.getPackages(event.id)
      ]);
      setTicketTypes(types);
      setPackages(pkgs);
    } catch (err) {
      toast.error("Failed to load ticketing data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      eventId: event.id,
      name: formData.get("name"),
      description: formData.get("description"),
      price: parseFloat(formData.get("price")),
      capacity: formData.get("capacity") ? parseInt(formData.get("capacity")) : null,
      isActive: true,
      isFullEvent: formData.get("isFullEvent") === "on"
    };

    try {
      if (typeModal.data?.id) {
        await TicketingAPI.updateType(typeModal.data.id, data);
        toast.success("Ticket type updated");
      } else {
        await TicketingAPI.createType(data);
        toast.success("Ticket type created");
      }
      setTypeModal({ open: false, data: null });
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to save ticket type");
    }
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      eventId: event.id,
      name: formData.get("name"),
      description: formData.get("description"),
      price: parseFloat(formData.get("price")),
      quantityIncluded: parseInt(formData.get("quantityIncluded")),
      isActive: true,
      isFullEvent: formData.get("isFullEvent") === "on"
    };

    try {
      if (packageModal.data?.id) {
        await TicketingAPI.updatePackage(packageModal.data.id, data);
        toast.success("Package updated");
      } else {
        await TicketingAPI.createPackage(data);
        toast.success("Package created");
      }
      setPackageModal({ open: false, data: null });
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to save package");
    }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ticket type?")) return;
    try {
      await TicketingAPI.deleteType(id);
      toast.success("Ticket type deleted");
      loadData();
    } catch (err) {
      toast.error("Failed to delete ticket type");
    }
  };

  const handleDeletePackage = async (id) => {
    if (!window.confirm("Are you sure you want to delete this package?")) return;
    try {
      await TicketingAPI.deletePackage(id);
      toast.success("Package deleted");
      loadData();
    } catch (err) {
      toast.error("Failed to delete package");
    }
  };


  if (loading) {
    return <div className="text-center py-10 text-slate-400">Loading ticketing options...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Ticket Types Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Ticket className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Ticket Types</h3>
          </div>
          <Button size="sm" icon={Plus} onClick={() => setTypeModal({ open: true, data: null })}>
            Add Type
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ticketTypes.map((type) => (
            <Card key={type.id} className="border-slate-800 bg-slate-900/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-white">{type.name}</h4>
                    <p className="text-sm text-slate-500 line-clamp-1">{type.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setTypeModal({ open: true, data: type })} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteType(type.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="flex flex-col">
                    <div className="text-lg font-black text-cyan-400">{type.price} <span className="text-xs text-slate-600">AED</span></div>
                    <div className={`text-[9px] font-bold uppercase tracking-tighter ${type.isFullEvent ? 'text-amber-500' : 'text-slate-500'}`}>
                      {type.isFullEvent ? 'Full Event Pass' : 'Daily Ticket'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{type.capacity ? `${type.capacity} Limit` : 'No Limit'}</div>
                </div>
              </CardContent>
            </Card>
          ))}
          {ticketTypes.length === 0 && (
            <div className="col-span-full py-8 border-2 border-dashed border-slate-800 rounded-xl text-center text-slate-500">
              No ticket types created yet.
            </div>
          )}
        </div>
      </section>

      {/* Packages Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Ticket Packages</h3>
          </div>
          <Button size="sm" icon={Plus} variant="secondary" onClick={() => setPackageModal({ open: true, data: null })}>
            Add Package
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="border-slate-800 bg-slate-900/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-white">{pkg.name}</h4>
                    <p className="text-sm text-slate-500 line-clamp-1">{pkg.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPackageModal({ open: true, data: pkg })} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePackage(pkg.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="flex flex-col">
                    <div className="text-lg font-black text-purple-400">{pkg.price} <span className="text-xs text-slate-600">AED</span></div>
                    <div className={`text-[9px] font-bold uppercase tracking-tighter ${pkg.isFullEvent ? 'text-amber-500' : 'text-slate-500'}`}>
                      {pkg.isFullEvent ? 'Full Event Pass' : 'Daily Package'}
                    </div>
                  </div>
                  <div className="px-2 py-0.5 bg-purple-500/10 rounded text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                    {pkg.quantityIncluded} Tickets
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {packages.length === 0 && (
            <div className="col-span-full py-8 border-2 border-dashed border-slate-800 rounded-xl text-center text-slate-500">
              No packages created yet.
            </div>
          )}
        </div>
      </section>

      {/* Generic Pass Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Generic Pass Configuration</h3>
        </div>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-md">
                <h4 className="text-white font-bold mb-1 uppercase italic tracking-tighter">Spectator Generic Pass Portal</h4>
                <p className="text-sm text-slate-400 leading-relaxed font-extralight">
                  Share this exclusive link with specific groups. Spectators will be required to enter the 
                  <span className="text-emerald-400 font-bold mx-1">Generic Pass PIN</span> 
                  (configured in System Settings) to view and download their pass.
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 text-slate-400 text-xs font-mono truncate select-all min-w-[200px]">
                    {`${window.location.origin}/generic-pass?event_id=${event.id}`}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/generic-pass?event_id=${event.id}`);
                      toast.success("Link copied!");
                    }}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700"
                    title="Copy Portal Link"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button 
                  onClick={() => window.open(`/generic-pass?event_id=${event.id}`, '_blank')}
                  variant="secondary" 
                  className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold uppercase tracking-widest text-xs"
                >
                  Preview Portal
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Type Modal */}
      <AnimatePresence>
        {typeModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{typeModal.data ? 'Edit Ticket Type' : 'Add Ticket Type'}</h3>
                <button onClick={() => setTypeModal({ open: false, data: null })} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveType} className="space-y-4">
                <Input label="Name" name="name" defaultValue={typeModal.data?.name} required placeholder="e.g. General Admission" />
                <Input label="Description" name="description" defaultValue={typeModal.data?.description} placeholder="e.g. Single day entry" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Price (AED)" name="price" type="number" step="0.01" defaultValue={typeModal.data?.price} required />
                  <Input label="Capacity (Optional)" name="capacity" type="number" defaultValue={typeModal.data?.capacity} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">Full Event Pass</p>
                    <p className="text-[10px] text-slate-500">Fixed price for all days</p>
                  </div>
                  <input 
                    type="checkbox" 
                    name="isFullEvent" 
                    defaultChecked={typeModal.data?.isFullEvent}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setTypeModal({ open: false, data: null })}>Cancel</Button>
                  <Button type="submit" className="flex-1">Save Ticket</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Package Modal */}
      <AnimatePresence>
        {packageModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{packageModal.data ? 'Edit Package' : 'Add Package'}</h3>
                <button onClick={() => setPackageModal({ open: false, data: null })} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSavePackage} className="space-y-4">
                <Input label="Name" name="name" defaultValue={packageModal.data?.name} required placeholder="e.g. Family Pack" />
                <Input label="Description" name="description" defaultValue={packageModal.data?.description} placeholder="e.g. Best for 4 people" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Price (AED)" name="price" type="number" step="0.01" defaultValue={packageModal.data?.price} required />
                  <Input label="Tickets Included" name="quantityIncluded" type="number" defaultValue={packageModal.data?.quantityIncluded || 1} required />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">Full Event Pass</p>
                    <p className="text-[10px] text-slate-500">Fixed price for all days</p>
                  </div>
                  <input 
                    type="checkbox" 
                    name="isFullEvent" 
                    defaultChecked={packageModal.data?.isFullEvent ?? true}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-purple-500/20"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setPackageModal({ open: false, data: null })}>Cancel</Button>
                  <Button type="submit" className="flex-1">Save Package</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
