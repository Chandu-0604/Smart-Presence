from flask import Blueprint, request, Response
from flask_login import current_user
from datetime import datetime, timedelta
from app.extensions import db
from app.models.user import User
from app.utils.decorators import role_required_api
from app.utils.responses import success_response, error_response
from app.models.course import Course
from app.models.attendance_session import AttendanceSession
from app.models.attendance_record import AttendanceRecord
from app.models.enrollment import Enrollment
from app.utils.time_utils import format_ist
from app.utils.api_time import to_api_time
from flask import Response, stream_with_context
import json
import time
from datetime import datetime, timedelta, timezone

api_faculty = Blueprint("api_faculty", __name__)

# ================= COURSES =================

@api_faculty.route("/courses")
@role_required_api("faculty")
def courses():

    courses = Course.query.filter_by(
        faculty_id=current_user.id
    ).all()

    data = []

    for c in courses:
        student_count = Enrollment.query.filter_by(
            course_id=c.id
        ).count()

        session_count = AttendanceSession.query.filter_by(
            course_id=c.id
        ).count()

        data.append({
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "students": student_count,
            "sessions": session_count
        })

    return success_response(data)

# ================= ACTIVE SESSION =================

@api_faculty.route("/active-session")
@role_required_api("faculty")
def active_session():

    session = AttendanceSession.query.filter_by(
        faculty_id=current_user.id,
        is_active=True
    ).first()

    if not session:
        return success_response(None)

    # 🔥 AUTO CLOSE IF EXPIRED
    if session.end_time < datetime.utcnow():
        session.end_time = datetime.utcnow()
        db.session.commit()
        return success_response(None)

    present = AttendanceRecord.query.filter_by(
        session_id=session.id
    ).count()

    return success_response({
        "id": session.id,
        "course_name": session.course.name,
        "end_time": to_api_time(session.end_time),
        "present_count": present
    })

# ================= SESSIONS (PAGINATED) =================

@api_faculty.route("/sessions")
@role_required_api("faculty")
def sessions():

    page = int(request.args.get("page", 1))
    per_page = 10

    query = AttendanceSession.query.filter_by(
        faculty_id=current_user.id
    ).order_by(AttendanceSession.start_time.desc())

    pagination = query.paginate(page=page, per_page=per_page)

    now = datetime.utcnow()
    GRACE = timedelta(seconds=30)

    data = []

    for s in pagination.items:

        # ---------- derive real state ----------
        if now < s.end_time:
            status = "active"

        elif s.end_time <= now < (s.end_time + GRACE):
            status = "closing"

        else:
            status = "closed"

        present = AttendanceRecord.query.filter_by(
            session_id=s.id
        ).count()

        data.append({
            "id": s.id,
            "course_name": s.course.name,
            "start_time": to_api_time(s.start_time),
            "end_time": to_api_time(s.end_time),
            "present_count": present,
            "status": status
        })

    return success_response({
        "sessions": data,
        "total_pages": pagination.pages,
        "current_page": page,
        "total_sessions": query.count()
    })
# ================= OPEN SESSION =================

@api_faculty.route("/open-session", methods=["POST"])
@role_required_api("faculty")
def open_session():

    data = request.get_json()

    course_id = data.get("course_id")
    duration = int(data.get("duration", 5))

    if not course_id:
        return error_response("Course ID required")

    # Get course
    course = Course.query.filter_by(
        id=course_id,
        faculty_id=current_user.id
    ).first()

    if not course:
        return error_response("Invalid course", 403)

    # 🔐 Only one active session per faculty
    faculty_active = AttendanceSession.query.filter_by(
        faculty_id=current_user.id,
        is_active=True
    ).first()

    if faculty_active:
        return error_response(
            "You already have an active session running",
            400
        )

    # 🔐 Only one active session per course
    existing = AttendanceSession.query.filter_by(
        course_id=course_id,
        is_active=True
    ).first()

    if existing:
        return error_response(
            "This course already has an active session",
            400
        )

    # Optional safety: duration limits
    if duration < 1 or duration > 120:
        return error_response("Session duration must be 1–120 minutes")

    start = datetime.now(timezone.utc)
    end = start + timedelta(minutes=duration)

    session = AttendanceSession(
        course_id=course_id,
        faculty_id=current_user.id,
        start_time=start,
        end_time=end,
        is_active=True
    )

    db.session.add(session)
    db.session.commit()

    return success_response(message="Session started")

# ================= CLOSE SESSION =================

@api_faculty.route("/close-session/<int:session_id>", methods=["POST"])
@role_required_api("faculty")
def close_session(session_id):

    session = AttendanceSession.query.get_or_404(session_id)

    if session.faculty_id != current_user.id:
        return error_response("Unauthorized", 403)

    session.end_time = datetime.utcnow()
    db.session.commit()

    return success_response(message="Session closed")

# ================= ATTENDANCE TREND =================

@api_faculty.route("/attendance-trend")
@role_required_api("faculty")
def attendance_trend():

    sessions = AttendanceSession.query.filter_by(
        faculty_id=current_user.id
    ).order_by(AttendanceSession.start_time.asc()).all()

    labels = []
    values = []

    for s in sessions:
        total_students = Enrollment.query.filter_by(
            course_id=s.course_id
        ).count()

        present = AttendanceRecord.query.filter_by(
            session_id=s.id
        ).count()

        percentage = 0
        if total_students > 0:
            percentage = round((present / total_students) * 100, 2)

        labels.append(s.start_time.strftime("%d %b"))
        values.append(percentage)

    return success_response({
        "labels": labels,
        "values": values
    })

# ================= EXPORT CSV =================

@api_faculty.route("/export-sessions")
@role_required_api("faculty")
def export_sessions():

    sessions = AttendanceSession.query.filter_by(
        faculty_id=current_user.id
    ).all()

    def generate():
        yield "Course,Start,End,Present\n"
        for s in sessions:
            present = AttendanceRecord.query.filter_by(
                session_id=s.id
            ).count()

            yield f"{s.course.name},{s.start_time},{s.end_time},{present}\n"

    return Response(
        generate(),
        mimetype="text/csv",
        headers={"Content-Disposition":
                 "attachment;filename=sessions.csv"}
    )

# ================= LIVE ATTENDANCE STUDENTS =================
@api_faculty.route("/session/<int:session_id>/students")
@role_required_api("faculty")
def session_students(session_id):

    session = AttendanceSession.query.get_or_404(session_id)

    if session.faculty_id != current_user.id:
        return error_response("Unauthorized", 403)

    records = db.session.query(
        AttendanceRecord,
        User.name,
        User.usn
    ).join(User, User.id == AttendanceRecord.student_id)\
     .filter(AttendanceRecord.session_id == session_id)\
     .order_by(AttendanceRecord.marked_at.desc())\
     .all()

    data = []

    for rec, name, usn in records:
        data.append({
            "record_id": rec.id,
            "name": name,
            "usn": usn,
            "time": to_api_time(rec.marked_at),
            "similarity": round(rec.similarity_score,3) if rec.similarity_score else None,
            "distance": round(rec.geo_distance_meters,2) if rec.geo_distance_meters else None
        })

    return success_response(data)

# ================= REMOVE ATTENDANCE =================

@api_faculty.route("/remove-attendance/<int:record_id>", methods=["POST"])
@role_required_api("faculty")
def remove_attendance(record_id):

    record = AttendanceRecord.query.get_or_404(record_id)

    session = AttendanceSession.query.get(record.session_id)

    if session.faculty_id != current_user.id:
        return error_response("Unauthorized",403)

    db.session.delete(record)
    db.session.commit()

    return success_response(message="Attendance removed")

@api_faculty.route("/session/<int:session_id>/report")
@role_required_api("faculty")
def session_report(session_id):

    session = AttendanceSession.query.get_or_404(session_id)

    if session.faculty_id != current_user.id:
        return error_response("Unauthorized",403)

    records = db.session.query(
        AttendanceRecord,
        User.name,
        User.usn
    ).join(User, User.id == AttendanceRecord.student_id)\
     .filter(AttendanceRecord.session_id == session_id)\
     .all()

    data = []

    for r, name, usn in records:
        data.append({
            "name": name,
            "usn": usn,
            "time": to_api_time(r.marked_at),
            "similarity": r.similarity_score,
            "distance": r.geo_distance_meters
        })

    return success_response(data)

@api_faculty.route("/live-session-stream/<int:session_id>")
@role_required_api("faculty")
def live_session_stream(session_id):

    session = AttendanceSession.query.get_or_404(session_id)

    # security
    if session.faculty_id != current_user.id:
        return error_response("Unauthorized",403)

    def event_stream():

        last_id = 0

        while True:

            # stop if session closed
            db.session.expire_all()
            s = AttendanceSession.query.get(session_id)
            if not s or not s.status:
                yield "event: close\ndata: session_closed\n\n"
                break

            records = (
                AttendanceRecord.query
                .filter(
                    AttendanceRecord.session_id == session_id,
                    AttendanceRecord.id > last_id
                )
                .order_by(AttendanceRecord.id.asc())
                .all()
            )

            for r in records:
                last_id = r.id

                data = {
                    "name": r.student.name,
                    "usn": r.student.usn,
                    "time": to_api_time(r.marked_at),
                    "similarity": r.similarity_score
                }

                yield f"data: {json.dumps(data)}\n\n"

            time.sleep(2)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream"
    )

@api_faculty.route("/session-live/<int:session_id>")
@role_required_api("faculty")
def session_live(session_id):

    def stream():
        last_count = -1

        try:
            while True:

                # client disconnected
                if request.environ.get("wsgi.websocket") is None and request.environ.get("werkzeug.server.shutdown"):
                    break

                records = AttendanceRecord.query.filter_by(
                    session_id=session_id
                ).all()

                if len(records) != last_count:
                    last_count = len(records)

                    data = []
                    for r in records:
                        data.append({
                            "name": r.student.name,
                            "usn": r.student.usn,
                            "time": to_api_time(r.created_at),
                            "similarity": round(r.similarity_score,3)
                        })

                    payload = {
                        "type":"attendance_update",
                        "count":len(records),
                        "students":data
                    }

                    yield f"data: {json.dumps(payload)}\n\n"

                time.sleep(2)

        except GeneratorExit:
            # BROWSER CLOSED → VERY IMPORTANT
            db.session.remove()

    return Response(
        stream_with_context(stream()),
        mimetype="text/event-stream"
    )
