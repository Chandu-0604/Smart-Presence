from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app.extensions import db

VALID_ROLES = ["student", "faculty", "admin"]


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")
    is_enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # --- STUDENT ACADEMIC INFO ---
    year = db.Column(db.Integer, nullable=True)        # 1 to 4
    semester = db.Column(db.Integer, nullable=True)    # 1 to 8
    usn = db.Column(db.String(20), nullable=True)      # roll number
    section = db.Column(db.String(5), nullable=True)   # A/B/C

    department_id = db.Column(
        db.Integer,
        db.ForeignKey("departments.id"),
        nullable=False,
        index=True
    )

    # 🔐 FACE SYSTEM (INSIDE CLASS)
    face_embedding = db.Column(db.LargeBinary, nullable=True)
    face_registered = db.Column(db.Boolean, default=False)
    embedding_updated_at = db.Column(db.DateTime)

    last_login_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ---------- SECURITY PROTECTION ----------
    failed_attempts = db.Column(db.Integer, nullable=False, default=0)
    last_failed_attempt = db.Column(db.DateTime)
    account_locked_until = db.Column(db.DateTime, nullable=True)
    biometric_violations = db.Column(db.Integer, default=0, nullable=False)
    
    # Relationships
    enrollments = db.relationship(
        "Enrollment",
        back_populates="student",
        cascade="all, delete-orphan"
    )

    attendance_records = db.relationship(
        "AttendanceRecord",
        backref="student",
        lazy=True,
        cascade="all, delete-orphan"
    )

    sessions = db.relationship(
        "AttendanceSession",
        backref="faculty",
        lazy=True
    )

    feedbacks = db.relationship(
        "Feedback",
        backref="student_user",
        lazy=True,
        cascade="all, delete-orphan"
    )

    security_logs = db.relationship(
        "SecurityLog",
        backref="user",
        lazy=True
    )

    department = db.relationship(
        "Department",
        back_populates="users"
    )

    @property
    def is_active(self):
        return bool(self.is_enabled)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def set_role(self, role):
        if role not in VALID_ROLES:
            raise ValueError("Invalid role")
        self.role = role