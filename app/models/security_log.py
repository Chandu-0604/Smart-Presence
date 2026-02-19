from datetime import datetime
from app.extensions import db


class SecurityLog(db.Model):
    __tablename__ = "security_logs"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    event = db.Column(db.String(255), nullable=False)

    ip_address = db.Column(db.String(45))

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        index=True
    )

    event_type = db.Column(db.String(50))
    user_agent = db.Column(db.String(255))
