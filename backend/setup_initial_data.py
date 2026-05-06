"""
Limpa todo o banco e cria os dados iniciais.
Execute com o backend PARADO:
  cd backend
  venv\Scripts\python.exe setup_initial_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sqlite3
from datetime import datetime
from app.auth import hash_password

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "academia.db")

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = OFF")

# ── 1. Limpar todas as tabelas ────────────────────────────────────────────────
TABLES = [
    "attendance", "unidentified_faces", "training_sessions",
    "fee_payments", "fee_plans", "belt_history",
    "students", "class_schedules", "users", "schools",
]
for t in TABLES:
    rows = conn.execute(f"DELETE FROM {t}").rowcount
    if rows: print(f"  {t}: {rows} registros removidos")
try:
    for t in TABLES:
        conn.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}'")
except Exception:
    pass

print("Base limpa.\n")

now = datetime.utcnow().isoformat()

# ── 2. Escola: Gracie Barra Taboao ────────────────────────────────────────────
conn.execute("""
    INSERT INTO schools (name, phone, pix_key, active, created_at)
    VALUES (?, ?, ?, 1, ?)
""", ("Gracie Barra Taboado", None, "eliandro.lcp@outlook.com", now))
school_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
print(f"Escola criada: Gracie Barra Taboado (id={school_id})")

# ── 3. Usuário root ───────────────────────────────────────────────────────────
conn.execute("""
    INSERT INTO users (name, email, password_hash, role, school_id, active, must_change_password, created_at)
    VALUES (?, ?, ?, 'root', NULL, 1, 0, ?)
""", ("Root", "root@academia.com", hash_password("root123"), now))
root_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
print(f"Root criado: root@academia.com / root123 (id={root_id})")

# ── 4. Usuário admin — Eliandro ───────────────────────────────────────────────
conn.execute("""
    INSERT INTO users (name, email, password_hash, role, school_id, active, must_change_password, created_at)
    VALUES (?, ?, ?, 'admin', ?, 1, 0, ?)
""", (
    "Eliandro Leonel Camilo Pinto",
    "eliandro.lcp@outlook.com",
    hash_password("teste123"),
    school_id,
    now,
))
admin_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
print(f"Admin criado: eliandro.lcp@outlook.com / teste123 (id={admin_id})")

conn.execute("PRAGMA foreign_keys = ON")
conn.commit()
conn.close()

print("\n=== Configuração concluída ===")
print("Login root : root@academia.com   / root123")
print("Login admin: eliandro.lcp@outlook.com / teste123")
