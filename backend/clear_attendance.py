"""
Apaga todos os dados de presença:
  - attendance
  - unidentified_faces
  - training_sessions

Execute com o backend PARADO:
  cd backend
  python clear_attendance.py
"""
import sqlite3
import os

# Caminho absoluto relativo a este script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "academia.db")

if not os.path.exists(DB_PATH):
    print(f"ERRO: banco nao encontrado em {DB_PATH}")
    exit(1)

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = OFF")

tables = ["attendance", "unidentified_faces", "training_sessions"]
for t in tables:
    rows = conn.execute(f"DELETE FROM {t}").rowcount
    print(f"  Tabela '{t}': {rows} registros removidos.")

# Reseta contadores de auto-increment (tabela pode nao existir em DBs sem AUTOINCREMENT)
try:
    for t in tables:
        conn.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}'")
except Exception:
    pass

conn.commit()
conn.close()
print("Concluido. Todos os dados de presenca foram apagados.")
