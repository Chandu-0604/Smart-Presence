from datetime import datetime, timedelta
from flask import g, current_app

# run once every 60 seconds maximum
SESSION_SWEEP_INTERVAL = 60  # seconds


def auto_close_expired_sessions():

    now = datetime.utcnow()

    # Prevent running multiple times in same request
    if getattr(g, "session_checked", False):
        return
    g.session_checked = True

    # Prevent running too frequently across requests
    last_run = current_app.config.get("LAST_SESSION_SWEEP")

    if last_run and (now - last_run).total_seconds() < SESSION_SWEEP_INTERVAL:
        return

    current_app.config["LAST_SESSION_SWEEP"] = now

    # Import inside to avoid circular import
    from app.models.attendance_session import AttendanceSession
    from app.extensions import db

    # allow 30 second grace period
    GRACE_SECONDS = 30
    grace_now = now - timedelta(seconds=GRACE_SECONDS)

    expired_sessions = AttendanceSession.query.filter(
        AttendanceSession.is_active == True,
        AttendanceSession.end_time < grace_now
    ).all()

    if not expired_sessions:
        return

    for s in expired_sessions:
        s.is_active = False

    db.session.commit()