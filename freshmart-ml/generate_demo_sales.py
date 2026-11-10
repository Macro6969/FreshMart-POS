
import sqlite3
import random
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path("server/data/freshmart.sqlite")

random.seed(42)

db = sqlite3.connect(DB_PATH)
db.execute("PRAGMA foreign_keys = ON")

try:
    # Prevent accidental duplicate insertion
    existing = db.execute("""
        SELECT COUNT(*) FROM sales
        WHERE bill_number LIKE 'SYN-%'
    """).fetchone()[0]

    if existing:
        raise Exception(
            f"{existing} synthetic bills already exist. "
            "Not inserting duplicates."
        )

    # Verify owner exists
    owner = db.execute(
        "SELECT id FROM users WHERE id = 1"
    ).fetchone()

    if not owner:
        raise Exception("Owner user ID 1 not found.")

    products = db.execute("""
        SELECT product_id, name, price
        FROM inventory
        ORDER BY product_id
    """).fetchall()

    if not products:
        raise Exception("No inventory products found.")

    # Generate 60 days of history ending November 3, 2026
    start_date = datetime(2026, 9, 5)
    end_date = datetime(2026, 11, 3)
    total_days = (end_date - start_date).days + 1

    payment_methods = ["Cash", "UPI", "Card"]

    db.execute("BEGIN IMMEDIATE")

    for bill_no in range(1, 501):

        day_offset = random.randrange(total_days)
        bill_date = start_date + timedelta(days=day_offset)

        bill_time = bill_date.replace(
            hour=random.randint(9, 21),
            minute=random.randint(0, 59),
            second=random.randint(0, 59)
        )

        # One to three unique products per bill
        item_count = random.randint(1, 3)
        selected = random.sample(
            products,
            min(item_count, len(products))
        )

        bill_items = []
        subtotal = 0

        for product_id, name, price in selected:

            quantity = random.randint(1, 4)
            line_total = round(price * quantity, 2)

            subtotal += line_total

            bill_items.append((
                product_id,
                name,
                quantity,
                price,
                line_total
            ))

        subtotal = round(subtotal, 2)
        discount = round(subtotal * random.uniform(0, 0.05), 2)
        gst = round((subtotal - discount) * 0.05, 2)
        total = round(subtotal - discount + gst, 2)

        bill_number = f"SYN-{bill_no:04d}"

        cursor = db.execute("""
            INSERT INTO sales (
                bill_number,
                user_id,
                employee_name,
                table_number,
                subtotal,
                discount,
                gst,
                total,
                payment_method,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            bill_number,
            1,
            "SYNTHETIC DEMO",
            random.randint(1, 12),
            subtotal,
            discount,
            gst,
            total,
            random.choice(payment_methods),
            bill_time.strftime("%Y-%m-%d %H:%M:%S")
        ))

        sale_id = cursor.lastrowid

        for item in bill_items:
            db.execute("""
                INSERT INTO sale_items (
                    sale_id,
                    product_id,
                    name,
                    quantity,
                    unit_price,
                    line_total
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (sale_id, *item))

    db.commit()

    print("SUCCESS: 500 synthetic bills inserted.")
    print("Date range:", start_date.date(), "to", end_date.date())

    print("\nSynthetic sales count:")
    print(db.execute("""
        SELECT COUNT(*) FROM sales
        WHERE bill_number LIKE 'SYN-%'
    """).fetchone()[0])

    print("\nSynthetic sale item count:")
    print(db.execute("""
        SELECT COUNT(*)
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.bill_number LIKE 'SYN-%'
    """).fetchone()[0])

    print("\nProduct-wise selling days:")
    for row in db.execute("""
        SELECT si.product_id, si.name,
               COUNT(DISTINCT date(s.created_at)) AS days,
               SUM(si.quantity) AS quantity
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE s.bill_number LIKE 'SYN-%'
        GROUP BY si.product_id, si.name
        ORDER BY si.product_id
    """):
        print(row)

except Exception:
    db.rollback()
    raise

finally:
    db.close()
