from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app.extensions import db
from app.models.user import User
from app.utils.csrf import generate_csrf_token
from app.services.intrusion_service import is_account_locked
from flask import session
from datetime import datetime
from app.models.department import Department

auth = Blueprint("auth", __name__)


# ----------------------------
# API LOGIN (For Postman/Mobile)
# ----------------------------
@auth.route("/api-login", methods=["POST"])
def api_login():

    data = request.get_json()

    if not data:
        return jsonify({"success": False, "error": "JSON body required"}), 400

    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()

    from app.services.intrusion_service import register_failed_attempt

    # Invalid credentials
    if not user or not user.check_password(password):
        if user:
            register_failed_attempt(user, "Login brute force attempt")
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    # Account lock protection
    if is_account_locked(user):
        return jsonify({
            "success": False,
            "error": "Account temporarily locked due to suspicious activity. Try again later."
        }), 403

    # destroy old session
    session.clear()

    login_user(user, remember=False, fresh=True)

    session.permanent = True
    session["last_activity"] = datetime.utcnow().isoformat()

    # create csrf token
    csrf_token = generate_csrf_token()

    return jsonify({
        "success": True,
        "message": "Login successful",
        "csrf_token": csrf_token,
        "role": user.role,
        "name": user.name
    }), 200

# ----------------------------
# WEB LOGIN
# ----------------------------
@auth.route("/login", methods=["GET", "POST"])
def login():

    # SHOW PAGE
    if request.method == "GET":
        return render_template("public/login.html")

    # HANDLE FORM SUBMISSION
    email = request.form.get("email")
    password = request.form.get("password")

    if not email or not password:
        flash("Email and password are required", "danger")
        return redirect(url_for("auth.login"))

    user = User.query.filter_by(email=email).first()

    from app.services.intrusion_service import register_failed_attempt

    if not user or not user.check_password(password):
        if user:
            register_failed_attempt(user, "Web login brute force attempt")
        flash("Invalid email or password", "danger")
        return redirect(url_for("auth.login"))

    # Account lock protection
    if is_account_locked(user):
        flash("Account locked for 15 minutes due to suspicious activity.", "danger")
        return redirect(url_for("auth.login"))

    login_user(user)

    # generate csrf for browser session
    generate_csrf_token()

    # success message
    flash("Login successful", "success")

    # redirect by role
    return redirect(url_for("pages.dashboard_dispatch"))

# ----------------------------
# REGISTER
# ----------------------------
@auth.route("/api-register", methods=["POST"])
def api_register():

    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirm_password")

    # -------- VALIDATION --------
    if not name or not email or not password:
        return jsonify({"success": False, "error": "All fields are required"}), 400

    if password != confirm_password:
        return jsonify({
            "success": False,
            "error": "Passwords do not match"
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "error": "Email already exists"}), 400

    # -------- ENSURE DEFAULT DEPARTMENT EXISTS --------
    from app.models.department import Department

    default_dept = Department.query.filter_by(code="UNASSIGNED").first()

    if not default_dept:
        default_dept = Department(
            name="Unassigned",
            code="UNASSIGNED",
            latitude=0.0,
            longitude=0.0,
            allowed_radius_meters=1
        )
        db.session.add(default_dept)
        db.session.commit()
        print("AUTO-CREATED UNASSIGNED DEPARTMENT")

    # -------- CREATE USER --------
    user = User(
        name=name,
        email=email,
        role="student",
        department_id=default_dept.id,
        is_enabled=True
    )

    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Registration successful"
    })
@auth.route("/register")
def register():
    return render_template("public/register.html")
# ----------------------------
# LOGOUT
# ----------------------------
@auth.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login", logout=1))