import React, { useCallback, useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Mainscr from './components/Mainscr';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [cart, setCart] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableNumber, setTableNumber] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appError, setAppError] = useState('');
  const [message, setMessage] = useState('');
  const [cartReady, setCartReady] = useState(false);
  const [categories, setCategories] = useState([]);
  const [gstRate, setGstRate] = useState(0);

  const loadWorkspace = useCallback(async (loggedInUser) => {
    const [tableList, menu, settings] = await Promise.all([
      api('/tables'),
      api('/menu'),
      api('/settings'),
    ]);
    const initialTable = tableList.find(table => table.ownedByMe)?.number || tableList.find(table => !table.occupied)?.number || 1;
    const session = await api(`/tables/${initialTable}/session`);

    setTables(tableList);
    setCategories(menu.categories || []);
    setGstRate(Number(settings.gstRate) || 0);
    setTableNumber(initialTable);
    setCart(session.cart || []);
    setCartReady(true);
    setUser(loggedInUser);
    setAppError('');
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('freshmart_token');
    if (!token) {
      setAuthChecking(false);
      return;
    }

    api('/auth/me')
      .then(({ user: currentUser }) => loadWorkspace(currentUser))
      .catch(() => {
        localStorage.removeItem('freshmart_token');
        setUser(null);
        setCart([]);
        setTables([]);
        setCartReady(false);
        setAppError('');
      })
      .finally(() => setAuthChecking(false));
  }, [loadWorkspace]);

  useEffect(() => {
    if (!user || !cartReady || isAdmin) return undefined;

    const timeout = setTimeout(() => {
      api(`/tables/${tableNumber}/session`, { method: 'PUT', body: JSON.stringify({ cart }) })
        .then(() => api('/tables').then(setTables))
        .catch(error => setAppError(error.message));
    }, 350);

    return () => clearTimeout(timeout);
  }, [cart, tableNumber, user, cartReady, isAdmin]);

  const handleLogin = async loggedInUser => {
    setAuthChecking(true);
    setAppError('');

    try {
      await loadWorkspace(loggedInUser);
    } catch {
      localStorage.removeItem('freshmart_token');
      setUser(null);
      setCart([]);
      setTables([]);
      setCartReady(false);
      throw new Error('Unable to load the shop. Please try again.');
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('freshmart_token');
    setUser(null);
    setCart([]);
    setTables([]);
    setCartReady(false);
    setIsAdmin(false);
    setAppError('');
    setMessage('');
  };

  const handleSelectTable = async nextTable => {
    if (nextTable === tableNumber) return;

    setAppError('');

    try {
      await api(`/tables/${tableNumber}/session`, { method: 'PUT', body: JSON.stringify({ cart }) });
      const session = await api(`/tables/${nextTable}/session`);

      setTableNumber(nextTable);
      setCart(session.cart || []);
      setCartReady(true);
      setTables(await api('/tables'));
    } catch (error) {
      setAppError(error.message);
      setTables(await api('/tables').catch(() => tables));
    }
  };

  const addItem = item => {
    const existing = cart.find(cartItem => cartItem.id === item.id);
    if (Number(item.stock) <= (existing?.quantity || 0)) {
      setAppError(`${item.name} has no more available stock.`);
      return;
    }
    setAppError('');
    setCart(current => existing
      ? current.map(cartItem => cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem)
      : [...current, { ...item, quantity: 1 }]);
  };

  const checkout = async ({ discount, paymentMethod }) => {
    setBusy(true);
    setAppError('');

    try {
      const result = await api('/sales', {
        method: 'POST',
        body: JSON.stringify({ cart, tableNumber, discount, paymentMethod }),
      });

      setCart([]);
      setCartReady(true);
      setMessage(`Bill ${result.billNumber} saved · ₹${result.total.toFixed(2)}`);
      setTables(await api('/tables'));
      return result;
    } finally {
      setBusy(false);
    }
  };

  if (authChecking) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-semibold text-white">Loading FreshMart…</div>;
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar
        user={user}
        tables={tables}
        tableNumber={tableNumber}
        onSelectTable={handleSelectTable}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        onAdmin={() => setIsAdmin(value => !value)}
      />
      {appError && (
        <div className="mx-4 mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-6">
          {appError}
          <button onClick={() => setAppError('')} className="float-right font-bold">✕</button>
        </div>
      )}
      {message && (
        <div className="mx-4 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 md:mx-6">
          {message}
          <button onClick={() => setMessage('')} className="float-right font-bold">✕</button>
        </div>
      )}
      {isAdmin && user.role === 'owner'
        ? <AdminPanel onCatalogChanged={async () => {
            const menu = await api('/menu');
            setCategories(menu.categories || []);
          }} />
        : <Mainscr ifos={categories} cart={cart} setCart={setCart} onSelectItem={addItem} onCheckout={checkout} tableNumber={tableNumber} busy={busy} gstRate={gstRate} />}
    </div>
  );
}
