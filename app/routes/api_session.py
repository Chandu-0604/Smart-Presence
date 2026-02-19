from flask import Blueprint, jsonify
from flask_login import current_user
from app.utils.csrf import generate_csrf_token

api_session = Blueprint("api_session", __name__)

@api_session.route("/session/me")
def session_me():

    if not current_user.is_authenticated:
        return jsonify({"success": False}), 401

    # IMPORTANT — generate CSRF tied to SAME session
    csrf = generate_csrf_token()

    return jsonify({
        "success": True,
        "data": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "is_enabled": current_user.is_enabled
        },
        "csrf_token": csrf
    })