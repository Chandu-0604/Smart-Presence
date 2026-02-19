from datetime import datetime, timedelta
from flask import session, request
from flask_login import current_user, logout_user

# 15 minutes inactivity timeout
SESSION_TIMEOUT = 15


def check_session_timeout():
    if not current_user.is_authenticated:
        return

    now = datetime.utcnow()

    last_activity = session.get("last_activity")

    if last_activity:
        last_activity = datetime.fromisoformat(last_activity)

        if now - last_activity > timedelta(minutes=SESSION_TIMEOUT):
            # Only expire on page navigation, NOT during API calls
            if request.path.startswith("/api/attendance"):
                # allow biometric request to finish
                session["last_activity"] = now.isoformat()
                return

            logout_user()
            session.pop("last_activity", None)
            session.pop("csrf_token", None)
            return

    # update activity time
    session["last_activity"] = now.isoformat()