
import sqlite3
import random
from datetime import date, timedelta
from pathlib import Path

DB_PATH = (
    "../kirana-app/server/data/freshmart.sqlite"
)

random.seed(42)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Separate table: synthetic data never mixes with real bills.
cursor.execute("""
CREATE TABLE IF NOT EXISTS synthetic_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_date TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL
)
""")

# Clear previous generated dataset before regenerating.
cursor.execute("DELETE FROM synthetic_sales")

products = cursor.execute("""
    SELECT product_id, name
    FROM inventory
    ORDER BY product_id
    LIMIT 10
""").fetchall()

if not products:
    raise RuntimeError("No products found in inventory.")

# Approximate daily demand for each product.
demand = {
    product_id: random.randint(5, 20)
    for product_id, _ in products
}

start_date = date.today() - timedelta(days=59)
records = []

for day_number in range(60):
    current_date = start_date + timedelta(days=day_number)

    for product_id, product_name in products:

        # Weekend demand is slightly higher.
        weekend_factor = (
            1.3 if current_date.weekday() >= 5 else 1.0
        )

        # Random variation around expected demand.
        expected = demand[product_id] * weekend_factor
        quantity = max(
            0,
            round(random.gauss(expected, expected * 0.20))
        )

        # Some products have zero-sales days.
        if random.random() < 0.08:
            quantity = 0

        if quantity > 0:
            records.append((
                current_date.isoformat(),
                product_id,
                product_name,
                quantity
            ))

# Keep exactly 500 sample records for this experiment.
if len(records) < 500:
    raise RuntimeError(
        f"Generated only {len(records)} records; expected at least 500."
    )

records = random.sample(records, 500)

cursor.executemany("""
    INSERT INTO synthetic_sales
    (sale_date, product_id, product_name, quantity)
    VALUES (?, ?, ?, ?)
""", records)

conn.commit()

print("Synthetic records inserted:", len(records))
print("Products:", len(products))
print("Database:", DB_PATH)

conn.close()
