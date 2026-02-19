import secrets
from flask import session, request

CSRF_KEY = "_csrf_token"


def generate_csrf_token():
    """
    Create CSRF token once per session.
    Works safely with SPA + fetch + mobile app.
    """

    token = session.get(CSRF_KEY)

    if not token:
        token = secrets.token_hex(32)
        session[CSRF_KEY] = token
        session.modified = True

    return token


def validate_csrf():
    """
    Validate CSRF for unsafe HTTP methods.
    Does NOT crash SPA.
    Returns True/False instead of aborting.
    """

    if request.method in ("GET", "HEAD", "OPTIONS"):
        return True

    sent_token = (
        request.headers.get("X-CSRFToken")
        or request.headers.get("X-CSRF-Token")
        or request.form.get("csrf_token")
    )

    session_token = session.get(CSRF_KEY)

    if not sent_token or not session_token:
        return False

    return secrets.compare_digest(sent_token, session_token)
