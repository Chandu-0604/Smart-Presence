from datetime import datetime, timedelta
from app.extensions import db
from app.utils.logger import log_event

# password/login protection
MAX_FAILED_ATTEMPTS = 8
LOCK_TIME_MINUTES = 15

# biometric abuse protection
BIOMETRIC_LOCK_THRESHOLD = 3
BIOMETRIC_LOCK_MINUTES = 10


def register_failed_attempt(user, reason="Suspicious activity"):
    """
    Used ONLY for login/password brute force
    """

    now = datetime.utcnow()

    user.failed_attempts += 1
    user.last_failed_attempt = now

    log_event(f"Security warning for user {user.email}: {reason}")

    # Lock account for password attacks
    if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
        user.account_locked_until = now + timedelta(minutes=LOCK_TIME_MINUTES)
        user.failed_attempts = 0
        log_event(f"ACCOUNT LOCKED (login brute force) for user {user.email}")

    db.session.commit()


def register_biometric_violation(user, reason="Biometric abuse detected"):
    """
    Used ONLY for confirmed biometric attacks
    """

    now = datetime.utcnow()

    if not hasattr(user, "biometric_violations") or user.biometric_violations is None:
        user.biometric_violations = 0

    user.biometric_violations += 1

    log_event(f"Biometric violation for {user.email}: {reason}")

    # Shorter lock for biometric abuse
    if user.biometric_violations >= BIOMETRIC_LOCK_THRESHOLD:
        user.account_locked_until = now + timedelta(minutes=BIOMETRIC_LOCK_MINUTES)
        user.biometric_violations = 0
        log_event(f"ACCOUNT LOCKED (biometric abuse) for user {user.email}")

    db.session.commit()


def is_account_locked(user):

    if not user.account_locked_until:
        return False

    if datetime.utcnow() > user.account_locked_until:
        user.account_locked_until = None
        db.session.commit()
        return False

    return True