import smtplib
import threading
from email.mime.text import MIMEText
from flask import current_app
from app.utils.logger import log_event


def _send_email(app, subject, body):
    """Runs inside background thread WITH app context"""
    with app.app_context():
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = app.config["MAIL_USERNAME"]
            msg["To"] = app.config["ADMIN_EMAIL"]

            server = smtplib.SMTP(
                app.config["MAIL_SERVER"],
                app.config["MAIL_PORT"]
            )
            server.starttls()
            server.login(
                app.config["MAIL_USERNAME"],
                app.config["MAIL_PASSWORD"]
            )

            server.sendmail(
                app.config["MAIL_USERNAME"],
                app.config["ADMIN_EMAIL"],
                msg.as_string()
            )

            server.quit()

            log_event("Alert email sent successfully")

        except Exception as e:
            log_event(f"Email failed: {str(e)}")


def send_alert_async(subject, body):
    """Public function called by routes"""
    app = current_app._get_current_object()

    thread = threading.Thread(
        target=_send_email,
        args=(app, subject, body),
        daemon=True
    )
    thread.start()