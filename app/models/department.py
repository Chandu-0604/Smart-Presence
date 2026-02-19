from datetime import datetime
from app.extensions import db


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(120), unique=True, nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)

    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    allowed_radius_meters = db.Column(db.Integer, default=300)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    users = db.relationship(
        "User",
        back_populates="department",
        lazy=True
    )

    courses = db.relationship(
        "Course",
        back_populates="department",
        lazy=True
    )