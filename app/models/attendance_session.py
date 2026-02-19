from datetime import datetime
from app.extensions import db


class AttendanceSession(db.Model):
    __tablename__ = "attendance_sessions"

    id = db.Column(db.Integer, primary_key=True)

    course_id = db.Column(
        db.Integer,
        db.ForeignKey("courses.id"),
        nullable=False
    )

    faculty_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    start_time = db.Column(db.DateTime, nullable=False)

    end_time = db.Column(db.DateTime, nullable=False)

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
    db.Index("idx_course_active", "course_id", "is_active"),
    )
    # Relationship
    records = db.relationship(
        "AttendanceRecord",
        backref="session",
        lazy=True,
        cascade="all, delete-orphan"
    )