import sqlite3
conn = sqlite3.connect("academia.db")
cur = conn.cursor()

print("=== Alunos infantis ATIVOS com plano ===")
cur.execute("""
    SELECT s.id, s.name, fp.amount, fp.active
    FROM students s
    JOIN fee_plans fp ON fp.student_id = s.id
    WHERE s.profile = 'infantil' AND s.active = 1 AND fp.active = 1
    ORDER BY s.name
""")
rows = cur.fetchall()
for r in rows:
    print(f"  id={r[0]} | {r[1]} | plano={r[2]} | plano_ativo={r[3]}")
print(f"  Total: {len(rows)}")

print("\n=== Pagamentos maio/2026 de infantis ===")
cur.execute("""
    SELECT s.name, fp2.status, fp2.amount_paid
    FROM fee_payments fp2
    JOIN students s ON s.id = fp2.student_id
    WHERE s.profile = 'infantil' AND fp2.month_reference = '2026-05'
    ORDER BY s.name
""")
rows2 = cur.fetchall()
for r in rows2:
    print(f"  {r[0]} | {r[1]} | pago={r[2]}")
print(f"  Total registros: {len(rows2)}")
conn.close()
