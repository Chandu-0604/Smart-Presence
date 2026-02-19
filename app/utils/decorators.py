from functools import wraps
from flask import jsonify, redirect, url_for, request
from flask_login import current_user
from app.utils.logger import log_event
from app.utils.csrf import validate_csrf
from werkzeug.exceptions import HTTPException

# ======================================================
# PAGE ROUTE PROTECTION
# ======================================================

from functools import wraps
from flask import render_template
from flask_login import current_user


def role_required_page(role):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):

            # Always serve the SPA shell.
            # Authentication will be handled by API + frontend.

            if not current_user.is_authenticated:
                return render_template("layout/base.html", role="guest")

            if not current_user.is_enabled:
                return render_template("layout/base.html", role="guest")

            # If wrong role, still load shell
            # frontend router will show access denied
            user_role = (current_user.role or "").strip().lower()
            required_role = (role or "").strip().lower()

            if user_role != required_role:
                return render_template("layout/base.html", role=current_user.role)

            return func(*args, **kwargs)

        return wrapper
    return decorator


# ======================================================
# API ROUTE PROTECTION (ENTERPRISE SAFE)
# ======================================================

def role_required_api(role):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):

            # -------- Authentication --------
            if not current_user.is_authenticated:
                return jsonify({
                    "success": False,
                    "error": "Authentication required"
                }), 401

            # -------- CSRF VALIDATION (NOW CORRECT PLACE) --------
            try:
                validate_csrf()
            except HTTPException:
                return jsonify({
                    "success": False,
                    "error": "CSRF validation failed"
                }), 403

            # -------- Disabled Account --------
            if not current_user.is_enabled:
                log_event("Disabled account attempted API access")
                return jsonify({
                    "success": False,
                    "error": "Account disabled"
                }), 403

            # -------- Role Violation (NORMALIZED CHECK) --------
            user_role = (current_user.role or "").strip().lower()
            required_role = (role or "").strip().lower()

            if user_role != required_role:
                log_event(
                    f"ROLE VIOLATION: user {current_user.id} "
                    f"({current_user.role}) tried accessing {request.path}"
                )
                return jsonify({
                    "success": False,
                    "error": "Unauthorized access"
                }), 403

            return func(*args, **kwargs)

        return wrapper
    return decorator