from datetime import datetime
from app.extensions import db

class SecurityAlert(db.Model):
    __tablename__ = "security_alerts"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    event = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)

    # how dangerous it is
    threat_score = db.Column(db.Integer, default=0)

    # attack evidence
    similarity_score = db.Column(db.Float)
    distance_meters = db.Column(db.Float)

    ip_address = db.Column(db.String(45))
    course_name = db.Column(db.String(120))
    session_id = db.Column(db.Integer)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # admin action
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.Integer)

    user = db.relationship("User", lazy=True)