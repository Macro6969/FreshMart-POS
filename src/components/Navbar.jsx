import React, { useEffect, useState } from 'react';

export default function Navbar({ user, tables, tableNumber, onSelectTable, onLogout, onAdmin, isAdmin }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return (
    <nav className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white">F</div><div><h1 className="text-lg font-black tracking-tight text-slate-900">FreshMart <span className="font-medium text-emerald-600">POS</span></h1><p className="text-[11px] text-slate-400">Smart store management</p></div></div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-right"><p className="text-sm font-bold tabular-nums text-slate-800">{now.toLocaleTimeString()}</p><p className="text-[10px] text-slate-400">{now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
        {!isAdmin && <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><span className="text-slate-500">Table</span><select value={tableNumber} onChange={e => onSelectTable(Number(e.target.value))} className="max-w-32 bg-transparent font-bold text-slate-800 outline-none">{tables.map(t => <option key={t.number} value={t.number} disabled={t.occupied && !t.ownedByMe && t.number !== tableNumber && user.role !== 'owner'}>Table {String(t.number).padStart(2, '0')}{t.occupied && t.number !== tableNumber ? ' · In use' : ''}</option>)}</select></label>}
        <div className="hidden text-right sm:block"><p className="text-sm font-bold text-slate-800">{user.displayName}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">{user.role}</p></div>
        {user.role === 'owner' && <button onClick={onAdmin} className={`rounded-xl px-3 py-2 text-sm font-semibold ${isAdmin ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{isAdmin ? '← POS' : 'Owner panel'}</button>}
        <button onClick={onLogout} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Log out</button>
      </div>
    </nav>
  );
}
