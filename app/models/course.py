from datetime import datetime
from app.extensions import db


class Course(db.Model):
    __tablename__ = "courses"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100), nullable=False)

    code = db.Column(db.String(20), nullable=False)

    faculty_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    department_id = db.Column(
        db.Integer,
        db.ForeignKey("departments.id"),
        nullable=False,
        index=True
    )

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("department_id", "code", name="uq_dept_course_code"),
    )

    # Relationships

    faculty = db.relationship(
        "User",
        backref="courses",
        foreign_keys=[faculty_id]
    )

    department = db.relationship(
        "Department",
        back_populates="courses"
    )
    
    sessions = db.relationship(
        "AttendanceSession",
        backref="course",
        lazy=True
    )

    enrollments = db.relationship(
        "Enrollment",
        back_populates="course",
        cascade="all, delete-orphan"
    )