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
  ArrowRight,
  TrendingUp,
  Clock,
  Filter,
  QrCode
} from "lucide-react";
import { motion } from "framer-motion";
import { EventsAPI, TicketingAPI } from "../../lib/storage";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import TicketingManagement from "../../components/admin/TicketingManagement";
import BoxOfficeTab from "../../components/admin/BoxOfficeTab";

export default function Ticketing() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedLink, setCopiedLink] = useState(null);
  const toast = useToast();

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadOrders(selectedEventId);
    }
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const data = await EventsAPI.getAll();
      setEvents(data);
      if (data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } catch (err) {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (eventId) => {
    try {
      const data = await TicketingAPI.getOrders(eventId);
      setOrders(data);
    } catch (err) {
      toast.error("Failed to load orders");
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const stats = {
    totalOrders: orders.length,
    totalTickets: orders.reduce((sum, o) => sum + (o.ticket_count || 0), 0),
    totalScanned: orders.reduce((sum, o) => sum + (o.scanned_count || 0), 0),
    totalRevenue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
  };

  const filteredOrders = orders.filter(o => 
    o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.qr_code_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (loading) return <div className="p-8 text-center text-slate-400">Loading Ticketing Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Spectator Portal Management</h1>
          <p className="text-slate-400 font-extralight">Manage event ticketing, track attendance, and monitor sales</p>
        </div>
      </div>

      {selectedEvent && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Orders" value={stats.totalOrders} icon={Ticket} color="blue" />
            <StatCard label="Total Tickets" value={stats.totalTickets} icon={Users} color="cyan" />
            <StatCard label="Total Entered" value={stats.totalScanned} icon={Check} color="emerald" subValue={`${stats.totalTickets - stats.totalScanned} Pending`} />
            <StatCard label="Total Revenue" value={`${stats.totalRevenue.toLocaleString()} AED`} icon={TrendingUp} color="amber" />
          </div>

          {/* Event Selector for Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-900/40 border border-slate-800 rounded-xl p-3 mt-4 w-fit">
            <span className="text-sm font-black uppercase tracking-widest text-slate-400 pl-2">
              Select your Event:
            </span>
            <div className="bg-slate-950 border border-slate-700/50 rounded-lg px-4 py-2 flex items-center gap-3 shadow-inner">
              <Calendar className="w-5 h-5 text-primary-400 shrink-0" />
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-transparent border-none text-white font-bold focus:ring-0 cursor-pointer text-sm outline-none pr-8 truncate max-w-[300px] md:max-w-md w-full"
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
          <Card className="border-slate-800 bg-slate-950/40">
            <div className="flex border-b border-slate-800 p-1 flex-wrap">
              {['overview', 'box office', 'orders', 'configuration', 'links'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 md:px-6 py-3 text-sm font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                    activeTab === tab 
                      ? "bg-primary-500/20 text-primary-400" 
                      : "text-slate-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <CardContent className="p-6">
              {activeTab === 'box office' && (
                <BoxOfficeTab eventId={selectedEventId} eventSlug={selectedEvent.slug} />
              )}
              
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-xl font-bold text-white">Event Performance</h3>
                     <Badge variant={selectedEvent.registrationOpen ? "success" : "warning"}>
                       {selectedEvent.registrationOpen ? "Sales Live" : "Sales Closed"}
                     </Badge>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800/50 flex flex-col items-center text-center">
                    <div className="w-32 h-32 rounded-full border-8 border-slate-800 flex items-center justify-center relative mb-6">
                       <div 
                         className="absolute inset-0 rounded-full border-8 border-primary-500" 
                         style={{ 
                           clipPath: `inset(0 0 ${100 - (stats.totalScanned / stats.totalTickets * 100 || 0)}% 0)`,
                           transition: 'clip-path 1s ease-out'
                         }} 
                       />
                       <span className="text-2xl font-black text-white">
                         {Math.round(stats.totalScanned / stats.totalTickets * 100) || 0}%
                       </span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Check-in Completion</h4>
                    <p className="text-slate-400 max-w-sm">
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
                    <Button variant="secondary" icon={Download}>Export CSV</Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Selection</th>
                          <th className="px-4 py-3">Attendance</th>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                          <tr key={order.id} className="group hover:bg-white/5 transition-colors">
                            <td className="px-4 py-4 min-w-[200px]">
                              <div className="font-bold text-white">{order.customer_name}</div>
                              <div className="text-xs text-slate-500">{order.customer_email}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-300">
                              {/* Future: Join with ticket names. For now showing count */}
                              {order.ticket_count} Slots
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1 w-24">
                                <div className="text-[10px] font-black text-slate-500 uppercase flex justify-between">
                                  <span>{order.scanned_count} / {order.ticket_count}</span>
                                  <span>{Math.round((order.scanned_count / order.ticket_count) * 100)}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${order.scanned_count === order.ticket_count ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                    style={{ width: `${(order.scanned_count / order.ticket_count) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs font-mono text-slate-500 italic">
                              {order.qr_code_id}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button 
                                onClick={() => window.open(`/view-ticket/${order.qr_code_id}`, '_blank')}
                                className="p-2 bg-slate-800 rounded-lg hover:bg-primary-500 text-slate-400 hover:text-white transition-all"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
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
                    label="Staff Scanner Link" 
                    link={`${window.location.origin}/scanner?event_id=${selectedEvent.id}&mode=spectator`} 
                    type="scanner" 
                    copied={copiedLink === 'scanner'} 
                    onCopy={copyLink} 
                    icon={QrCode}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, subValue }) {
  const colors = {
    blue: "from-blue-500/10 to-blue-600/10 text-blue-400 border-blue-500/20",
    cyan: "from-cyan-500/10 to-cyan-600/10 text-cyan-400 border-cyan-500/20",
    emerald: "from-emerald-500/10 to-emerald-600/10 text-emerald-400 border-emerald-500/20",
    amber: "from-amber-500/10 to-amber-600/10 text-amber-400 border-amber-500/20"
  };

  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border-2`}>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
          <div className="text-2xl font-black text-white">{value}</div>
          {subValue && <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{subValue}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function LinkShareCard({ label, link, type, copied, onCopy, icon: Icon }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 transition-all hover:border-slate-700">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400">
          <Icon className="w-5 h-5" />
        </div>
        <h4 className="font-bold text-white uppercase tracking-wider text-sm">{label}</h4>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 text-slate-400 text-xs font-mono truncate select-all">
          {link}
        </div>
        <button 
          onClick={() => onCopy(type, link)}
          className={`px-4 rounded-xl transition-all flex items-center justify-center ${
            copied ? "bg-emerald-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-400"
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        <button 
          onClick={() => window.open(link, '_blank')}
          className="px-4 rounded-xl bg-slate-800 hover:bg-primary-500 text-slate-400 hover:text-white transition-all flex items-center justify-center"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
