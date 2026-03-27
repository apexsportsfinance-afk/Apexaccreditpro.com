import React, { useState, useEffect } from "react";
import { Copy, Check, Ticket, User, CreditCard, Plus, Minus, DollarSign, Loader2 } from "lucide-react";
import Button from "../ui/Button";
import { TicketingAPI, EventsAPI } from "../../lib/storage";
import { useToast } from "../ui/Toast";
import * as QRCodeLib from "qrcode";
import { sendTicketEmail } from "../../lib/email";

export default function BoxOfficeTab({ eventId, eventSlug }) {
  const toast = useToast();
  const [ticketTypes, setTicketTypes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerData, setCustomerData] = useState({ name: "Walk-in Customer", email: "" });
  const [paymentMethod, setPaymentMethod] = useState("magnati"); // magnati | cash
  
  const [completedOrder, setCompletedOrder] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    if (eventId) loadTicketingData();
  }, [eventId]);

  const loadTicketingData = async () => {
    setLoading(true);
    try {
      const [types, pkgs, eData] = await Promise.all([
        TicketingAPI.getTypes(eventId),
        TicketingAPI.getPackages(eventId),
        EventsAPI.getById(eventId)
      ]);
      setTicketTypes(types.filter(t => t.isActive));
      setPackages(pkgs.filter(p => p.isActive));
      setEventData(eData);
    } catch (err) {
      toast.error("Failed to load ticketing inventory");
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const totalAmount = [...ticketTypes, ...packages].reduce((sum, item) => {
    const qty = cart[item.id] || 0;
    return sum + (Number(item.price) * qty);
  }, 0);

  const totalTickets = [...ticketTypes, ...packages].reduce((sum, item) => {
    const qty = cart[item.id] || 0;
    return sum + (qty * (item.quantityIncluded || 1));
  }, 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (totalTickets === 0) {
      toast.error("Cart is empty!");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        eventId,
        customerName: customerData.name || "Walk-in Customer",
        customerEmail: customerData.email || "no-reply@apex-sports.local",
        totalAmount,
        ticketCount: totalTickets,
        selectedDates: [], // Box office usually defaults to today/full event
        paymentProvider: paymentMethod,
        paymentStatus: 'paid'
      };

      const order = await TicketingAPI.createOrder(orderData);
      
      const qrUrl = await QRCodeLib.toDataURL(order.qr_code_id, {
        width: 300,
        margin: 2,
        color: { dark: '#0e7490', light: '#ffffff' }
      });
      
      setQrCodeUrl(qrUrl);
      setCompletedOrder(order);
      setCart({});
      toast.success("Box Office Sale Complete!");

      // Try sending the email silently if an email was provided
      if (orderData.customerEmail && orderData.customerEmail !== "no-reply@apex-sports.local") {
        sendTicketEmail({
          to: orderData.customerEmail,
          name: orderData.customerName,
          eventName: eventData?.name || "Event",
          ticketCount: totalTickets,
          amountPaid: totalAmount,
          paymentMethod: paymentMethod === 'cash' ? 'Cash' : 'Magnati POS',
          eventData: eventData, // Crucial for visual PDF
          qrCodeDataUrl: qrUrl,
          qrCodeId: order.qr_code_id
        }).catch(e => console.error("Ticket email error:", e));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to process local sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCart = () => {
    setCompletedOrder(null);
    setQrCodeUrl("");
    setCart({});
    setCustomerData({ name: "Walk-in Customer", email: "" });
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;

  if (completedOrder) {
    return (
      <div className="max-w-xl mx-auto space-y-6 text-center py-8">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl">
          <Check className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Sale Confirmed</h2>
          <p className="text-emerald-400 font-bold mb-6">Payment collected via {paymentMethod === 'cash' ? 'Cash' : 'Magnati POS'}</p>
          
          <div className="bg-white p-6 rounded-xl inline-block shadow-xl mb-6">
            <img src={qrCodeUrl} alt="Ticket QR" className="w-48 h-48 mx-auto" />
            <p className="font-mono text-slate-800 text-sm mt-3">{completedOrder.qr_code_id}</p>
          </div>
          
          <div className="flex justify-between items-center text-left text-sm text-slate-300 bg-slate-900 rounded-xl p-4 mb-8 border border-slate-800">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Customer</p>
              <p className="font-bold text-white">{completedOrder.customer_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-500">Total Paid</p>
              <p className="font-bold text-emerald-400 text-lg">{completedOrder.total_amount} AED</p>
            </div>
          </div>

          <Button onClick={resetCart} className="w-full" size="lg">
            Start New Sale
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Products Column */}
      <div className="lg:col-span-7 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Ticket className="w-5 h-5 text-cyan-500" />
            Select Tickets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...ticketTypes, ...packages].map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} className={`p-4 rounded-xl border transition-all ${qty > 0 ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <p className="text-cyan-400 font-black text-lg">{item.price} <span className="text-[10px] text-slate-500">AED</span></p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 rounded-lg p-1 border border-slate-800">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-2 text-slate-400 hover:text-white"><Minus className="w-4 h-4"/></button>
                    <span className="font-black text-white w-8 text-center">{qty}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-2 text-cyan-400 hover:text-cyan-300"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Checkout Column */}
      <div className="lg:col-span-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-6">
          <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">Cart Summary</h3>
          
          <form onSubmit={handleCheckout} className="space-y-6">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={customerData.name}
                    onChange={e => setCustomerData(prev => ({...prev, name: e.target.value}))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Email (Optional)</label>
                <input
                  type="email"
                  value={customerData.email}
                  onChange={e => setCustomerData(prev => ({...prev, email: e.target.value}))}
                  placeholder="For email receipt"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Payment Method Completed</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('magnati')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'magnati' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase">Magnati POS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  <DollarSign className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase">Cash</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Total to Collect</p>
                <p className="text-3xl font-black text-white">{totalAmount} <span className="text-sm text-slate-400">AED</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Tickets</p>
                <p className="text-xl font-bold text-slate-300">{totalTickets}</p>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-4 uppercase tracking-widest font-black"
              loading={isSubmitting}
              disabled={totalTickets === 0}
              variant={paymentMethod === 'cash' ? 'primary' : 'primary'} // Just keeping it generic
            >
              Confirm Sale & Generate Ticket
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
