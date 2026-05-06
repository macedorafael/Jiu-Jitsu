"""
Serviço de geração de payload Pix (BR Code / EMV QR Code) conforme especificação BCB.
Gera o código copia-e-cola e imagem QR code em base64.
"""
import io
import re
import base64
import unicodedata


# ── Helpers de texto ──────────────────────────────────────────────────────────

def _remove_accents(text: str) -> str:
    """Remove acentos e caracteres especiais, mantendo apenas ASCII imprimível."""
    normalized = unicodedata.normalize("NFD", text)
    ascii_only = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-zA-Z0-9 ]+", "", ascii_only)


# ── Normalização de chave Pix ─────────────────────────────────────────────────

def _is_valid_cpf(digits: str) -> bool:
    """Verifica se uma string de 11 dígitos é um CPF válido (módulo 11)."""
    if len(digits) != 11 or digits == digits[0] * 11:
        return False
    # 1º dígito verificador
    s1 = sum(int(digits[i]) * (10 - i) for i in range(9))
    d1 = (s1 * 10 % 11) % 10
    if d1 != int(digits[9]):
        return False
    # 2º dígito verificador
    s2 = sum(int(digits[i]) * (11 - i) for i in range(10))
    d2 = (s2 * 10 % 11) % 10
    return d2 == int(digits[10])


def _is_valid_cnpj(digits: str) -> bool:
    """Verifica se uma string de 14 dígitos é um CNPJ válido."""
    if len(digits) != 14 or digits == digits[0] * 14:
        return False
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s1 = sum(int(digits[i]) * weights1[i] for i in range(12))
    d1 = 0 if s1 % 11 < 2 else 11 - s1 % 11
    if d1 != int(digits[12]):
        return False
    s2 = sum(int(digits[i]) * weights2[i] for i in range(13))
    d2 = 0 if s2 % 11 < 2 else 11 - s2 % 11
    return d2 == int(digits[13])


_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def normalize_pix_key(key: str) -> str:
    """
    Normaliza a chave Pix para o formato exigido pelo Banco Central:
    - Email: mantém como está
    - Chave aleatória (UUID): mantém como está
    - Telefone (+55...): mantém como está
    - Número brasileiro sem +55: adiciona '+55' automaticamente
    - CPF (11 dígitos válidos): mantém como está (somente dígitos)
    - CNPJ (14 dígitos válidos): mantém como está (somente dígitos)
    """
    key = key.strip()

    # E-mail
    if "@" in key:
        return key.lower()

    # UUID (chave aleatória)
    if _UUID_RE.match(key):
        return key.lower()

    # Já está em formato E.164
    if key.startswith("+"):
        return key

    # Remove caracteres não numéricos para análise
    digits_only = re.sub(r"\D", "", key)

    # CPF (11 dígitos): se for CPF válido usa como está; senão assume telefone
    if len(digits_only) == 11:
        if _is_valid_cpf(digits_only):
            return digits_only  # CPF válido → usa dígitos sem formatação
        else:
            return f"+55{digits_only}"  # Telefone brasileiro → E.164

    # Telefone com 10 dígitos (DDD + 8 dígitos — formato antigo)
    if len(digits_only) == 10:
        return f"+55{digits_only}"

    # CNPJ (14 dígitos) → retorna apenas dígitos (sem pontos/barra/traço)
    if len(digits_only) == 14:
        return digits_only

    # 13 dígitos começando com 55 (código país sem +)
    if len(digits_only) == 13 and digits_only.startswith("55"):
        return f"+{digits_only}"

    # Outros casos: retorna como fornecido pelo usuário
    return key


# ── EMV payload builder ───────────────────────────────────────────────────────

def _field(id_: str, value: str) -> str:
    """Formata campo EMV: ID (2 chars) + tamanho (2 dígitos) + valor."""
    return f"{id_}{len(value):02d}{value}"


def _crc16_ccitt(payload: str) -> int:
    """Calcula CRC-16/CCITT-FALSE (poli=0x1021, init=0xFFFF) conforme spec Pix."""
    data = payload.encode("utf-8")
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc


def build_pix_payload(
    key: str,
    name: str,
    city: str = "Brasil",
    amount: float = 0.0,
    description: str = "",
) -> str:
    """
    Gera o payload EMV para QR Code Pix estático conforme BACEN.

    Args:
        key: Chave Pix (será normalizada automaticamente para o formato correto)
        name: Nome do recebedor (máx 25 chars, acentos removidos)
        city: Cidade do recebedor (máx 15 chars, acentos removidos)
        amount: Valor da transação
        description: Informação adicional opcional (máx 50 chars)

    Returns:
        String payload Pix pronta para geração do QR code
    """
    # Normaliza a chave para o formato correto (E.164, CPF, CNPJ, email, UUID)
    normalized_key = normalize_pix_key(key)

    # Merchant Account Information (campo 26)
    gui = _field("00", "br.gov.bcb.pix")
    chave = _field("01", normalized_key)
    mai_content = gui + chave
    if description:
        desc_clean = _remove_accents(description.strip())[:50]
        if desc_clean:
            mai_content += _field("02", desc_clean)
    mai = _field("26", mai_content)

    # Limpa nome e cidade
    name_clean = _remove_accents(name.strip())[:25]
    city_clean = _remove_accents(city.strip())[:15]
    amount_str = f"{amount:.2f}"

    # Additional Data Field Template — txid obrigatório (campo 62)
    additional = _field("62", _field("05", "***"))

    # Monta payload sem CRC (campo 63 tem tamanho fixo = 4)
    payload = (
        _field("00", "01")          # Payload Format Indicator
        + _field("01", "11")        # Static QR Code
        + mai                       # Merchant Account Information
        + _field("52", "0000")      # Merchant Category Code
        + _field("53", "986")       # Transaction Currency (BRL)
        + _field("54", amount_str)  # Transaction Amount
        + _field("58", "BR")        # Country Code
        + _field("59", name_clean)  # Merchant Name
        + _field("60", city_clean)  # Merchant City
        + additional                # Additional Data Field Template
        + "6304"                    # CRC header (tamanho sempre 4)
    )

    crc = _crc16_ccitt(payload)
    return payload + f"{crc:04X}"


# ── Gerador de QR Code ────────────────────────────────────────────────────────

def generate_qr_base64(payload: str) -> str:
    """
    Gera imagem QR Code a partir do payload Pix e retorna em base64 PNG.

    Returns:
        String base64 da imagem PNG, ou "" se qrcode não estiver instalado.
    """
    try:
        import qrcode  # type: ignore
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        return ""
