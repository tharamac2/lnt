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
    """Generate an OTP, store it, email it to the user, and return it."""
    otp = generate_otp()
    _otp_store[to_email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        "verified": False,
    }
    
    print(f"\n[OTP VERIFICATION] Verification OTP code generated for email {to_email}: {otp}\n")

    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print(f"DEV MODE: Gmail not configured. Verification code logged to terminal above: {otp}")
        return otp

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


def send_otp_sms(to_phone: str) -> str:
    """Generate a random OTP, store it, send it via Twilio or Fast2SMS, and return it."""
    otp = generate_otp()
    _otp_store[to_phone] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        "verified": False,
    }
    
    print(f"\n[OTP VERIFICATION] SMS OTP generated: {otp} for phone {to_phone} (Sender: 9123585284)\n")
    
    # Twilio API Integration
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_FROM_NUMBER")
    
    if account_sid and auth_token and from_number:
        try:
            import httpx
            # Auto-format To number to E.164 (+91 for India)
            formatted_to = to_phone.strip()
            if not formatted_to.startswith("+"):
                if len(formatted_to) == 10:
                    formatted_to = "+91" + formatted_to
                elif len(formatted_to) == 12 and formatted_to.startswith("91"):
                    formatted_to = "+" + formatted_to

            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            data = {
                "From": from_number,
                "To": formatted_to,
                "Body": f"Your QR Tools verification code is: {otp}. It expires in {OTP_TTL_MINUTES} minutes."
            }
            response = httpx.post(url, data=data, auth=(account_sid, auth_token))
            if response.status_code in [200, 201]:
                print(f"Twilio SMS sent successfully to {formatted_to}")
            else:
                print(f"Twilio SMS failed with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error sending Twilio SMS: {e}")
            
    # Fast2SMS API Integration
    fast2sms_api_key = os.environ.get("FAST2SMS_API_KEY")
    if fast2sms_api_key:
        try:
            import httpx
            url = "https://www.fast2sms.com/dev/bulkV2"
            headers = {
                "authorization": fast2sms_api_key,
                "Content-Type": "application/json"
            }
            payload = {
                "route": "otp",
                "variables_values": otp,
                "numbers": to_phone
            }
            response = httpx.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                print(f"Fast2SMS SMS sent successfully to {to_phone}")
            else:
                print(f"Fast2SMS SMS failed with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error sending Fast2SMS SMS: {e}")
            
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


def register_twilio_verified_caller_id(phone: str, friendly_name: str = None) -> None:
    """Add a phone number dynamically to Twilio's Verified Caller IDs."""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    
    if account_sid and auth_token:
        # Format the phone number to E.164
        formatted_phone = phone.strip()
        if not formatted_phone.startswith("+"):
            if len(formatted_phone) == 10:
                formatted_phone = "+91" + formatted_phone
            elif len(formatted_phone) == 12 and formatted_phone.startswith("91"):
                formatted_phone = "+" + formatted_phone
                
        try:
            import httpx
            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/OutgoingCallerIds.json"
            data = {
                "PhoneNumber": formatted_phone,
            }
            if friendly_name:
                data["FriendlyName"] = friendly_name
                
            response = httpx.post(url, data=data, auth=(account_sid, auth_token))
            if response.status_code in [200, 201]:
                print(f"Successfully registered verification caller ID request with Twilio: {formatted_phone}")
            else:
                print(f"Failed to register Twilio verification caller ID request for {formatted_phone}: {response.text}")
        except Exception as e:
            print(f"Error registering Twilio verification caller ID request for {formatted_phone}: {e}")
