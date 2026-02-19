from flask import request, has_request_context
from flask_login import current_user
from app.extensions import db
from app.models.security_log import SecurityLog
from app.utils.ip_utils import get_client_ip

def log_event(event, user_id=None):
    """
    Safe logging that never breaks the main request.
    """

    try:
        # determine user
        if user_id is None:
            if has_request_context() and current_user.is_authenticated:
                user_id = current_user.id

        # determine IP
        ip = None
        if has_request_context():
            ip_address=get_client_ip()

        log = SecurityLog(
            user_id=user_id,
            event=event,
            ip_address=ip
        )

        db.session.add(log)

        # IMPORTANT: use flush NOT commit
        db.session.flush()

    except Exception:
        # logging must NEVER crash application
        db.session.rollback()
        pass