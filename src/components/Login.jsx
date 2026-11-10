import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      localStorage.setItem('freshmart_token', result.token);
      await onLogin(result.user);
    } catch (err) { setError(err.message || "Unable to sign in. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-emerald-600 px-8 py-9 text-white">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl">F</div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">FreshMart POS</p>
          <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
          <p className="mt-2 text-emerald-50">Sign in with your shop account to continue.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 p-8">
          <div><label className="mb-2 block text-sm font-semibold text-slate-700">Username</label><input required autoFocus value={username} onChange={e => setUsername(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50" placeholder="Enter username" /></div>
          <div><label className="mb-2 block text-sm font-semibold text-slate-700">Password</label><input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50" placeholder="Enter password" /></div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'}</button>
          <p className="text-center text-xs text-slate-400">Authorized employees only · FreshMart Management</p>
        </form>
      </div>
    </main>
  );
}
