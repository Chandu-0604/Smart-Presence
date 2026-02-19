import os

class Config:
    # ======================================================
    # CORE SECURITY
    # ======================================================
    SECRET_KEY = os.environ.get("SECRET_KEY")

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

    # ======================================================
    # DATABASE
    # ======================================================
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(BASE_DIR, "attendance.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ======================================================
    # UPLOAD & FACE SETTINGS
    # ======================================================
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB per request

    FACE_ENCRYPTION_KEY = os.environ.get("FACE_ENCRYPTION_KEY")
    FACE_MIN_SIMILARITY = 0.7

    # ======================================================
    # MAIL
    # ======================================================
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")

    # ======================================================
    # SESSION COOKIE SETTINGS (SPA SAFE)
    # ======================================================
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_DOMAIN = None

    REMEMBER_COOKIE_SAMESITE = "None"
    REMEMBER_COOKIE_SECURE = True

    # ======================================================
    # DEVELOPMENT ONLY
    # ======================================================
    DEBUG = True
    TEMPLATES_AUTO_RELOAD = True
