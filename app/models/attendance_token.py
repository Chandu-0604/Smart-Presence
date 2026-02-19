from app.extensions import db
from datetime import datetime, timedelta

class AttendanceToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    token = db.Column(db.String(128), unique=True, nullable=False)

    user_id = db.Column(db.Integer, nullable=False)
    session_id = db.Column(db.Integer, nullable=False)

    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)