import React, { useMemo, useState } from 'react';

export default function RightComp({ cart = [], setCart, onCheckout, tableNumber, busy, gstRate = 0 }) {
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashReceived, setCashReceived] = useState('');
  const [error, setError] = useState('');
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [cart]);
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const gst = ((subtotal - discountAmount) * gstRate) / 100;
  const total = subtotal - discountAmount + gst;
  const received = Number(cashReceived) || 0;
  const change = Math.max(received - total, 0);

  const updateQty = (id, delta) => setCart(current => current.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0));
  const removeItem = id => setCart(current => current.filter(item => item.id !== id));
  const submit = async () => {
    setError('');
    if (!cart.length) return;
    if (paymentMethod === 'Cash' && received < total) { setError('Cash received is less than the bill total.'); return; }
    try {
      await onCheckout({ discount: discountAmount, paymentMethod });
      setDiscount('0'); setCashReceived(''); setPaymentMethod('Cash');
    } catch (err) { setError("Unable to save the bill. Please try again."); }
  };

  return (
    <aside className="flex h-full min-h-[620px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-xl font-black text-slate-800">Current bill</h2><p className="mt-1 text-xs text-slate-400">Table {String(tableNumber).padStart(2, '0')} · {cart.reduce((sum, item) => sum + item.quantity, 0)} items</p></div><button onClick={() => setCart([])} disabled={!cart.length || busy} className="text-sm font-semibold text-rose-500 hover:text-rose-700 disabled:opacity-30">Clear all</button></div>
      <div className="max-h-[420px] min-h-48 flex-1 space-y-3 overflow-y-auto p-4">
        {!cart.length ? <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><div className="mb-3 text-5xl">🛒</div><p className="font-bold text-slate-600">Your cart is empty</p><p className="mt-1 text-sm text-slate-400">Select products to start a bill.</p></div> : cart.map(item => <div key={item.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">{item.image ? <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-50 font-semibold text-emerald-700">{item.name.slice(0, 1).toUpperCase()}</div>}<div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{item.name}</p><p className="text-xs text-slate-400">₹{Number(item.price).toFixed(2)} each</p></div><button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500">✕</button></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => updateQty(item.id, -1)} className="h-7 w-7 rounded-lg border border-slate-200 bg-white font-bold">−</button><span className="w-4 text-center text-sm font-bold">{item.quantity}</span><button onClick={() => updateQty(item.id, 1)} disabled={item.quantity >= Number(item.stock)} className="h-7 w-7 rounded-lg border border-slate-200 bg-white font-bold disabled:cursor-not-allowed disabled:opacity-40">+</button></div><span className="text-sm font-extrabold text-slate-800">₹{(item.price * item.quantity).toFixed(2)}</span></div></div></div>)}
      </div>
      <div className="space-y-3 border-t border-slate-100 p-5">
        <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
        <div className="flex items-center justify-between text-sm"><label htmlFor="discount" className="text-slate-500">Discount (₹)</label><input id="discount" type="number" min="0" max={subtotal} value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none focus:border-emerald-500" /></div>
        <div className="flex justify-between text-sm text-slate-500"><span>GST ({gstRate}%)</span><span>₹{gst.toFixed(2)}</span></div>
        <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3"><span className="font-bold text-slate-800">Grand total</span><span className="text-2xl font-black text-emerald-600">₹{total.toFixed(2)}</span></div>
      </div>
      <div className="space-y-3 p-5 pt-0">
        <p className="text-sm font-bold text-slate-800">Payment method</p>
        <div className="grid grid-cols-2 gap-2">
          {['Cash', 'UPI', 'Card', 'Split'].map(method => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`rounded-xl border py-2.5 text-sm font-semibold ${
                paymentMethod === method ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {method}
            </button>
          ))}
        </div>

        {paymentMethod === 'Cash' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cash received (₹)</label>
            <input
              type="number"
              min="0"
              value={cashReceived}
              onChange={e => setCashReceived(e.target.value)}
              placeholder="Enter amount received"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
            />
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-slate-500">Change due</span>
              <strong className="text-emerald-600">₹{change.toFixed(2)}</strong>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button
          onClick={submit}
          disabled={!cart.length || busy}
          className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? 'Saving bill…' : `Save bill · ₹${total.toFixed(2)}`}
        </button>
      </div>
    </aside>
  );
}
