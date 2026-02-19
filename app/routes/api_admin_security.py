from flask import Blueprint, jsonify
from flask_login import current_user
from app.utils.decorators import role_required_api
from app.models.security_alert import SecurityAlert
from app.models.user import User
from app.models.attendance_session import AttendanceSession
from app.models.attendance_record import AttendanceRecord
from app.extensions import db
from sqlalchemy import func
from datetime import datetime, timedelta

api_admin_security = Blueprint("api_admin_security", __name__)


# =========================================================
# SYSTEM HEALTH
# =========================================================
@api_admin_security.route("/security/system-health")
@role_required_api("admin")
def system_health():

    now = datetime.utcnow()

    try:
        # Active sessions
        active_sessions = AttendanceSession.query.filter_by(is_active=True).count()

        # Students
        total_students = User.query.filter(User.role == "student").count()

        # Attendance last 24h
        today_attendance = AttendanceRecord.query.filter(
            AttendanceRecord.marked_at >= now - timedelta(hours=24)
        ).count()

        # Threat alerts
        threats = SecurityAlert.query.filter(
            SecurityAlert.created_at >= now - timedelta(hours=24)
        ).count()

        # Locked accounts
        locked_accounts = User.query.filter(
            User.account_locked_until != None,
            User.account_locked_until > now
        ).count()

        return jsonify({
            "success": True,
            "data": {
                "active_sessions": active_sessions,
                "students": total_students,
                "attendance_today": today_attendance,
                "threats_today": threats,
                "locked_accounts": locked_accounts
            }
        })

    except Exception as e:
        print("SYSTEM HEALTH ERROR:", e)
        return jsonify({"success": False, "error": "system health failed"}), 500

# =========================================================
# RECENT THREATS
# =========================================================
@api_admin_security.route("/security/recent-threats")
@role_required_api("admin")
def recent_threats():

    alerts = (
        db.session.query(SecurityAlert, User)
        .outerjoin(User, User.id == SecurityAlert.user_id)
        .order_by(SecurityAlert.created_at.desc())
        .limit(10)
        .all()
    )

    data = []

    for alert, user in alerts:
        data.append({
            "id": alert.id,
            "student": user.name if user else "Deleted User",
            "email": user.email if user else "-",
            "event": alert.event,
            "course": alert.course_name or "N/A",
            "time": alert.created_at.strftime("%d %b %H:%M"),
            "status": "Resolved" if alert.is_resolved else "Active"
        })
    return jsonify({"success": True, "data": data})


# =========================================================
# SUSPICIOUS STUDENTS
# =========================================================
@api_admin_security.route("/security/suspicious-students")
@role_required_api("admin")
def suspicious_students():

    students = User.query.filter(
        User.role == "student",
        User.biometric_violations >= 3
    ).all()

    data = []

    for s in students:
        data.append({
            "name": s.name,
            "email": s.email,
            "department": s.department.name if s.department else "N/A",
            "violations": s.biometric_violations
        })

    return jsonify({"success": True, "data": data})

# =========================================================
# RESOLVE ALERT
# =========================================================
@api_admin_security.route("/security/resolve-alert/<int:alert_id>", methods=["POST"])
@role_required_api("admin")
def resolve_alert(alert_id):

    alert = SecurityAlert.query.get_or_404(alert_id)

    if alert.is_resolved:
        return jsonify({
            "success": False,
            "error": "Already resolved"
        }), 400

    alert.is_resolved = True
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Threat marked as resolved"
    })
# =========================================================
# ATTACK STATS (GRAPH)
# =========================================================
@api_admin_security.route("/security/attack-stats")
@role_required_api("admin")
def attack_stats():

    now = datetime.utcnow()

    # start of today (00:00 UTC)
    start = datetime(now.year, now.month, now.day)

    alerts = SecurityAlert.query.filter(
        SecurityAlert.created_at >= start
    ).all()

    # hourly buckets (24h dashboard)
    buckets = {f"{h:02d}:00": 0 for h in range(24)}

    for alert in alerts:
        hour = alert.created_at.strftime("%H:00")
        buckets[hour] += 1

    data = [
        {"label": k, "value": v}
        for k, v in buckets.items()
    ]

    return jsonify({
        "success": True,
        "data": data
    })