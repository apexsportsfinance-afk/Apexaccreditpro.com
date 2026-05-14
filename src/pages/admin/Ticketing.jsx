import React, { useState, useEffect } from "react";
import {
  Ticket,
  Users,
  Calendar,
  Search,
  Download,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Shield,
  Lock,
  LogOut,
  X,
  AlertCircle,
  TrendingUp,
  Clock,
  Filter,
  QrCode,
  ArrowRight,
  FileSpreadsheet
} from "lucide-react";
import * as XLSX from 'xlsx';
import { motion } from "framer-motion";
import { EventsAPI, TicketingAPI } from "../../lib/storage";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../../components/ui/Button";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import { supabaseAnonKey, supabaseUrl } from "../../lib/supabase";
import TicketingManagement from "../../components/admin/TicketingManagement";
import BoxOfficeTab from "../../components/admin/BoxOfficeTab";
import RevenueTab from "../../components/admin/RevenueTab";
import { supabase } from "../../lib/supabase";

export default function Ticketing() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedLink, setCopiedLink] = useState(null);

  // Security PIN state
  const [storedPin, setStoredPin] = useState(null);
  const [pinModal, setPinModal] = useState({ open: false, orderId: null, value: "" });
  const [isVerifying, setIsVerifying] = useState(false);
  const toast = useToast();
  const { canAccessEvent } = useAuth();

  useEffect(() => {
    loadEvents();
    loadSecurityPin();
  }, []);

  const loadSecurityPin = async () => {
    try {
      const pin = await TicketingAPI.getSecuritySetting("deletion_pin");
      setStoredPin(pin);
    } catch (err) {
      console.warn("Security PIN not configured");
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      loadOrders(selectedEventId);

      // [RT-SYNC] Subscribe to live attendance updates
      const channel = supabase
        .channel(`spectator-updates-${selectedEventId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'spectator_orders',
          filter: `event_id=eq.${selectedEventId}`
        }, (payload) => {
          console.log("Real-time update received:", payload.eventType, "Refreshing spectator attendance ledger...");
          loadOrders(selectedEventId);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const data = await EventsAPI.getAll();
      const filtered = data.filter(e => canAccessEvent(e.id));
      setEvents(filtered);
      if (filtered.length > 0) {
        setSelectedEventId(filtered[0].id);
      }
    } catch (err) {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (eventId) => {
    if (!eventId) return;
    console.log("Fetching orders for event:", eventId);
    try {
      const data = await TicketingAPI.getOrders(eventId);
      console.log(`Fetched ${data?.length || 0} orders`);
      setOrders(data || []);
    } catch (err) {
      console.error("Orders load error:", err);
      toast.error("Failed to load orders");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (storedPin) {
      setPinModal({ open: true, orderId, value: "" });
      return;
    }

    if (!window.confirm("ARE YOU SURE? This will permanently delete the order and all associated guest tickets.")) return;
    performDelete(orderId);
  };

  const performDelete = async (orderId) => {
    try {
      await TicketingAPI.deleteOrder(orderId);
      toast.success("Order deleted permanently");
      loadOrders(selectedEventId);
      setPinModal({ open: false, orderId: null, value: "" });
    } catch (err) {
      toast.error("Failed to delete order");
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinModal.value === storedPin) {
      setIsVerifying(true);
      performDelete(pinModal.orderId);
    } else {
      toast.error("Invalid Security PIN");
      setPinModal(prev => ({ ...prev, value: "" }));
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Show all orders that are either paid or attempted Stripe payments
  const displayOrders = orders.filter(o =>
    o.payment_status === 'paid' ||
    ['cash', 'magnati'].includes(o.payment_provider) ||
    o.payment_provider === 'stripe' // Include pending stripe orders so admin can see them
  );

  const stats = {
    totalOrders: displayOrders.filter(o => o.payment_status === 'paid').length,
    totalTickets: displayOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.ticket_count || 0), 0),
    totalScanned: displayOrders.reduce((sum, o) => sum + (o.scanned_count || 0), 0),
    totalRevenue: displayOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total_amount || 0), 0),
  };

  const filteredOrders = displayOrders.filter(o => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (o.customer_name || "").toLowerCase().includes(search) ||
      (o.customer_email || "").toLowerCase().includes(search) ||
      (o.qr_code_id || "").toLowerCase().includes(search);

    const matchesPayment = paymentFilter === "all" || o.payment_provider === paymentFilter;

    return matchesSearch && matchesPayment;
  });

  const finalFilteredOrders = filteredOrders;

  const copyLink = async (type, link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(type);
      toast.success("Link copied!");
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleExportData = async () => {
    if (!selectedEventId) return;
    try {
      toast.info("Preparing itemized export...");
      const { orders, tickets } = await TicketingAPI.getRevenueStats(selectedEventId);

      if (!tickets?.length) {
        return toast.error("No itemized records found for this event.");
      }

      // 1. Flatten Data for Spreadsheet
      const exportData = (tickets || []).map(t => {
        const order = t.order || orders.find(o => o.id === t.order_id);
        const provider = order?.payment_provider?.toLowerCase() || 'unknown';
        const methodLabels = { 'cash': 'Cash', 'stripe': 'Online (Stripe)', 'magnati': 'Magnati' };

        return {
          'Order ID': order?.qr_code_id || 'N/A',
          'Purchase Date': order?.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          'Customer Name': order?.customer_name || 'N/A',
          'Customer Email': order?.customer_email || 'N/A',
          'Ticket Name': t.ticket_name || 'Spectator Pass',
          'Valid Date': t.valid_date || 'N/A',
          'Price (AED)': Number(t.price) || 0,
          'Payment Status': order?.payment_status?.toUpperCase() || 'PAID',
          'Payment Provider': methodLabels[provider] || provider,
          'Attendance': t.status === 'scanned' ? 'PRESENT' : 'PENDING',
          'Scanned At': t.scanned_at ? new Date(t.scanned_at).toLocaleString() : 'N/A'
        };
      });

      // 2. Create Sheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ticket Sales");

      // 3. Download
      const fileName = `ApexTicketing_${selectedEvent?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Export Complete!");
    } catch (err) {
      console.error("Export failure:", err);
      toast.error("Failed to generate export file.");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading Ticketing Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-main mb-2">Spectator Portal Management</h1>
          <p className="text-muted font-extralight">Manage event ticketing, track attendance, and monitor sales</p>
        </div>
      </div>

      {selectedEvent && (
        <>
          {/* Event Selector for Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-900/40 border border-slate-800 rounded-xl p-3 mt-4 w-fit">
            <span className="text-sm font-black uppercase tracking-widest text-muted pl-2">
              Select your Event:
            </span>
            <div className="bg-base border border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-inner">
              <Calendar className="w-5 h-5 text-primary-500 dark:text-primary-400 shrink-0" />
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-transparent border-none text-main font-bold focus:ring-0 cursor-pointer text-sm outline-none pr-8 truncate max-w-[300px] md:max-w-md w-full"
              >
                {events.map(e => (
                  <option key={e.id} value={e.id} className="bg-slate-900 text-white font-bold">
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Layout */}
          <Card className="border-border bg-base-alt">
            <div className="flex border-b border-border p-1 flex-wrap">
              {['overview', 'revenue', 'box office', 'orders', 'configuration', 'links'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'overview' || tab === 'orders') {
                      loadOrders(selectedEventId);
                    }
                  }}
                  className={`px-4 md:px-6 py-3 text-sm font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeTab === tab
                      ? "bg-primary-500/20 text-primary-600 dark:text-primary-400"
                      : "text-muted hover:text-main hover:bg-main/5"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <CardContent className="p-6">
              {activeTab === 'box office' && (
                <div className="space-y-6">
                  {/* Tab-Specific Stats for Box Office */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <StatCard 
                      label="Total Orders" 
                      value={stats.totalOrders} 
                      icon={Ticket} 
                      color="blue" 
                    />
                    <StatCard 
                      label="Total Tickets" 
                      value={stats.totalTickets} 
                      icon={Users} 
                      color="cyan" 
                    />
                    <StatCard 
                      label="Total Entered" 
                      value={stats.totalScanned} 
                      subValue={`${stats.totalTickets - stats.totalScanned} Pending`}
                      icon={Check} 
                      color="emerald" 
                    />
                  </div>

                  <BoxOfficeTab
                    eventId={selectedEventId}
                    eventSlug={selectedEvent.slug}
                    onSuccess={() => loadOrders(selectedEventId)}
                  />
                </div>
              )}

              {(activeTab === 'overview' || activeTab === 'orders') && (() => {
                // Effect-like behavior on tab switch to ensure fresh data
                // We'll just rely on the loadOrders call being triggered by state if needed,
                // but for now, the onSuccess handles the direct action.
                return null;
              })()}

              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-main">Event Performance</h3>
                    <Badge variant={selectedEvent.registrationOpen ? "success" : "warning"}>
                      {selectedEvent.registrationOpen ? "Sales Live" : "Sales Closed"}
                    </Badge>
                  </div>

                  <div className="bg-base-alt rounded-2xl p-8 border border-border flex flex-col items-center text-center">
                    <div className="w-32 h-32 rounded-full border-8 border-border flex items-center justify-center relative mb-6">
                      <div
                        className="absolute inset-0 rounded-full border-8 border-primary-500"
                        style={{
                          clipPath: `inset(0 0 ${100 - (stats.totalScanned / stats.totalTickets * 100 || 0)}% 0)`,
                          transition: 'clip-path 1s ease-out'
                        }}
                      />
                      <span className="text-2xl font-black text-main">
                        {Math.round(stats.totalScanned / stats.totalTickets * 100) || 0}%
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-main mb-2">Check-in Completion</h4>
                    <p className="text-muted max-w-sm">
                      {stats.totalScanned} out of {stats.totalTickets} spectators have successfully entered the venue.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="Search by name, email, or order ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="pl-10 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                      >
                        <option value="all">All Payments</option>
                        <option value="stripe">Online</option>
                        <option value="cash">Cash</option>
                        <option value="magnati">Card Payment</option>
                      </select>
                    </div>
                    <Button
                      variant="secondary"
                      icon={Download}
                      onClick={async () => {
                        const { data: pending, error } = await supabase
                          .from('spectator_orders')
                          .select('id, created_at, qr_code_id')
                          .eq('payment_status', 'pending');

                        if (error) return toast.error(error.message);

                        const stale = (pending || []).filter(o =>
                          new Date() - new Date(o.created_at) > 86400000
                        );

                        if (stale.length === 0) return toast.info("No stale orders to clean.");

                        const ids = stale.map(o => o.id);
                        await supabase
                          .from('spectator_orders')
                          .update({ payment_status: 'expired', fulfillment_status: 'none' })
                          .in('id', ids);

                        toast.success(`Cleaned ${stale.length} expired orders.`);
                        loadOrders(selectedEventId);
                      }}
                    >
                      Cleanup Expired
                    </Button>
                    <Button
                      variant="secondary"
                      className="group"
                      icon={RefreshCw}
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const icon = btn.querySelector('svg');
                        icon.classList.add('animate-spin');
                        try {
                          const res = await TicketingAPI.syncAllAttendance(selectedEventId);
                          toast.success(`Success! Synchronized ${res.count} attendance records.`);
                          loadOrders(selectedEventId);
                        } catch (err) {
                          toast.error("Bulk sync failed: " + err.message);
                        } finally {
                          icon.classList.remove('animate-spin');
                        }
                      }}
                    >
                      Sync All
                    </Button>
                    <Button variant="secondary" icon={FileSpreadsheet} onClick={handleExportData}>Export Excel</Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-muted border-b border-border">
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Selection</th>
                          <th className="px-4 py-3">Attendance</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {finalFilteredOrders.length > 0 ? finalFilteredOrders.map((order) => (
                          <tr key={order.id} className="group hover:bg-main/5 transition-colors">
                            <td className="px-4 py-4 min-w-[200px]">
                              <div className="font-bold text-main">{order.customer_name}</div>
                              <div className="text-xs text-muted">{order.customer_email}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-muted">
                              {/* Future: Join with ticket names. For now showing count */}
                              {order.ticket_count} Slots
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1 w-24">
                                <div className="text-[10px] font-black text-muted uppercase flex justify-between items-center group/sync">
                                  <span>{order.scanned_count} / {order.ticket_count}</span>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const btn = e.currentTarget;
                                      btn.classList.add('animate-spin');
                                      try {
                                        const res = await TicketingAPI.recalculateAttendance(order.id);
                                        alert(`DATABASE SYNC: Fetched ${res.scanned_count} scanned tickets from DB.`);
                                        loadOrders(selectedEventId);
                                      } catch (err) {
                                        console.error("Attendance Sync Error:", err);
                                        alert("DATABASE SYNC FAILED: " + err.message);
                                      } finally {
                                        btn.classList.remove('animate-spin');
                                      }
                                    }}
                                    className="p-1 text-primary-400 hover:text-white bg-primary-500/10 rounded-md transition-all"
                                    title="Repair Attendance Sync"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                  <span>{Math.round((order.scanned_count / (order.ticket_count || 1)) * 100)}%</span>
                                </div>
                                <div className="h-1.5 bg-base-alt rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${order.scanned_count === order.ticket_count ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                    style={{ width: `${(order.scanned_count / order.ticket_count) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`w-fit px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${order.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                  {order.payment_status === 'paid' ? 'Paid' : 'Payment Pending'}
                                </span>
                                <span className="text-[10px] font-bold text-muted uppercase tracking-tighter">
                                  {order.payment_provider === 'stripe' ? 'Online (Stripe)' :
                                    order.payment_provider === 'magnati' ? 'Card (Magnati)' : 'Cash / POS'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs font-mono text-muted italic">
                              {order.qr_code_id}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {order.payment_status === 'pending' && (
                                  <button
                                    onClick={async (e) => {
                                      const btn = e.currentTarget;
                                      btn.disabled = true;
                                      const originalContent = btn.innerHTML;
                                      btn.innerHTML = '<div class="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>';

                                      try {
                                        const res = await fetch(`${supabaseUrl}/functions/v1/verify-session`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'apikey': supabaseAnonKey
                                          },
                                          body: JSON.stringify({ orderId: order.qr_code_id })
                                        });
                                        const result = await res.json();

                                        if (result.success) {
                                          toast.success("Order synchronized and approved!");
                                          loadOrders(selectedEventId);
                                        } else {
                                          toast.error(result.error || "No successful payment found for this order on Stripe.");
                                        }
                                      } catch (err) {
                                        toast.error("Failed to reach verification service.");
                                      } finally {
                                        btn.disabled = false;
                                        btn.innerHTML = originalContent;
                                      }
                                    }}
                                    className="p-2 bg-primary-500/10 hover:bg-primary-500 text-primary-400 hover:text-white rounded-lg transition-all border border-primary-500/20"
                                    title="Sync with Stripe (Auto-Verify)"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                )}
                                {order.scanned_count > 0 && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await TicketingAPI.checkOutTicket(order.id, null, 'ADMIN_OVERRIDE');
                                        if (res) {
                                          toast.success("Manual Checkout recorded. Spectator can re-enter.");
                                          loadOrders(selectedEventId);
                                        }
                                      } catch (err) {
                                        toast.error(err.message);
                                      }
                                    }}
                                    className="p-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg transition-all border border-amber-500/20"
                                    title="Manual Checkout (Restore Access)"
                                  >
                                    <LogOut className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => window.open(`/view-ticket/${order.qr_code_id}`, '_blank')}
                                  className="p-2 bg-slate-800 rounded-lg hover:bg-primary-500 text-slate-400 hover:text-white transition-all"
                                  title="View Ticket"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="p-2 bg-slate-800 rounded-lg hover:bg-red-500 text-slate-400 hover:text-white transition-all"
                                  title="Delete Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="5" className="py-20 text-center text-slate-500">No orders found for this event.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'configuration' && (
                <TicketingManagement event={selectedEvent} />
              )}

              {activeTab === 'links' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <LinkShareCard
                    label="Public Spectator Portal"
                    link={`${window.location.origin}/tickets/${selectedEvent.slug}`}
                    type="portal"
                    copied={copiedLink === 'portal'}
                    onCopy={copyLink}
                    icon={Ticket}
                  />
                  <LinkShareCard
                    label="Entry Gate Scanner"
                    link={`${window.location.origin}/scanner?event_id=${selectedEvent.id}&mode=spectator`}
                    type="scanner"
                    copied={copiedLink === 'scanner'}
                    onCopy={copyLink}
                    icon={QrCode}
                  />
                  <LinkShareCard
                    label="Exit Gate Scanner (Checkout)"
                    link={`${window.location.origin}/scanner?event_id=${selectedEvent.id}&mode=spectator_exit`}
                    type="scanner_exit"
                    copied={copiedLink === 'scanner_exit'}
                    onCopy={copyLink}
                    icon={LogOut}
                  />
                </div>
              )}

              {activeTab === 'revenue' && (
                <RevenueTab 
                  key={selectedEventId}
                  eventId={selectedEventId} 
                  totalRevenue={stats.totalRevenue}
                  totalOrders={stats.totalOrders}
                  totalTickets={stats.totalTickets}
                  totalEntered={stats.totalScanned}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Security PIN Modal */}
      {pinModal.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-base border border-border rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative overflow-hidden text-center"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500" />

            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <Lock className="w-10 h-10 text-red-500" />
            </div>

            <h3 className="text-3xl font-black text-main mb-2 uppercase italic tracking-tighter">Security Required</h3>
            <p className="text-muted text-sm font-extralight mb-8">
              Please enter the master security PIN to authorize this permanent deletion.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-6">
              <div className="relative group">
                <input
                  type="password"
                  autoFocus
                  required
                  value={pinModal.value}
                  onChange={(e) => setPinModal(prev => ({ ...prev, value: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  className="w-full bg-base border-2 border-border rounded-2xl px-6 py-4 text-center text-4xl font-black tracking-[0.5em] text-main focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                  placeholder="••••"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 py-4 text-lg font-bold"
                  onClick={() => setPinModal({ open: false, orderId: null, value: "" })}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 py-4 text-lg font-black bg-red-500 hover:bg-red-600 uppercase tracking-widest"
                  loading={isVerifying}
                >
                  Confirm
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-border flex items-center justify-center gap-2 text-[10px] font-bold text-muted uppercase tracking-widest">
              <Shield className="w-3 h-3" />
              <span>Secure Administrative Action</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, subValue }) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20"
  };

  return (
    <Card className={`bg-base border border-border p-5 rounded-2xl relative overflow-hidden group hover:border-border transition-all duration-300`}>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">{label}</p>
          <div className="text-2xl font-black text-main">{value}</div>
          {subValue && (
            <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider opacity-80">
              {subValue}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
        <Icon size={100} />
      </div>
    </Card>
  );
}

function LinkShareCard({ label, link, type, copied, onCopy, icon: Icon }) {
  return (
    <div className="bg-base-alt border border-border rounded-3xl p-6 transition-all hover:border-border">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400">
          <Icon className="w-5 h-5" />
        </div>
        <h4 className="font-bold text-main uppercase tracking-wider text-sm">{label}</h4>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-base px-4 py-3 rounded-xl border border-border text-muted text-xs font-mono truncate select-all">
          {link}
        </div>
        <button
          onClick={() => onCopy(type, link)}
          className={`px-4 rounded-xl transition-all flex items-center justify-center ${copied ? "bg-emerald-500 text-white" : "bg-base-alt hover:bg-border text-muted hover:text-main"
            }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        <button
          onClick={() => window.open(link, '_blank')}
          className="px-4 rounded-xl bg-base-alt hover:bg-primary-500 text-muted hover:text-white transition-all flex items-center justify-center"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
