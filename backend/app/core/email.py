import logging
import smtplib
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("finnexus.email")


def _send(to_email: str, subject: str, body: str, *, log_fallback: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP chưa được cấu hình. %s cho %s: %s", log_fallback, to_email, body)
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())


def send_reset_email(to_email: str, reset_link: str) -> None:
    body = (
        "Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản FinNexus KG.\n\n"
        f"Nhấn vào link sau để đặt lại mật khẩu (hết hạn sau 30 phút):\n{reset_link}\n\n"
        "Nếu bạn không yêu cầu điều này, hãy bỏ qua email này."
    )
    _send(to_email, "Đặt lại mật khẩu FinNexus KG", body, log_fallback="Reset link")


def send_otp_email(to_email: str, code: str) -> None:
    body = (
        f"Mã xác thực FinNexus KG của bạn là: {code}\n\n"
        "Mã có hiệu lực trong 10 phút và chỉ dùng được một lần.\n"
        "Nếu bạn không yêu cầu mã này, hãy bỏ qua email này."
    )
    _send(to_email, "Mã xác thực FinNexus KG", body, log_fallback="Mã OTP")
