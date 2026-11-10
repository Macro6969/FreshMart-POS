import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "freshmart.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','employee')), active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0, reorder_level INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bill_number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id), employee_name TEXT NOT NULL,
  table_number INTEGER NOT NULL, subtotal REAL NOT NULL, discount REAL NOT NULL,
  gst REAL NOT NULL, total REAL NOT NULL, payment_method TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL, line_total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS table_sessions (
  table_number INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  employee_name TEXT NOT NULL, cart_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const inventoryColumns = db.prepare("PRAGMA table_info(inventory)").all().map((column) => column.name);
if (!inventoryColumns.includes("description")) db.exec("ALTER TABLE inventory ADD COLUMN description TEXT NOT NULL DEFAULT ''");
if (!inventoryColumns.includes("image")) db.exec("ALTER TABLE inventory ADD COLUMN image TEXT NOT NULL DEFAULT ''");
db.exec("INSERT OR IGNORE INTO categories (name) SELECT DISTINCT category FROM inventory WHERE TRIM(category) <> ''");

const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
if (!userCount) {
  if (!process.env.OWNER_USERNAME || !process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD.length < 12) {
    throw new Error("Set OWNER_USERNAME and an OWNER_PASSWORD of at least 12 characters in server/.env before first startup.");
  }
  const hash = bcrypt.hashSync(process.env.OWNER_PASSWORD, 12);
  db.prepare(
    "INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)",
  ).run(process.env.OWNER_USERNAME.trim(), process.env.OWNER_NAME || "Shop Owner", hash, "owner");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes("replace")) {
  throw new Error("Set a unique JWT_SECRET of at least 32 characters in server/.env.");
}

const configuredTableCount = Number(process.env.TABLE_COUNT ?? 12);
const configuredGstRate = Number(process.env.GST_RATE ?? 0);
const tableCount = Number.isInteger(configuredTableCount) ? Math.max(1, Math.min(configuredTableCount, 100)) : 12;
const gstRate = Number.isFinite(configuredGstRate) ? Math.max(0, Math.min(configuredGstRate, 100)) : 0;

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));
const JWT_SECRET = process.env.JWT_SECRET;
const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    },
    JWT_SECRET,
    { expiresIn: "12h" },
  );
const auth = (req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    if (!token) throw new Error("Missing token");
    const payload = jwt.verify(token, JWT_SECRET);
    const current = db
      .prepare(
        "SELECT id, username, display_name, role, active FROM users WHERE id = ?",
      )
      .get(payload.id);
    if (!current || !current.active) throw new Error("Account disabled");
    req.user = {
      id: current.id,
      username: current.username,
      displayName: current.display_name,
      role: current.role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Please log in again." });
  }
};
const ownerOnly = (req, res, next) =>
  req.user?.role === "owner"
    ? next()
    : res.status(403).json({ error: "Owner access required." });
const safeUser = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.display_name,
  role: user.role,
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, app: "FreshMart API" }),
);
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND active = 1")
    .get(String(username || "").trim());
  if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash))
    return res.status(401).json({ error: "Incorrect username or password." });
  res.json({ token: signToken(user), user: safeUser(user) });
});
app.get("/api/auth/me", auth, (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE id = ? AND active = 1")
    .get(req.user.id);
  if (!user) return res.status(401).json({ error: "Account is unavailable." });
  res.json({ user: safeUser(user) });
});
app.get("/api/settings", auth, (_req, res) => res.json({ gstRate, tableCount }));

app.get("/api/menu", auth, (_req, res) => {
  const products = db.prepare("SELECT product_id AS id, name, category, price, description, image, stock FROM inventory ORDER BY category, name").all();
  const categories = db.prepare("SELECT id, name FROM categories ORDER BY name").all();
  const grouped = new Map(categories.map((category) => [category.name, { ...category, items: [] }]));
  for (const product of products) {
    if (!grouped.has(product.category)) grouped.set(product.category, { id: null, name: product.category, items: [] });
    grouped.get(product.category).items.push(product);
  }
  res.json({ categories: [...grouped.values()] });
});

app.get("/api/tables", auth, (req, res) => {
  const sessions = db
    .prepare(
      "SELECT table_number, user_id, employee_name, cart_json, updated_at FROM table_sessions",
    )
    .all();
  const byTable = new Map(sessions.map((s) => [s.table_number, s]));
  res.json(
    Array.from({ length: tableCount }, (_, i) => {
      const number = i + 1;
      const session = byTable.get(number);
      let cart = [];
      try {
        cart = session ? JSON.parse(session.cart_json) : [];
      } catch {
        cart = [];
      }
      return {
        number,
        occupied: Boolean(session && cart.length),
        ownedByMe: Boolean(session && session.user_id === req.user.id),
        employeeName: session?.employee_name || null,
        itemCount: cart.reduce(
          (n, item) => n + (Number(item.quantity) || 0),
          0,
        ),
      };
    }),
  );
});
app.get("/api/tables/:number/session", auth, (req, res) => {
  const number = Number(req.params.number);
  if (!Number.isInteger(number) || number < 1 || number > tableCount)
    return res.status(400).json({ error: "Invalid table." });
  const session = db
    .prepare("SELECT * FROM table_sessions WHERE table_number = ?")
    .get(number);
  if (session && session.user_id !== req.user.id && req.user.role !== "owner")
    return res
      .status(409)
      .json({
        error: `Table ${number} is currently in use by ${session.employee_name}.`,
      });
  res.json({ cart: session ? JSON.parse(session.cart_json) : [] });
});
app.put("/api/tables/:number/session", auth, (req, res) => {
  const number = Number(req.params.number);
  const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
  if (!Number.isInteger(number) || number < 1 || number > tableCount)
    return res.status(400).json({ error: "Invalid table." });
  const existing = db
    .prepare("SELECT * FROM table_sessions WHERE table_number = ?")
    .get(number);
  if (existing && existing.user_id !== req.user.id && req.user.role !== "owner")
    return res
      .status(409)
      .json({
        error: `Table ${number} is currently in use by ${existing.employee_name}.`,
      });
  if (!cart.length)
    db.prepare(
      "DELETE FROM table_sessions WHERE table_number = ? AND user_id = ?",
    ).run(number, req.user.id);
  else
    db.prepare(
      `INSERT INTO table_sessions (table_number, user_id, employee_name, cart_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(table_number) DO UPDATE SET user_id=excluded.user_id,
    employee_name=excluded.employee_name, cart_json=excluded.cart_json, updated_at=CURRENT_TIMESTAMP`,
    ).run(number, req.user.id, req.user.displayName, JSON.stringify(cart));
  res.json({ ok: true });
});

app.post("/api/sales", auth, (req, res) => {
  const {
    cart,
    tableNumber,
    discount = 0,
    paymentMethod = "Cash",
  } = req.body || {};
  if (!Array.isArray(cart) || !cart.length)
    return res.status(400).json({ error: "The bill is empty." });
  const table = Number(tableNumber);
  if (!Number.isInteger(table) || table < 1 || table > tableCount)
    return res.status(400).json({ error: "Select a valid table." });
  if (!["Cash", "UPI", "Card", "Split"].includes(paymentMethod))
    return res.status(400).json({ error: "Invalid payment method." });
  const tableSession = db
    .prepare("SELECT user_id FROM table_sessions WHERE table_number = ?")
    .get(table);
  if (
    tableSession &&
    tableSession.user_id !== req.user.id &&
    req.user.role !== "owner"
  )
    return res
      .status(409)
      .json({ error: "This table belongs to another employee." });
  const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, 1e7));
  const lookup = db.prepare(
    "SELECT product_id, name, price, stock FROM inventory WHERE product_id = ?",
  );
  const quantities = new Map();
  for (const item of cart) {
    const productId = Number(item.id);
    const quantity = Number(item.quantity);
    if (
      !Number.isInteger(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    )
      return res
        .status(400)
        .json({ error: "A product or quantity in this bill is invalid." });
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  const lines = [];
  for (const [productId, quantity] of quantities) {
    const product = lookup.get(productId);
    if (!product)
      return res
        .status(400)
        .json({ error: "A product in this bill does not exist." });
    if (product.stock < quantity)
      return res
        .status(409)
        .json({
          error: `Not enough stock for ${product.name}. Available: ${product.stock}.`,
        });
    lines.push({ ...product, quantity, lineTotal: product.price * quantity });
  }
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Math.min(safeDiscount, subtotal);
  const taxable = subtotal - discountAmount;
  const gst = taxable * (gstRate / 100);
  const total = taxable + gst;
  const billNumber = `FM-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const transaction = db.transaction(() => {
    const sale = db
      .prepare(
        `INSERT INTO sales (bill_number, user_id, employee_name, table_number, subtotal, discount, gst, total, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        billNumber,
        req.user.id,
        req.user.displayName,
        table,
        subtotal,
        discountAmount,
        gst,
        total,
        paymentMethod,
      );
    const insertLine = db.prepare(
      "INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const reduceStock = db.prepare(
      "UPDATE inventory SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?",
    );
    for (const item of lines) {
      insertLine.run(
        sale.lastInsertRowid,
        item.product_id,
        item.name,
        item.quantity,
        item.price,
        item.lineTotal,
      );
      reduceStock.run(item.quantity, item.product_id);
    }
    db.prepare("DELETE FROM table_sessions WHERE table_number = ?").run(table);
    return sale.lastInsertRowid;
  });
  const saleId = transaction();
  res
    .status(201)
    .json({
      ok: true,
      saleId,
      billNumber,
      subtotal,
      discount: discountAmount,
      gst,
      total,
      createdAt: new Date().toISOString(),
    });
});

app.get("/api/admin/analytics", auth, ownerOnly, (req, res) => {
  const days = Math.max(1, Math.min(Number(req.query.days) || 7, 90));
  const summary = db
    .prepare(
      `SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS revenue,
    COALESCE(AVG(total),0) AS averageBill FROM sales WHERE datetime(created_at) >= datetime('now', ?)`,
    )
    .get(`-${days} days`);
  const daily = db
    .prepare(
      `SELECT date(created_at) AS date, ROUND(SUM(total),2) AS revenue, COUNT(*) AS bills
    FROM sales WHERE datetime(created_at) >= datetime('now', ?) GROUP BY date(created_at) ORDER BY date`,
    )
    .all(`-${days} days`);
  const topItems = db
    .prepare(
      `SELECT si.product_id AS productId, si.name, SUM(si.quantity) AS quantity, ROUND(SUM(si.line_total),2) AS revenue
    FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE datetime(s.created_at) >= datetime('now', ?)
    GROUP BY si.product_id, si.name ORDER BY quantity DESC LIMIT 8`,
    )
    .all(`-${days} days`);
  const recentBills = db
    .prepare(
      "SELECT bill_number AS billNumber, employee_name AS employee, table_number AS tableNumber, total, payment_method AS paymentMethod, created_at AS createdAt FROM sales ORDER BY id DESC LIMIT 8",
    )
    .all();
  res.json({ days, summary, daily, topItems, recentBills });
});
app.get("/api/admin/categories", auth, ownerOnly, (_req, res) =>
  res.json(db.prepare("SELECT id, name FROM categories ORDER BY name").all()),
);

app.post("/api/admin/categories", auth, ownerOnly, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Category name must be between 2 and 60 characters." });
  try {
    const result = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch {
    res.status(409).json({ error: "A category with that name already exists." });
  }
});

app.post("/api/admin/products", auth, ownerOnly, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const category = String(req.body?.category || "").trim();
  const price = Number(req.body?.price);
  const stock = Number(req.body?.stock);
  const reorderLevel = Number(req.body?.reorderLevel);
  const description = String(req.body?.description || "").trim().slice(0, 240);
  const image = String(req.body?.image || "").trim();
  if (name.length < 2 || name.length > 100 || !category || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(reorderLevel) || reorderLevel < 0 || (image && !/^https:\/\//i.test(image))) {
    return res.status(400).json({ error: "Enter a valid product name, category, price, stock and reorder level. Product images must use HTTPS." });
  }
  const categoryExists = db.prepare("SELECT id FROM categories WHERE name = ?").get(category);
  if (!categoryExists) return res.status(400).json({ error: "Select an existing category." });
  const productId = db.prepare("SELECT COALESCE(MAX(product_id), 1000) + 1 AS nextId FROM inventory").get().nextId;
  db.prepare("INSERT INTO inventory (product_id, name, category, price, description, image, stock, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(productId, name, category, price, description, image, stock, reorderLevel);
  res.status(201).json({ productId, name, category, price, description, image, stock, reorderLevel });
});

app.get("/api/admin/inventory", auth, ownerOnly, (_req, res) =>
  res.json(
    db
      .prepare(
        "SELECT product_id AS productId, name, category, price, description, image, stock, reorder_level AS reorderLevel, updated_at AS updatedAt FROM inventory ORDER BY category, name",
      )
      .all(),
  ),
);
app.patch("/api/admin/inventory/:productId", auth, ownerOnly, (req, res) => {
  const productId = Number(req.params.productId);
  const stock = Number(req.body?.stock);
  const reorderLevel = Number(req.body?.reorderLevel);
  const price = Number(req.body?.price);
  if (
    !Number.isInteger(stock) ||
    stock < 0 ||
    !Number.isInteger(reorderLevel) ||
    reorderLevel < 0 ||
    !Number.isFinite(price) ||
    price < 0
  )
    return res
      .status(400)
      .json({
        error: "Price, stock and reorder level must be valid non-negative values.",
      });
  const result = db
    .prepare(
      "UPDATE inventory SET stock=?, reorder_level=?, price=?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?",
    )
    .run(stock, reorderLevel, price, productId);
  if (!result.changes)
    return res.status(404).json({ error: "Inventory item not found." });
  res.json({ ok: true });
});
app.post("/api/admin/employees", auth, ownerOnly, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const displayName = String(req.body?.displayName || "").trim();
  const password = String(req.body?.password || "");
  if (
    !/^[a-zA-Z0-9._-]{3,32}$/.test(username) ||
    displayName.length < 2 ||
    password.length < 8
  )
    return res
      .status(400)
      .json({
        error:
          "Use a 3–32 character username, a display name, and a password of at least 8 characters.",
      });
  try {
    const result = db
      .prepare(
        "INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)",
      )
      .run(username, displayName, bcrypt.hashSync(password, 12), "employee");
    res
      .status(201)
      .json({
        id: result.lastInsertRowid,
        username,
        displayName,
        role: "employee",
      });
  } catch {
    res.status(409).json({ error: "That username is already in use." });
  }
});
app.get("/api/admin/employees", auth, ownerOnly, (_req, res) =>
  res.json(
    db
      .prepare(
        "SELECT id, username, display_name AS displayName, role, active, created_at AS createdAt FROM users ORDER BY id",
      )
      .all(),
  ),
);
app.patch("/api/admin/employees/:id", auth, ownerOnly, (req, res) => {
  const active = req.body?.active ? 1 : 0;
  const id = Number(req.params.id);
  if (id === req.user.id && !active)
    return res
      .status(400)
      .json({ error: "You cannot deactivate your own account." });
  const result = db
    .prepare("UPDATE users SET active=? WHERE id=? AND role='employee'")
    .run(active, id);
  if (!result.changes)
    return res.status(404).json({ error: "Employee not found." });
  res.json({ ok: true });
});

app.post("/api/admin/forecast", auth, ownerOnly, async (_req, res) => {
  const endpoint = process.env.ML_FORECAST_URL;
  if (!endpoint)
    return res
      .status(503)
      .json({
        configured: false,
        error:
          "ML forecast endpoint is not configured yet. Add ML_FORECAST_URL to server/.env when your model API is ready.",
      });
  try {
    const history = db
      .prepare(
        `SELECT date(s.created_at) AS date, si.product_id AS productId, si.name, SUM(si.quantity) AS quantity
      FROM sales s JOIN sale_items si ON si.sale_id=s.id GROUP BY date(s.created_at), si.product_id, si.name ORDER BY date`,
      )
      .all();
    const inventory = db
      .prepare(
        "SELECT product_id AS productId, name, stock, reorder_level AS reorderLevel FROM inventory",
      )
      .all();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ML_FORECAST_TOKEN
          ? { Authorization: `Bearer ${process.env.ML_FORECAST_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ history, inventory }),
    });
    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    res.json({ configured: true, ...(await response.json()) });
  } catch (error) {
    res
      .status(502)
      .json({
        configured: true,
        error: `Could not reach ML service: ${error.message}`,
      });
  }
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () =>
  console.log(`FreshMart API running at http://localhost:${port}`),
);
