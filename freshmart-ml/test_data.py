
import sqlite3

db = sqlite3.connect("server/data/freshmart.sqlite")

print("Synthetic bills:",
      db.execute("SELECT COUNT(*) FROM sales WHERE bill_number LIKE 'SYN-%'").fetchone()[0])

print("Synthetic sale items:",
      db.execute("""
      SELECT COUNT(*) FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.bill_number LIKE 'SYN-%'
      """).fetchone()[0])

print("Date range:",
      db.execute("""
      SELECT MIN(date(created_at)), MAX(date(created_at))
      FROM sales WHERE bill_number LIKE 'SYN-%'
      """).fetchone())

db.close()
