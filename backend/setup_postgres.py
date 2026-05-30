"""
Script de setup do PostgreSQL:
- Cria todas as tabelas
- Cria o usuario root com senha ventilador@18
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL", "")
if not db_url.startswith("postgresql"):
    print("ERRO: DATABASE_URL nao aponta para PostgreSQL.")
    print(f"   Valor atual: {db_url}")
    sys.exit(1)

print(f"Conectando em: {db_url}")

from app.database import engine, SessionLocal
from app.models import Base, User, UserRole
from passlib.context import CryptContext

print("Criando tabelas...")
Base.metadata.create_all(bind=engine)
print("Tabelas criadas!")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()
try:
    existing = db.query(User).filter(User.email == "root@academia.com").first()
    if existing:
        existing.password_hash = pwd_ctx.hash("ventilador@18")
        existing.role = UserRole.root
        existing.active = True
        db.commit()
        print("Usuario root atualizado.")
    else:
        root = User(
            name="Root",
            email="root@academia.com",
            password_hash=pwd_ctx.hash("ventilador@18"),
            role=UserRole.root,
            active=True,
        )
        db.add(root)
        db.commit()
        print("Usuario root criado!")

    print()
    print("Setup concluido!")
    print("  Email : root@academia.com")
    print("  Senha : ventilador@18")
finally:
    db.close()
