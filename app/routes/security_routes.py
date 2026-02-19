from flask import Blueprint
from app.utils.csrf import generate_csrf_token

security_api = Blueprint("security_api", __name__)

@security_api.route("/csrf-token")
def get_csrf():
    token = generate_csrf_token()
    return {
        "success": True,
        "csrf_token": token
    }
