import React, { useState, useEffect, useMemo } from 'react';
import { TicketingAPI } from '../../lib/storage';
import { 
  DollarSign, 
  CreditCard, 
  Ticket, 
  TrendingUp, 
  Calendar, 
  Download,
  AlertCircle,
  Loader2,
  Filter
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

export default function RevenueTab({ 
  eventId, 
  totalRevenue = 0, 
  totalOrders = 0, 
  totalTickets = 0, 
  totalEntered = 0 
}) {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState({ orders: [], tickets: [] });
  const [filter, setFilter] = useState('all');
  const toast = useToast();

  useEffect(() => {
    fetchStats();

    // Live update channel
    const channel = supabase
      .channel(`revenue-live-${eventId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'spectator_orders',
          filter: `event_id=eq.${eventId}` 
      }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await TicketingAPI.getRevenueStats(eventId);
      setRawData(data || { orders: [], tickets: [] });
    } catch (err) {
      console.error('Failed to fetch revenue stats:', err);
      toast.show('Error', 'Failed to load revenue data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const orders = rawData.orders || [];
    const tickets = rawData.tickets || [];
    
    if (!orders.length) return { total: totalRevenue, count: totalTickets, cash: 0, card: 0, types: {} };

    // 1. Calculate Core Financials from Orders (100% accurate)
    const result = orders.reduce((acc, o) => {
      const amount = Number(o.total_amount || 0);
      acc.total += amount;
      acc.count += Number(o.ticket_count || 0);

      const method = o.payment_method?.toLowerCase() === 'cash' ? 'cash' : 'card';
      if (method === 'cash') acc.cash += amount;
      else acc.card += amount;

      return acc;
    }, { total: 0, count: 0, cash: 0, card: 0, types: {} });

    // 2. Calculate Breakdowns from Tickets (Itemized when available)
    const typeBreakdown = {};
    let itemizedTotal = 0;

    tickets.forEach(t => {
      let price = Number(t.price);
      let type = t.ticket_name;

      if (!price && t.status?.includes('|')) {
        try {
          const meta = JSON.parse(t.status.split('|')[1]);
          price = Number(meta.p || 0);
          if (!type) type = meta.n;
        } catch (e) {}
      }

      price = price || 0;
      type = type || 'Generic Pass';
      
      typeBreakdown[type] = (typeBreakdown[type] || 0) + price;
      itemizedTotal += price;
    });

    // 3. Handle Historical Discrepancy (Orders without tickets)
    const legacyDiff = result.total - itemizedTotal;
    if (legacyDiff > 0.01) {
      typeBreakdown['Historical Sales (Bundled)'] = (typeBreakdown['Historical Sales (Bundled)'] || 0) + legacyDiff;
    }

    result.types = typeBreakdown;
    
    // Safety check: Avoid showing 0 if we have a larger prop value (during loading or sync)
    result.total = Math.max(result.total, totalRevenue);
    result.count = Math.max(result.count, totalTickets);
    
    return result;
  }, [rawData, totalRevenue, totalTickets]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-cyan-500" />
        <p className="font-bold uppercase tracking-widest text-sm">Loading Financial Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Revenue Dashboard</h2>
          <p className="text-slate-500 text-sm">Financial overview for itemized spectator ticketing</p>
        </div>
        <button 
          onClick={() => toast.show('Export', 'CSV Export coming soon!', 'info')}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition-all border border-slate-700 text-sm font-bold uppercase tracking-wider"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Primary Stats Grid (Consolidated & Compact) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard 
          icon={<DollarSign className="text-emerald-400" />} 
          label="Total Revenue" 
          value={`${stats.total.toLocaleString()} AED`}
          subValue="Gross collections"
          color="emerald"
        />
        <StatCard 
          icon={<Ticket className="text-cyan-400" />} 
          label="Tickets Sold" 
          value={stats.count}
          subValue="Itemized entries"
          color="cyan"
        />
        <StatCard 
          icon={<TrendingUp className="text-amber-400" />} 
          label="Total Orders" 
          value={rawData.orders.length}
          subValue="Total transactions"
          color="amber"
        />
        <StatCard 
          icon={<Calendar className="text-primary-400" />} 
          label="Total Entered" 
          value={totalEntered}
          subValue={`${stats.count - totalEntered} Pending`}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Type Breakdown */}
        <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-500" />
            Revenue by Type
          </h3>
          <div className="space-y-4">
            {Object.entries(stats.types).sort((a, b) => b[1] - a[1]).map(([name, val]) => (
              <div key={name} className="group">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 font-bold uppercase tracking-wide">{name}</span>
                  <span className="text-white font-black">{val.toLocaleString()} AED</span>
                </div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-1000" 
                    style={{ width: `${(val / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-500" />
              Recent Sales (Actual Totals)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Order / Reference</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tickets</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Method</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Actual Sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(rawData.orders || []).slice(0, 20).map((o) => {
                  const provider = o.payment_provider?.toLowerCase();
                  const methodLabels = {
                    'cash': 'Cash',
                    'stripe': 'Online (Stripe)',
                    'magnati': 'Magnati'
                  };
                  const method = methodLabels[provider] || 'Unknown';
                  const isCash = provider === 'cash';
                  
                  return (
                    <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm uppercase">
                          {o.customer_name || 'Walk-in Customer'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {o.qr_code_id || o.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                          {o.ticket_count} {o.ticket_count === 1 ? 'Ticket' : 'Tickets'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isCash ? 'text-amber-400' : 'text-blue-400'}`}>
                          {isCash ? <DollarSign className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {method}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-400 text-sm">
                        {Number(o.total_amount).toLocaleString()} AED
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(rawData.orders?.length || 0) > 10 && (
            <div className="p-4 bg-slate-950/50 text-center border-t border-slate-800">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Showing last 10 of {rawData.orders.length} orders
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }) {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300`}>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</span>
          <span className="text-2xl font-black text-white tracking-tight leading-none">{value}</span>
          {subValue && (
            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider opacity-80">
              {subValue}
            </span>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          {React.cloneElement(icon, { className: 'w-6 h-6' })}
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
        {React.cloneElement(icon, { size: 100 })}
      </div>
    </div>
  );
}
