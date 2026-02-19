from dotenv import load_dotenv
import os
load_dotenv()
from flask import Flask, app, redirect, send_from_directory, url_for, jsonify, request
from app.extensions import db, login_manager, migrate
from pathlib import Path

# IMPORTANT
BASE_DIR = Path(__file__).resolve().parent.parent

def create_app():

    # =========================================================
    # CREATE FLASK APP
    # =========================================================
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR / "templates"),
        static_folder=str(BASE_DIR / "static"),
        static_url_path="/static"
    )
    
    app.config.from_object("config.Config")

    # Very important for fetch() authentication persistence
    app.config["SESSION_REFRESH_EACH_REQUEST"] = True

    # =========================================================
    # INITIALIZE EXTENSIONS (ORDER MATTERS)
    # =========================================================
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    from app.models import register_models
    register_models()

    login_manager.login_view = "auth.login"
    login_manager.session_protection = None


    # =========================================================
    # USER LOADER
    # (must be after db.init_app)
    # =========================================================
    from app.models.user import User

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return User.query.get(int(user_id))
        except Exception:
            return None


    # =========================================================
    # REGISTER BLUEPRINTS (IMPORT ONLY AFTER APP IS READY)
    # =========================================================
    from app.routes.auth import auth
    from app.routes.pages import pages
    from app.routes.api_admin import api_admin
    from app.routes.api_faculty import api_faculty
    from app.routes.api_student import api_student
    from app.routes.api_session import api_session
    from app.routes.api_security import api_security
    from app.routes.api_admin_security import api_admin_security
    from app.routes.security_routes import security_api
    
    app.register_blueprint(auth, url_prefix="/auth")
    app.register_blueprint(pages)

    app.register_blueprint(api_admin, url_prefix="/api/admin")
    app.register_blueprint(api_faculty, url_prefix="/api/faculty")
    app.register_blueprint(api_student, url_prefix="/api/student")

    app.register_blueprint(api_session, url_prefix="/api")
    app.register_blueprint(api_security, url_prefix="/api")
    app.register_blueprint(api_admin_security, url_prefix="/api/admin")

    app.register_blueprint(security_api, url_prefix="/api/security")

    # =========================================================
    # API AUTH HANDLER (VERY IMPORTANT FOR SPA)
    # =========================================================
    @login_manager.unauthorized_handler
    def unauthorized_callback():
        if request.path.startswith("/api/"):
            return jsonify({
                "success": False,
                "error": "Authentication required"
            }), 401

        return redirect(url_for("auth.login"))


    # =========================================================
    # SESSION PROTECTION + AUTO SESSION CLOSE
    # =========================================================
    @app.before_request
    def session_protection():

        # Import here to avoid circular imports
        from flask_login import current_user
        from app.utils.session_manager import check_session_timeout
        from app.services.session_service import auto_close_expired_sessions

        path = request.path

        # Allow static files
        if path.startswith("/static"):
            return

        # Allow auth routes
        if path.startswith("/auth"):
            return

        # Only protect API routes
        if not path.startswith("/api/"):
            return

        if not current_user.is_authenticated:
            return

        # logout after inactivity
        check_session_timeout()

        # do not sweep during biometric upload or SSE
        if not request.path.startswith("/api/student/mark-attendance") \
        and not request.path.startswith("/api/student/live-notifications"):
            auto_close_expired_sessions()



    # =========================================================
    # GLOBAL ERROR HANDLERS
    # =========================================================

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({
            "success": False,
            "error": "Bad request"
        }), 400

    @app.errorhandler(403)
    def forbidden(e):
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Access denied"
        }), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({
            "success": False,
            "error": "Resource not found"
        }), 404

    @app.errorhandler(500)
    def internal_error(e):
        # reset broken DB session
        db.session.rollback()

        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500


    return app