# FreshMart POS

FreshMart POS is a simple point-of-sale and inventory app built for small retail shops and kirana stores. It gives the owner a clean dashboard to manage products, staff, sales, and low-stock alerts without needing a heavy ERP setup.

The app is built with React on the frontend, Express on the backend, and SQLite for local storage. It also includes an optional forecasting service for demand planning.

## What it does

- Lets the owner create and manage product categories
- Adds products with name, category, price, stock, reorder level, and image URL
- Supports owner and employee login
- Lets staff open a table/session and add items to a cart
- Handles checkout with discount and payment method
- Stores sales and keeps inventory updated automatically
- Shows recent sales and basic store analytics to the owner
- Allows employee account activation and deactivation
- Includes a forecast feature that suggests restock based on recent sales trends

## Tech stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: SQLite with better-sqlite3
- Auth: JWT and bcrypt
- Forecasting: Python, Pandas, scikit-learn, FastAPI

## Project structure

```text
freshmart-pos/
├── src/
│   ├── components/
│   ├── App.jsx
│   ├── api.js
│   └── main.jsx
├── server/
│   ├── index.js
│   ├── .env.example
│   └── data/
├── freshmart-ml/
│   ├── train_ml.py
│   ├── ml_api.py
│   ├── requirements.txt
│   └── model/
├── public/
├── package.json
├── vite.config.js
├── README.md
├── ML_INTEGRATION.md
├── .gitignore
└── index.html
```

## Requirements

- Node.js 20 or newer
- Python 3.10 or newer if you want the forecasting service
- A persistent disk for the SQLite database

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend environment

Copy the example env file and fill in the values:

```bash
cp server/.env.example server/.env
```

At minimum, set:

- `JWT_SECRET` with a strong random value
- `OWNER_USERNAME`
- `OWNER_PASSWORD` with at least 12 characters
- `OWNER_NAME` if you want a custom display name
- `CLIENT_ORIGIN` for your frontend origin
- `TABLE_COUNT` and `GST_RATE` depending on the shop

Example:

```env
JWT_SECRET=your-long-random-secret
OWNER_USERNAME=owner
OWNER_PASSWORD=StrongShopPassword123
OWNER_NAME=Shop Owner
CLIENT_ORIGIN=http://localhost:5173
TABLE_COUNT=12
GST_RATE=0
```

The app will not start properly on a fresh database until the owner credentials and JWT secret are configured.

### 3. Start the app

This runs both the backend and frontend together:

```bash
npm run dev:full
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

If you want to run them separately:

```bash
npm run server
npm run dev
```

## First run

On the first launch, the backend creates the owner account and an empty catalog. Log in with the owner username and password from `server/.env`.

From there:

1. Add categories
2. Add products with prices and opening stock
3. Create employee accounts if needed
4. Start using the POS screen for billing

## Owner dashboard

The owner panel includes:

- recent sales summary
- daily revenue stats
- products sold most often
- low-stock warnings
- category and product management
- employee management
- optional stock forecasting

## Forecasting (optional)

This part is useful if you want a smarter reorder suggestion instead of guessing. The forecasting service looks at recent sales data and current stock, then estimates how much of each product may be needed next.

### Train the model

```bash
cd freshmart-ml
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_ml.py
```

The model needs enough sales history to make a useful estimate. It is best used after the shop has been running for a while.

### Start the API

```bash
uvicorn ml_api:app --host 0.0.0.0 --port 8000
```

Then point the backend to the forecast endpoint in `server/.env`:

```env
ML_FORECAST_URL=http://localhost:8000/forecast
```

The current logic uses a simple reorder formula based on expected demand, supplier lead time, and safety stock. It is a helpful estimate, not a purchase order.

## Notes

- The database lives in `server/data/freshmart.sqlite`.
- The app is designed for a single shop setup, not a multi-tenant SaaS platform.
- GST is currently handled as a single shop-wide rate, not per product.
- Payment methods are recorded as selected options, but the project does not currently connect to a payment gateway.
- For production deployment, keep the backend on a secure server and set `CLIENT_ORIGIN` to the correct frontend domain.

## Good to know

This project is meant to be practical rather than fancy. It is built for everyday shop operations: keep stock accurate, make checkout fast, and give the owner enough visibility to run the store without spreadsheets and paper notes.

If you want to use it for a real shop, the most important setup is to secure the `.env` file, choose the correct GST rate, and make sure the database is stored on persistent storage.
