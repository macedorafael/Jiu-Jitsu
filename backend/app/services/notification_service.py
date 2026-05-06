"""
Notification service: email via SMTP and WhatsApp via Evolution API.
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "academia")


def _build_email_html(student_name: str, month: str, amount: float) -> str:
    return f"""
    <html><body style="font-family:Arial,sans-serif;padding:20px">
      <h2 style="color:#c41e3a">Academia de Jiu-Jitsu</h2>
      <p>Olá, <strong>{student_name}</strong>!</p>
      <p>Sua mensalidade de <strong>{month}</strong> no valor de
         <strong>R$ {amount:.2f}</strong> está em aberto.</p>
      <p>Por favor, regularize sua situação para continuar treinando.</p>
      <p>Qualquer dúvida, entre em contato com a secretaria.</p>
      <hr/>
      <small>Academia de Jiu-Jitsu — mensagem automática</small>
    </body></html>
    """


def send_email(to_email: str, student_name: str, month: str, amount: float) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP não configurado — email não enviado para %s", to_email)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Mensalidade {month} em aberto — Academia Jiu-Jitsu"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(_build_email_html(student_name, month, amount), "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        logger.info("Email enviado para %s", to_email)
        return True
    except Exception as e:
        logger.error("Falha ao enviar email para %s: %s", to_email, e)
        return False


def send_whatsapp(phone: str, student_name: str, month: str, amount: float) -> bool:
    """Send WhatsApp message via Evolution API."""
    if not EVOLUTION_API_URL or not EVOLUTION_API_KEY:
        logger.warning("Evolution API não configurada — WhatsApp não enviado para %s", phone)
        return False

    # Normalize phone: only digits, add country code if missing
    digits = "".join(filter(str.isdigit, phone))
    if not digits.startswith("55"):
        digits = "55" + digits

    message = (
        f"Olá {student_name}! 🥋\n\n"
        f"Sua mensalidade de *{month}* no valor de *R$ {amount:.2f}* está em aberto.\n\n"
        "Por favor, regularize sua situação para continuar treinando.\n\n"
        "_Academia de Jiu-Jitsu — mensagem automática_"
    )

    url = f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    payload = {"number": digits, "text": message}
    headers = {"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}

    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=15)
        response.raise_for_status()
        logger.info("WhatsApp enviado para %s", phone)
        return True
    except Exception as e:
        logger.error("Falha ao enviar WhatsApp para %s: %s", phone, e)
        return False


def notify_overdue(student_name: str, email: Optional[str], phone: Optional[str], month: str, amount: float):
    """Send both email and WhatsApp notifications for an overdue payment."""
    if email:
        send_email(email, student_name, month, amount)
    if phone:
        send_whatsapp(phone, student_name, month, amount)
