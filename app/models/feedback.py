from datetime import datetime
from app.extensions import db


class Feedback(db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # ⭐ NEW — MAIN RELATION
    session_id = db.Column(
        db.Integer,
        db.ForeignKey("attendance_sessions.id"),
        nullable=True,   # temporarily nullable for migration
        index=True
    )

    # keep temporarily
    course_id = db.Column(
        db.Integer,
        db.ForeignKey("courses.id"),
        nullable=True
    )

    rating = db.Column(db.Integer, nullable=False)
    message = db.Column(db.Text, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_flagged = db.Column(db.Boolean, default=False)

    # relationships
    session = db.relationship("AttendanceSession", backref="feedbacks")
    course = db.relationship("Course")
