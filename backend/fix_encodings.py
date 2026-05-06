"""
Reprocessa alunos que têm foto mas não têm face_encoding.
Execute com o backend PARADO:
  cd backend
  python fix_encodings.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from app.database import SessionLocal
from app.models import Student
from app.services.face_service import encode_face_from_bytes, encode_face_from_crop_bytes

db = SessionLocal()

students = db.query(Student).filter(
    Student.active == True,
    Student.photo_path.isnot(None),
    Student.face_encoding == None,
).all()

print(f"Alunos com foto mas sem encoding: {len(students)}")

fixed = 0
for s in students:
    path = s.photo_path
    if not path or not os.path.exists(path):
        print(f"  [SKIP] {s.name}: arquivo nao encontrado ({path})")
        continue
    try:
        with open(path, "rb") as f:
            data = f.read()
        # Tenta encode_face_from_bytes (para fotos de referência completas)
        encoding = encode_face_from_bytes(data)
        if encoding is None:
            # Tenta como recorte direto (para crops salvos pelo sistema)
            encoding = encode_face_from_crop_bytes(data)
        if encoding:
            s.face_encoding = json.dumps(encoding)
            fixed += 1
            print(f"  [OK] {s.name}: encoding gerado")
        else:
            print(f"  [FAIL] {s.name}: nao foi possivel gerar encoding")
    except Exception as e:
        print(f"  [ERRO] {s.name}: {e}")

db.commit()
db.close()
print(f"\nConcluido. {fixed}/{len(students)} alunos corrigidos.")
