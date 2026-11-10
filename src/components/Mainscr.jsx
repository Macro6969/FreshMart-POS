import React from 'react';
import RightComp from './RightComp';
import LeftComp from './LeftComp';

export default function Mainscr({ ifos, cart, setCart, onSelectItem, onCheckout, tableNumber, busy, gstRate }) {
  return <main className="grid grid-cols-1 items-start gap-5 p-4 lg:grid-cols-3 lg:p-6"><section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-2 lg:col-span-2"><LeftComp ifos={ifos} onSelectItem={onSelectItem} /></section><section className="min-w-0 lg:col-span-1"><RightComp cart={cart} setCart={setCart} onCheckout={onCheckout} tableNumber={tableNumber} busy={busy} gstRate={gstRate} /></section></main>;
}
