import os
import random
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()

GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")

OTP_TTL_MINUTES = 10

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "lt-logo.png")

OTP_EMAIL_HTML_TEMPLATE = """\
<html>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td align="center" style="background-color:#1E3A8A; padding:20px;">
                <img src="cid:lt_logo" alt="L&T Construction" style="height:40px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 16px 32px;">
                <h2 style="margin:0 0 8px 0; color:#0F172A;">Your verification code</h2>
                <p style="color:#475569; font-size:14px; line-height:1.5; margin:0 0 24px 0;">
                  Use the code below to verify your identity for the QR Tools Management System.
                </p>
                <div style="text-align:center; margin:24px 0;">
                  <span style="display:inline-block; font-size:32px; letter-spacing:8px; font-weight:bold; color:#1E3A8A; background-color:#EFF6FF; padding:12px 24px; border-radius:6px;">
                    {otp}
                  </span>
                </div>
                <p style="color:#475569; font-size:13px; line-height:1.5; margin:0;">
                  This code expires in {ttl} minutes. If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px; border-top:1px solid #E2E8F0;">
                <p style="color:#94A3B8; font-size:12px; margin:0;">QR Tools Management System &middot; L&amp;T Construction</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

# In-memory OTP store: { email: {"otp": "123456", "expires_at": datetime, "verified": bool} }
_otp_store: dict[str, dict] = {}


def generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def send_otp_email(to_email: str) -> str:
    """Generate an OTP, store it, email it to the user, and return it (for logging/dev fallback)."""
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        # Development fallback when email is not configured
        otp = "123456"
        _otp_store[to_email] = {
            "otp": otp,
            "expires_at": datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
            "verified": False,
        }
        print(f"DEV MODE: OTP for {to_email} is {otp}")
        return otp

    otp = generate_otp()
    _otp_store[to_email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        "verified": False,
    }

    msg = EmailMessage()
    msg["Subject"] = "Your verification code - QR Tools Management"
    msg["From"] = GMAIL_USER
    msg["To"] = to_email
    msg.set_content(
        f"Your email verification code is: {otp}\n\n"
        f"This code expires in {OTP_TTL_MINUTES} minutes.\n"
        "If you did not request this, you can ignore this email."
    )

    html = OTP_EMAIL_HTML_TEMPLATE.format(otp=otp, ttl=OTP_TTL_MINUTES)
    msg.add_alternative(html, subtype="html")

    if os.path.isfile(LOGO_PATH):
        with open(LOGO_PATH, "rb") as f:
            logo_data = f.read()
        msg.get_payload()[1].add_related(logo_data, maintype="image", subtype="png", cid="lt_logo")

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(msg)

    return otp


BACKUP_EMAIL_HTML_TEMPLATE = """\
<html>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td align="center" style="background-color:#1E3A8A; padding:20px;">
                <img src="cid:lt_logo" alt="L&T Construction" style="height:40px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 16px 32px;">
                <h2 style="margin:0 0 8px 0; color:#0F172A;">Data Backup</h2>
                <p style="color:#475569; font-size:14px; line-height:1.5; margin:0 0 24px 0;">
                  A backup of your QR Tools Management System data was generated on {timestamp}.
                  The full export is attached to this email as a PDF.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px; border-top:1px solid #E2E8F0;">
                <p style="color:#94A3B8; font-size:12px; margin:0;">QR Tools Management System &middot; L&amp;T Construction</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def send_backup_email(to_email: str, pdf_bytes: bytes, filename: str) -> None:
    """Email a generated data-backup PDF as an attachment to the given address."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print(f"DEV MODE: Backup email to {to_email} skipped (email not configured). File: {filename}")
        return

    msg = EmailMessage()
    msg["Subject"] = "Data Backup - QR Tools Management"
    msg["From"] = GMAIL_USER
    msg["To"] = to_email
    msg.set_content(
        f"A backup of your QR Tools Management System data was generated on {timestamp}.\n"
        "The full export is attached to this email as a PDF."
    )

    html = BACKUP_EMAIL_HTML_TEMPLATE.format(timestamp=timestamp)
    msg.add_alternative(html, subtype="html")

    if os.path.isfile(LOGO_PATH):
        with open(LOGO_PATH, "rb") as f:
            logo_data = f.read()
        msg.get_payload()[1].add_related(logo_data, maintype="image", subtype="png", cid="lt_logo")

    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(msg)


def verify_otp(email: str, otp: str) -> bool:
    record = _otp_store.get(email)
    if not record:
        return False
    if datetime.utcnow() > record["expires_at"]:
        del _otp_store[email]
        return False
    if record["otp"] != otp:
        return False
    record["verified"] = True
    return True


def is_email_verified(email: str) -> bool:
    record = _otp_store.get(email)
    return bool(record and record.get("verified"))


def clear_verification(email: str) -> None:
    _otp_store.pop(email, None)
