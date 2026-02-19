from flask import Blueprint, render_template, redirect, url_for
from app.utils.decorators import role_required_page
from flask_login import current_user, login_required

pages = Blueprint("pages", __name__)

# --------------------------------------------------
# PUBLIC HOME PAGE
# --------------------------------------------------
@pages.route("/")
def home():
    return render_template("public/home.html")


# --------------------------------------------------
# DASHBOARD DISPATCHER (AFTER LOGIN)
# --------------------------------------------------
@pages.route("/dashboard")
@login_required
def dashboard_dispatch():

    if current_user.role == "admin":
        return redirect(url_for("pages.admin_spa"))

    elif current_user.role == "faculty":
        return redirect(url_for("pages.faculty_spa"))

    else:
        return redirect(url_for("pages.student_spa"))


# --------------------------------------------------
# ADMIN SPA
# --------------------------------------------------
@pages.route("/admin")
@pages.route("/admin/")
@pages.route("/admin/<path:anything>")
@role_required_page("admin")
def admin_spa(anything=None):
    return render_template("layout/base.html")


# --------------------------------------------------
# FACULTY SPA
# --------------------------------------------------
@pages.route("/faculty")
@pages.route("/faculty/")
@pages.route("/faculty/<path:anything>")
@role_required_page("faculty")
def faculty_spa(anything=None):
    return render_template("layout/base.html")


# --------------------------------------------------
# STUDENT SPA
# --------------------------------------------------
@pages.route("/student")
@pages.route("/student/")
@pages.route("/student/<path:anything>")
@role_required_page("student")
def student_spa(anything=None):
    return render_template("layout/base.html")
