import sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.services.pix_service import build_pix_payload, normalize_pix_key, _crc16_ccitt, _is_valid_cpf

print("=== VALIDAÇÃO DE CHAVES ===")
keys = [
    "67981734884",        # telefone sem +55 (caso do usuário)
    "+5567981734884",     # telefone já formatado
    "contato@academia.com",
    "679.817.348-84",     # CPF com formatação
    "11122233344",        # CPF fictício (pode ser válido ou não)
    "12.345.678/0001-90", # CNPJ com formatação
    "a1b2c3d4-5678-90ab-cdef-012345678901",  # chave aleatória
]
for k in keys:
    normalized = normalize_pix_key(k)
    print(f"  {k!r:45s} -> {normalized!r}")

print()
print("=== PAYLOAD GERADO (chave do usuário: 67981734884) ===")
payload = build_pix_payload(
    key="67981734884",
    name="Gracie Barra Taboado",
    city="Brasil",
    amount=150.0
)
print(f"Payload ({len(payload)} chars):")
print(payload)
print()

# Verifica campo a campo
def parse_emv(s, stop_before_crc=True):
    i = 0
    fields = []
    limit = len(s) - 4 if stop_before_crc else len(s)
    while i < limit:
        fid = s[i:i+2]
        flen = int(s[i+2:i+4])
        fval = s[i+4:i+4+flen]
        fields.append((fid, flen, fval))
        i += 4 + flen
    return fields

print("Estrutura EMV:")
for fid, flen, fval in parse_emv(payload):
    if fid == "26":
        print(f"  [{fid}] MAI ({flen} chars):")
        for sfid, sflen, sfval in parse_emv(fval + "0000"):
            label = {"00": "GUI", "01": "Chave Pix", "02": "Descrição"}.get(sfid, sfid)
            print(f"       [{sfid}] {label}: {sfval!r}")
    else:
        labels = {"00": "Format", "01": "Initiation", "52": "MCC", "53": "Currency",
                  "54": "Amount", "58": "Country", "59": "Name", "60": "City",
                  "62": "AdditionalData", "63": "CRC"}
        print(f"  [{fid}] {labels.get(fid, fid)}: {fval!r}")

print()
print("CRC no payload:", payload[-4:])

# CRC test
crc = _crc16_ccitt("123456789")
print(f"\nCRC '123456789': 0x{crc:04X} ({'OK' if crc == 0x29B1 else 'ERRO'})")
