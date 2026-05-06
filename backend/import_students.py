"""
Importa alunos da planilha para a escola Gracie Barra Taboado.
Execute com o backend PARADO:
  venv\Scripts\python.exe import_students.py
"""
import sys, os, re, random, string
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from datetime import date, datetime
from app.database import SessionLocal
from app.models import Student, User, UserRole, Belt, FeePlan
from app.auth import hash_password

# ── config ────────────────────────────────────────────────────────────────────
XLSX_PATH = r"C:\Users\maced\Downloads\Documento de Tô No Trabalho.xlsx"
SCHOOL_NAME = "Gracie Barra Taboado"
DEFAULT_PASSWORD = "aluno123"

# ── belt mapping ──────────────────────────────────────────────────────────────
BELT_MAP = {
    "branca": Belt.white, "white": Belt.white,
    "cinza": Belt.grey,   "grey": Belt.grey,
    "amarela": Belt.yellow,
    "laranja": Belt.orange,
    "verde": Belt.green,  "green": Belt.green,
    "azul": Belt.blue,    "blue": Belt.blue,
    "roxa": Belt.purple,  "purple": Belt.purple,
    "marrom": Belt.brown, "brown": Belt.brown,
    "preta": Belt.black,  "black": Belt.black,
}

def parse_belt(v) -> Belt:
    if not v or str(v).strip().lower() in ("nan", ""):
        return Belt.white
    return BELT_MAP.get(str(v).strip().lower(), Belt.white)

def parse_degree(v) -> int:
    try:
        d = int(float(str(v)))
        return max(0, min(4, d))
    except Exception:
        return 0

def parse_date(v) -> date:
    if not v or str(v).strip().lower() in ("nan", "", "none"):
        return date.today()
    s = str(v).strip()
    # Already a datetime
    if hasattr(v, 'date'):
        try:
            d = v.date()
            # Fix obvious year typos (2029 → 2025)
            if d.year > 2027:
                d = d.replace(year=2025)
            return d
        except Exception:
            pass
    # Various string formats
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d%m%Y"):
        try:
            # clean up "05/032026" → "05/03/2026"
            clean = re.sub(r'(\d{2})/(\d{2})(\d{4})', r'\1/\2/\3', s)
            return datetime.strptime(clean, fmt).date()
        except Exception:
            pass
    return date.today()

def parse_amount(v) -> float:
    if not v or str(v).strip().lower() in ("nan", "", "none"):
        return 0.0
    s = str(v).strip().replace(",", ".")
    try:
        return float(s)
    except Exception:
        return 0.0

def parse_due_day(v) -> int:
    try:
        d = int(float(str(v)))
        return max(1, min(31, d))
    except Exception:
        return 10

def make_email(name: str, used: set) -> str:
    # Gera email baseado no nome
    parts = re.sub(r"[^a-zA-Z\s]", "", name.lower()).split()
    parts = [p for p in parts if len(p) > 2]
    if len(parts) >= 2:
        base = f"{parts[0]}.{parts[-1]}"
    elif parts:
        base = parts[0]
    else:
        base = "aluno"
    # Remove acentos simples
    base = base.replace("á","a").replace("ã","a").replace("â","a").replace("é","e") \
               .replace("ê","e").replace("í","i").replace("ó","o").replace("ô","o") \
               .replace("ú","u").replace("ç","c").replace("ü","u")
    email = f"{base}@graciebarra.com.br"
    # Garante unicidade
    if email in used:
        rnd = ''.join(random.choices(string.digits, k=3))
        email = f"{base}{rnd}@graciebarra.com.br"
    used.add(email)
    return email

# ── lê planilha ───────────────────────────────────────────────────────────────
df = pd.read_excel(XLSX_PATH, sheet_name="Alunos", header=None)
# cabeçalho real está na linha 2 (index 2)
# dados: linhas 3 a 40 (index 3..40)
rows = df.iloc[3:41].values  # 38 linhas

db = SessionLocal()

from app.models import School
school = db.query(School).filter(School.name == SCHOOL_NAME).first()
if not school:
    print(f"ERRO: escola '{SCHOOL_NAME}' não encontrada!")
    db.close()
    sys.exit(1)

used_emails = set(u.email for u in db.query(User).all())
created = 0
skipped = 0

for row in rows:
    # cols: 0=N, 1=NOME, 2=FAIXA, 3=DAN, 4=DATA_INICIO, 5=PAGAMENTO, 6=SITUACAO, 7=RECEBER
    name_raw = str(row[1]).strip() if row[1] and str(row[1]) != "nan" else ""
    if not name_raw or name_raw.lower() == "nome completo":
        skipped += 1
        continue

    # Limpa nome
    name = re.sub(r'\s+', ' ', name_raw).strip()
    belt  = parse_belt(row[2])
    degree = parse_degree(row[3])
    enroll = parse_date(row[4])
    due_day = parse_due_day(row[5])
    situacao = str(row[6]).strip().lower() if row[6] and str(row[6]) != "nan" else ""
    amount = parse_amount(row[7])

    email = make_email(name, used_emails)

    # Cria usuário
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(DEFAULT_PASSWORD),
        role=UserRole.aluno,
        school_id=school.id,
        active=True,
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    # Cria aluno
    student = Student(
        user_id=user.id,
        school_id=school.id,
        name=name,
        email=email,
        belt=belt,
        degree=degree,
        enrollment_date=enroll,
        active=True,
    )
    db.add(student)
    db.flush()

    # Cria plano de mensalidade se tiver valor
    if amount > 0 and due_day:
        fee = FeePlan(
            student_id=student.id,
            amount=amount,
            due_day=due_day,
            payment_method=None,
            active=True,
        )
        db.add(fee)

    status_label = f"R${amount:.0f}/mês venc.{due_day}" if amount > 0 else "sem plano"
    print(f"  [{created+1:02d}] {name:<45} {belt.value:<8} grau={degree}  {status_label}")
    created += 1

db.commit()
db.close()
print(f"\nConcluído: {created} alunos importados, {skipped} linhas ignoradas.")
print(f"Senha padrão de todos os alunos: {DEFAULT_PASSWORD}")
