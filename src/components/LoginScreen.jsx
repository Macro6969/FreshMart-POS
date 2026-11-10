import React, { useState } from "react";

const LoginScreen = ({ employees = [], onLogin }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    employees[0]?.id || "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const employee = employees.find((item) => item.id === selectedEmployeeId);

    if (!employee) {
      setError("Select a valid employee account.");
      return;
    }

    if (employee.password !== password) {
      setError("Incorrect password. Please use the correct employee password.");
      return;
    }

    onLogin?.({
      id: employee.id,
      name: employee.name,
      role: employee.role,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/60">
        <div className="grid md:grid-cols-2">
          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 p-8 md:p-12 text-white flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-100">
                FreshMart POS
              </p>
              <h1 className="mt-5 text-4xl font-black tracking-tight">
                Store management
              </h1>
            </div>

            <div className="mt-8 space-y-4 text-sm text-sky-50/90">
              <p>• Live POS sales</p>
              <p>• Employee login and role tracking</p>
              <p>• Stock planning and replenishment</p>
              <p>• Stored digital bills and analytics</p>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-400">
                Employee login
              </p>
              <h2 className="mt-2 text-3xl font-bold text-white">
                Welcome back
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Employee
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) =>
                    setSelectedEmployeeId(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-sky-500"
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-sky-500"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white transition hover:bg-sky-400"
              >
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
