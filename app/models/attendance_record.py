from datetime import datetime
from app.extensions import db


class AttendanceRecord(db.Model):
    __tablename__ = "attendance_records"

    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    session_id = db.Column(
        db.Integer,
        db.ForeignKey("attendance_sessions.id"),
        nullable=False,
        index=True
    )

    marked_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            "student_id",
            "session_id",
            name="uq_student_session"
        ),
    )

    similarity_score = db.Column(db.Float)
    geo_distance_meters = db.Column(db.Float)
    ip_address = db.Column(db.String(45))
    verification_method = db.Column(db.String(50))