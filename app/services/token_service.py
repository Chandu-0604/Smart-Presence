import secrets
from datetime import datetime, timedelta
from app.models.attendance_token import AttendanceToken
from app.extensions import db

TOKEN_VALIDITY_SECONDS = 120


def cleanup_expired_tokens():
    AttendanceToken.query.filter(
        AttendanceToken.expires_at < datetime.utcnow()
    ).delete()
    db.session.commit()


def generate_attendance_token(user_id, session_id):

    cleanup_expired_tokens()

    token = secrets.token_urlsafe(32)

    record = AttendanceToken(
        token=token,
        user_id=user_id,
        session_id=session_id,
        expires_at=datetime.utcnow() + timedelta(seconds=TOKEN_VALIDITY_SECONDS),
        used=False
    )

    db.session.add(record)
    db.session.commit()

    return token


def verify_attendance_token(token, user_id, session_id):

    # lock row (prevents double attendance)
    record = AttendanceToken.query.filter_by(token=token)\
        .with_for_update().first()

    if not record:
        return False, "Invalid or reused token"

    if record.used:
        return False, "Token already used"

    if datetime.utcnow() > record.expires_at:
        record.used = True
        db.session.commit()
        return False, "Token expired"

    if record.user_id != user_id or record.session_id != session_id:
        return False, "Token mismatch"

    # consume token
    record.used = True
    db.session.commit()

    return True, "Valid"