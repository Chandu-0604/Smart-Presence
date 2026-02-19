from flask import Blueprint, session, jsonify
import secrets

api_security = Blueprint("api_security", __name__)

@api_security.route("/csrf-token")
def get_csrf():

    # reuse existing token if already generated
    if "_csrf_token" not in session:
        session["_csrf_token"] = secrets.token_hex(32)

    return jsonify({
        "success": True,
        "csrf_token": session["_csrf_token"]
    })
