from app.models.user import User
from app.models.attendance_session import AttendanceSession
from app.models.security_alert import SecurityAlert
from app.utils.email_utils import send_alert_async
from app.utils.logger import log_event
from app.utils.time_utils import format_ist
from app.extensions import db
from datetime import datetime
from flask import request


def security_alert(user_id, event, details, session_id=None, similarity=None, distance=None):

    user = User.query.get(user_id)

    course_name = "N/A"
    department = "N/A"

    if session_id:
        session = AttendanceSession.query.get(session_id)
        if session:
            course_name = session.course.name
            department = session.course.department.name

    ip = request.headers.get("X-Forwarded-For", request.remote_addr)

    # -------- SAVE ALERT ----------
    alert = SecurityAlert(
        user_id=user.id,
        event=event,
        details=details,
        threat_score=5,
        similarity_score=similarity,
        distance_meters=distance,
        course_name=course_name,
        session_id=session_id,
        ip_address=ip
    )

    db.session.add(alert)
    db.session.commit()

    # -------- EMAIL ADMIN ----------
    subject = "🚨 Smart Attendance Security Alert"

    body = f"""
User Information
----------------
Name: {user.name}
Email: {user.email}
Department: {department}

Attendance Context
------------------
Course: {course_name}
Session ID: {session_id if session_id else "N/A"}

Threat Details
--------------
Event: {event}
Details: {details}

Similarity Score: {similarity}
Distance From Campus: {distance} meters

Timestamp: {format_ist(datetime.utcnow())}
"""

    send_alert_async(subject, body)

    log_event(f"SECURITY ALERT: {event} by {user.email}", "critical")