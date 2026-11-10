import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

export default function AdminPanel({ onCatalogChanged }) {
  const [days, setDays] = useState(7);
  const [analytics, setAnalytics] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [productForm, setProductForm] = useState({ name: "", category: "", price: "", stock: "0", reorderLevel: "5", description: "", image: "" });
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [employeeForm, setEmployeeForm] = useState({
    username: "",
    displayName: "",
    password: "",
  });

  const refresh = async () => {
    setError("");

    try {
      const [a, i, e, c] = await Promise.all([
        api(`/admin/analytics?days=${days}`),
        api("/admin/inventory"),
        api("/admin/employees"),
        api("/admin/categories"),
      ]);

      setAnalytics(a);
      setInventory(i);
      setEmployees(e);
      setCategories(c);
    } catch (err) {
      setError("Unable to complete the request. Please try again.");
    }
  };

  useEffect(() => {
    refresh();
  }, [days]);

  const saveInventory = async (item) => {
    try {
      await api(`/admin/inventory/${item.productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          stock: Number(item.stock),
          reorderLevel: Number(item.reorderLevel),
          price: Number(item.price),
        }),
      });

      setNotice(`${item.name} inventory updated.`);
      await refresh();
    } catch (err) {
      setError("Unable to complete the request. Please try again.");
    }
  };

  const addCategory = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      setCategoryName("");
      setNotice("Category added.");
      await refresh();
      await onCatalogChanged?.();
    } catch {
      setError("Unable to add the category. Check the name and try again.");
    }
  };

  const addProduct = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
          reorderLevel: Number(productForm.reorderLevel),
        }),
      });
      setProductForm({ name: "", category: "", price: "", stock: "0", reorderLevel: "5", description: "", image: "" });
      setNotice("Product added to the catalogue.");
      await refresh();
      await onCatalogChanged?.();
    } catch {
      setError("Unable to add the product. Check the details and try again.");
    }
  };

  const addEmployee = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      await api("/admin/employees", {
        method: "POST",
        body: JSON.stringify(employeeForm),
      });

      setEmployeeForm({
        username: "",
        displayName: "",
        password: "",
      });

      setNotice("Employee account created.");
      await refresh();
    } catch (err) {
      setError("Unable to complete the request. Please try again.");
    }
  };

  const toggleEmployee = async (employee) => {
    try {
      await api(`/admin/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          active: !employee.active,
        }),
      });

      await refresh();
    } catch (err) {
      setError("Unable to complete the request. Please try again.");
    }
  };

  const runForecast = async () => {
    setLoadingForecast(true);
    setForecast(null);
    setError("");

    try {
      const result = await api("/admin/forecast", {
        method: "POST",
        body: JSON.stringify({}),
      });

      setForecast(result);
    } catch (err) {
      setForecast({
        error: err.message,
      });
    } finally {
      setLoadingForecast(false);
    }
  };

  const predictions = forecast?.predictions || [];

  const reorderItems = predictions.filter((item) => item.suggested_restock > 0);

  const forecastDemand = predictions.reduce(
    (sum, item) => sum + Number(item.predicted_quantity || 0),
    0,
  );

  const lowStockItems = inventory.filter(
    (item) => item.stock <= item.reorderLevel,
  );

  const forecastCards = [
    {
      label: "Products covered",
      value: forecast ? forecast.total_products : "—",
      description: "Products included",
      icon: "📦",
    },
    {
      label: "Expected demand",
      value: forecast ? forecastDemand.toFixed(1) : "—",
      description: "Units expected next day",
      icon: "📈",
    },
    {
      label: "Products to reorder",
      value: forecast ? reorderItems.length : "—",
      description: "Based on 5-day stock coverage",
      icon: "🛒",
    },
    {
      label: "Suggested order",
      value: forecast
        ? reorderItems.reduce((sum, item) => sum + item.suggested_restock, 0)
        : "—",
      description: "Total units to purchase",
      icon: "🚚",
    },
  ];

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Owner workspace
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-900">
            Store overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor sales, stock and your team.
          </p>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Revenue",
            value: money(analytics?.summary?.revenue),
            hint: `Last ${days} days`,
            icon: "₹",
          },
          {
            label: "Bills completed",
            value: analytics?.summary?.bills ?? "—",
            hint: "Paid / recorded bills",
            icon: "▤",
          },
          {
            label: "Average bill",
            value: money(analytics?.summary?.averageBill),
            hint: "Average transaction value",
            icon: "↗",
          },
          {
            label: "Low stock items",
            value: lowStockItems.length,
            hint: "At or below inventory threshold",
            icon: "!",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">
                {card.label}
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-700">
                {card.icon}
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <h3 className="text-lg font-black text-slate-800">
              Sales performance
            </h3>
            <p className="text-xs text-slate-400">Revenue by day</p>
          </div>

          <div className="h-72">
            {analytics?.daily?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.daily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(value) => `₹${value}`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(value) => money(value)} />
                  <Bar dataKey="revenue" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No sales recorded for this period yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-800">
            Top-selling items
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            By units sold · selected period
          </p>

          {analytics?.topItems?.length ? (
            <div className="space-y-4">
              {analytics.topItems.map((item, index) => (
                <div key={item.productId}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-slate-700">
                      {index + 1}. {item.name}
                    </span>
                    <strong className="text-slate-900">{item.quantity}</strong>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.max(
                          4,
                          (item.quantity / analytics.topItems[0].quantity) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No item sales yet.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Stock planning
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              Demand forecast
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Predict product demand and calculate inventory requirements.
            </p>
          </div>

          <button
            onClick={runForecast}
            disabled={loadingForecast}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingForecast ? "Updating..." : "↻ Refresh forecast"}
          </button>
        </div>

        {!forecast && !loadingForecast && (
          <div className="mt-5 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center">
            <p className="text-3xl">📊</p>
            <h4 className="mt-2 font-bold text-slate-800">
              View stock forecast
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              View tomorrow's demand and suggested stock quantities.
            </p>
          </div>
        )}

        {loadingForecast && (
          <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center">
            <p className="font-semibold text-slate-700">
              Preparing forecast...
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Please wait while the latest figures are prepared.
            </p>
          </div>
        )}

        {forecast?.error && (
          <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            Unable to prepare the forecast. Please try again.
          </div>
        )}

        {forecast && !forecast.error && (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="font-bold text-slate-800">
                  {forecast.forecast_date}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                {forecast.total_products} products
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {forecastCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">
                      {card.label}
                    </p>
                    <span>{card.icon}</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">

              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">
                  Reorder recommendations
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {reorderItems.length > 0
                    ? `${reorderItems.length} products need replenishment.`
                    : "No products currently need replenishment based on this forecast."}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3">
                <h4 className="font-bold text-slate-800">
                  Demand forecast
                </h4>
                <p className="text-xs text-slate-400">
                  Predicted demand, current stock and suggested purchase
                  quantity.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Tomorrow's demand</th>
                      <th className="p-3">Current stock</th>
                      <th className="p-3">Reorder point</th>
                      <th className="p-3">Suggested order</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {predictions.map((item) => {
                      const needsReorder = item.suggested_restock > 0;

                      return (
                        <tr key={item.product_id}>
                          <td className="p-3 font-semibold text-slate-800">
                            {item.product_name}
                          </td>
                          <td className="p-3">
                            {item.predicted_quantity} units
                          </td>
                          <td className="p-3">{item.current_stock} units</td>
                          <td className="p-3">{item.reorder_point} units</td>
                          <td className="p-3 font-bold text-emerald-700">
                            {item.suggested_restock} units
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                needsReorder
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {needsReorder ? "REORDER" : "SUFFICIENT"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!predictions.length && (
                  <p className="p-6 text-center text-sm text-slate-400">
                    No forecast data available.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-black text-slate-800">
              Inventory management
            </h3>
            <p className="text-xs text-slate-400">
              Update on-hand quantities and reorder thresholds.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {inventory.length} products
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-3">Product</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">On hand</th>
                <th className="pb-3">Reorder at</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((item) => (
                <InventoryRow
                  key={item.productId}
                  item={item}
                  onSave={saveInventory}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-800">Shop catalogue</h3>
          <p className="mb-4 text-sm text-slate-500">Add the categories and products sold in this shop.</p>
          <form onSubmit={addCategory} className="flex gap-2">
            <input required minLength={2} maxLength={60} value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="New category name" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Add category</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => <span key={category.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{category.name}</span>)}
            {!categories.length && <span className="text-xs text-slate-400">No categories added yet.</span>}
          </div>
          <form onSubmit={addProduct} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input required minLength={2} maxLength={100} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <select required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="">Choose category</option>
              {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
            </select>
            <input required type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="Selling price (₹)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input required type="number" min="0" step="1" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="Opening stock" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input required type="number" min="0" step="1" value={productForm.reorderLevel} onChange={(e) => setProductForm({ ...productForm, reorderLevel: e.target.value })} placeholder="Reorder level" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} placeholder="Product image URL (optional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Short description (optional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:col-span-2" />
            <button disabled={!categories.length} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:col-span-2">Add product</button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-800">Employee accounts</h3>
          <p className="mb-4 text-xs text-slate-400">
            Create and deactivate cashier logins.
          </p>

          <form onSubmit={addEmployee} className="grid gap-3 sm:grid-cols-2">
            <input
              required
              minLength={3}
              placeholder="Username"
              value={employeeForm.username}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  username: e.target.value,
                })
              }
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />

            <input
              required
              placeholder="Employee name"
              value={employeeForm.displayName}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  displayName: e.target.value,
                })
              }
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />

            <input
              required
              minLength={8}
              type="password"
              placeholder="Temporary password (8+ chars)"
              value={employeeForm.password}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  password: e.target.value,
                })
              }
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:col-span-2"
            />

            <button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 sm:col-span-2">
              Create employee
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-black text-slate-800">
            Team access
          </h3>

          <div className="space-y-3">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {employee.displayName}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      @{employee.username}
                    </span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {employee.role}
                  </p>
                </div>

                {employee.role === "employee" ? (
                  <button
                    onClick={() => toggleEmployee(employee)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      employee.active
                        ? "bg-rose-50 text-rose-600"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {employee.active ? "Deactivate" : "Activate"}
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-700">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-black text-slate-800">Recent bills</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-3">Bill</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Employee</th>
                <th className="pb-3">Table</th>
                <th className="pb-3">Payment</th>
                <th className="pb-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analytics?.recentBills || []).map((bill) => (
                <tr key={bill.billNumber}>
                  <td className="py-3 font-bold text-slate-700">
                    {bill.billNumber}
                  </td>
                  <td className="py-3 text-slate-500">
                    {new Date(bill.createdAt + "Z").toLocaleString()}
                  </td>
                  <td className="py-3">{bill.employee}</td>
                  <td className="py-3">{bill.tableNumber}</td>
                  <td className="py-3">{bill.paymentMethod}</td>
                  <td className="py-3 text-right font-bold">
                    {money(bill.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!analytics?.recentBills?.length && (
            <p className="py-5 text-center text-sm text-slate-400">
              No bills saved yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function InventoryRow({ item, onSave }) {
  const [stock, setStock] = useState(String(item.stock));
  const [reorderLevel, setReorderLevel] = useState(String(item.reorderLevel));
  const [price, setPrice] = useState(String(item.price));

  useEffect(() => {
    setStock(String(item.stock));
    setReorderLevel(String(item.reorderLevel));
    setPrice(String(item.price));
  }, [item.stock, item.reorderLevel, item.price]);

  const low = item.stock <= item.reorderLevel;

  return (
    <tr>
      <td className="py-3 font-semibold text-slate-800">{item.name}</td>
      <td className="py-3 text-slate-500">{item.category}</td>
      <td className="py-3">
        <input
          aria-label={`${item.name} price`}
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
        />
      </td>
      <td className="py-3">
        <input
          aria-label={`${item.name} stock`}
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5"
        />
      </td>
      <td className="py-3">
        <input
          aria-label={`${item.name} reorder level`}
          type="number"
          min="0"
          value={reorderLevel}
          onChange={(e) => setReorderLevel(e.target.value)}
          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5"
        />
      </td>
      <td className="py-3">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
            low
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {low ? "LOW STOCK" : "IN STOCK"}
        </span>
      </td>
      <td className="py-3">
        <button
          onClick={() =>
            onSave({
              ...item,
              stock,
              reorderLevel,
              price,
            })
          }
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
