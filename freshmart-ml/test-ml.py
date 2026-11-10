
import sqlite3
import os
os.makedirs("model", exist_ok=True)
db = sqlite3.connect(
    "../kirana-app/server/data/freshmart.sqlite"
)

print("SALES COUNT:")
print(db.execute("SELECT COUNT(*) FROM sales").fetchone()[0])

print("\nSALE ITEMS COUNT:")
print(db.execute("SELECT COUNT(*) FROM sale_items").fetchone()[0])

print("\nPRODUCT-WISE SALES HISTORY:")
rows = db.execute("""
    SELECT
        si.product_id,
        si.name,
        COUNT(DISTINCT date(s.created_at)) AS days,
        SUM(si.quantity) AS total_quantity,
        MAX(date(s.created_at)) AS last_sale
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    GROUP BY si.product_id, si.name
    ORDER BY days DESC
""").fetchall()

for row in rows:
    print(row)

db.close()
